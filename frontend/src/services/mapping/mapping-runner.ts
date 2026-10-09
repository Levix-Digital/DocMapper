import type { MappingProfile, ExtractionResult, FieldDefinition } from '../../types/mapping';
import { loadPdf, extractFieldsWithCalibration } from '../pdf/spatial-extractor';
import { testRegexPattern, getStoredApiKey, extractDocumentViaVision } from '../llm/gemini-service';
import { stampDestinationPdf } from '../pdf/dynamic-stamper';

export interface BatchProcessingOptions {
  files: File[];
  profile: MappingProfile;
  onProgress?: (processed: number, total: number, fileName: string) => void;
}

/**
 * Smart fallback text extractor for standard logistics fields when spatial
 * coordinates encounter printer jitter or scanned margin offsets.
 */
async function fallbackExtractField(page: any, field: FieldDefinition): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    const fullText = textContent.items.map((it: any) => it.str).join(' ');
    const nameLower = field.name.toLowerCase();

    if (nameLower.includes('shipment')) {
      const m = fullText.match(/Shipment:\s*([A-Za-z0-9\-_]+)/i);
      if (m) return m[1];
    }
    if (nameLower.includes('seal')) {
      const m = fullText.match(/(?:Plombe|Seal|Plomb)\.?\s*:?\s*([A-Za-z0-9\-_]+)/i);
      if (m) return m[1];
    }
    if (nameLower.includes('trailer') || nameLower.includes('transport')) {
      const m = fullText.match(/(?:trailer|container|anhänger|remorque)\s*:?\s*([A-Za-z0-9\-_]+)/i);
      if (m) return m[1];
    }
    if (nameLower.includes('consignment')) {
      const m = fullText.match(/Consignments?:\s*([A-Za-z0-9\-_]+)/i);
      if (m) return m[1];
    }

    if (field.validationPattern) {
      try {
        const cleanPattern = field.validationPattern.replace(/^\^|\$$/g, '');
        const regex = new RegExp(`\\b(${cleanPattern})\\b`, 'i');
        const m = fullText.match(regex);
        if (m) return m[1];
      } catch (_) {}
    }
  } catch (_) {}
  return '';
}

/**
 * Executes a deterministic, client-side batch extraction run for a list of PDF files
 * using a configured MappingProfile. Supports multi-page batch files (e.g. CMRs.pdf),
 * elastic interval reflow, and transparent multimodal Vision rescue.
 */
export async function executeBatchMapping(
  options: BatchProcessingOptions
): Promise<ExtractionResult[]> {
  const { files, profile, onProgress } = options;
  const results: ExtractionResult[] = [];
  const totalFiles = files.length;
  const apiKey = getStoredApiKey();

  // Determine pages per document in this profile
  const maxProfilePage = Math.max(...profile.fields.map(f => f.valueBox?.page || 1), 1);

  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    const file = files[fileIdx];
    if (onProgress) {
      onProgress(fileIdx, totalFiles, file.name);
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await loadPdf(arrayBuffer);
      const numPages = pdfDoc.numPages;

      // Calculate how many documents are in this file:
      // If a multi-page file and the profile is 1-page (like standard CMR),
      // each page is treated as an individual shipment document.
      const docCount = maxProfilePage === 1 ? numPages : Math.max(1, Math.floor(numPages / maxProfilePage));

      for (let docIdx = 0; docIdx < docCount; docIdx++) {
        const pageOffset = docIdx * maxProfilePage;
        const extractedData: Record<string, string> = {};
        const confidenceScores: Record<string, number> = {};

        // Group fields by their target page within this document
        const fieldsByPage = new Map<number, FieldDefinition[]>();
        for (const field of profile.fields) {
          const targetPageNum = Math.min(pageOffset + Math.max(field.valueBox?.page || 1, 1), numPages);
          if (!fieldsByPage.has(targetPageNum)) {
            fieldsByPage.set(targetPageNum, []);
          }
          fieldsByPage.get(targetPageNum)!.push(field);
        }

        // Process each page using Elastic Interval Engine with Anomaly Gate
        for (const [pageNum, pageFields] of fieldsByPage.entries()) {
          const page = await pdfDoc.getPage(pageNum);
          const calibrationResult = await extractFieldsWithCalibration(page, pageFields);
          let pageData = { ...calibrationResult.data };

          // Transparent Anomaly Gate:
          // If required fields are missing or topological anomaly detected,
          // silently rescue via Gemini Vision if API key is present
          const hasMissingRequired = calibrationResult.missingRequiredFields.length > 0;
          const hasAnomaly = calibrationResult.hasTopologicalAnomaly;

          if ((hasMissingRequired || hasAnomaly) && apiKey && typeof document !== 'undefined') {
            try {
              const visionData = await extractDocumentViaVision(page, pageFields, apiKey);
              for (const field of pageFields) {
                if (!pageData[field.name] || visionData[field.name]) {
                  pageData[field.name] = visionData[field.name] || pageData[field.name];
                  pageData[field.id] = visionData[field.id] || pageData[field.id];
                }
              }
            } catch (visionErr) {
              console.warn('[DocMapper Anomaly Gate] Vision rescue unavailable:', visionErr);
            }
          }

          for (const field of pageFields) {
            let val = pageData[field.name] || pageData[field.id] || '';

            // Fallback only if spatial box returned empty
            if (!val || val.trim().length === 0) {
              val = await fallbackExtractField(page, field);
            }

            val = val ? val.trim() : '';
            extractedData[field.name] = val;
            extractedData[field.id] = val;

            // Calculate confidence: purely advisory, never rejecting values
            if (!val) {
              confidenceScores[field.name] = field.isRequired ? 0 : 80;
            } else {
              const test = testRegexPattern(field.validationPattern, val);
              confidenceScores[field.name] = test.matches ? 100 : 85;
            }
          }
        }

        // Compute overall document confidence
        const scores = Object.values(confidenceScores);
        const overallConfidence = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 100;

        // Stamp destination PDF if template exists (or fallback to clean layout)
        let pdfBlob: Blob | undefined;
        try {
          const stampedBytes = await stampDestinationPdf({
            templatePdfBytes: profile.destinationTemplateBase64 || '',
            mappings: profile.destinationMappings,
            fields: profile.fields,
            extractedValues: extractedData,
          });
          pdfBlob = new Blob([stampedBytes as any], { type: 'application/pdf' });
        } catch (stampErr) {
          console.warn(`Failed to stamp destination PDF for ${file.name} doc ${docIdx + 1}:`, stampErr);
        }

        // Determine dynamic filename based on primary extracted identifier
        const shipmentKey =
          extractedData['Shipment Number'] ||
          extractedData['Shipment'] ||
          extractedData['shipment'] ||
          Object.entries(extractedData).find(([k, v]) => !k.startsWith('field-') && v && v.length >= 5)?.[1];

        let outFileName: string;
        if (shipmentKey && shipmentKey.length >= 3) {
          outFileName = `${shipmentKey}.pdf`;
        } else if (docCount > 1) {
          outFileName = `${file.name.replace(/\.pdf$/i, '')}_page${docIdx + 1}.pdf`;
        } else {
          outFileName = `${file.name.replace(/\.pdf$/i, '')}_processed.pdf`;
        }

        results.push({
          documentIndex: results.length,
          fileName: outFileName,
          extractedData,
          confidenceScores,
          overallConfidence,
          status: overallConfidence >= 50 ? 'APPROVED' : 'FAILED',
          pdfBlob,
        });
      }
    } catch (err: any) {
      console.error(`Error processing file ${file.name}:`, err);
      results.push({
        documentIndex: results.length,
        fileName: file.name,
        extractedData: {},
        confidenceScores: {},
        overallConfidence: 0,
        status: 'FAILED',
        errorMessage: err?.message || 'Failed to process document',
      });
    }
  }

  if (onProgress) {
    onProgress(totalFiles, totalFiles, 'Complete');
  }

  return results;
}
