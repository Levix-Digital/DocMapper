import type { MappingProfile, ExtractionResult } from '../../types/mapping';
import { loadPdf, extractTextInBox } from '../pdf/spatial-extractor';
import { testRegexPattern } from '../llm/gemini-service';
import { stampDestinationPdf } from '../pdf/dynamic-stamper';

export interface BatchProcessingOptions {
  files: File[];
  profile: MappingProfile;
  onProgress?: (processed: number, total: number, fileName: string) => void;
}

/**
 * Executes a deterministic, client-side batch extraction run for a list of PDF files
 * using a configured MappingProfile. Zero external LLM calls or server uploads.
 */
export async function executeBatchMapping(
  options: BatchProcessingOptions
): Promise<ExtractionResult[]> {
  const { files, profile, onProgress } = options;
  const results: ExtractionResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i, total, file.name);
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await loadPdf(arrayBuffer);
      const numPages = pdfDoc.numPages;

      const extractedData: Record<string, string> = {};
      const confidenceScores: Record<string, number> = {};

      const pageCache = new Map<number, any>();

      // Extract each field
      for (const field of profile.fields) {
        const targetPage = Math.min(Math.max(field.valueBox.page, 1), numPages);
        if (!pageCache.has(targetPage)) {
          pageCache.set(targetPage, await pdfDoc.getPage(targetPage));
        }
        const page = pageCache.get(targetPage);

        const val = await extractTextInBox(page, field.valueBox);
        extractedData[field.name] = val;
        // Also map by ID for target mappings
        extractedData[field.id] = val;

        // Calculate confidence
        if (!val || val.trim().length === 0) {
          confidenceScores[field.name] = field.isRequired ? 0 : 80;
        } else {
          const test = testRegexPattern(field.validationPattern, val);
          if (test.matches) {
            confidenceScores[field.name] = 100;
          } else {
            confidenceScores[field.name] = 50; // Text found, but pattern mismatch
          }
        }
      }

      // Compute overall document confidence
      const scores = Object.values(confidenceScores);
      const overallConfidence = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 100;

      // Stamp destination PDF if template exists
      let pdfBlob: Blob | undefined;
      if (profile.destinationTemplateBase64) {
        try {
          const stampedBytes = await stampDestinationPdf({
            templatePdfBytes: profile.destinationTemplateBase64,
            mappings: profile.destinationMappings,
            fields: profile.fields,
            extractedValues: extractedData,
          });
          pdfBlob = new Blob([stampedBytes as any], { type: 'application/pdf' });
        } catch (stampErr) {
          console.warn(`Failed to stamp template for ${file.name}:`, stampErr);
        }
      }

      results.push({
        documentIndex: i,
        fileName: file.name,
        extractedData,
        confidenceScores,
        overallConfidence,
        status: overallConfidence >= 60 ? 'APPROVED' : 'FAILED',
        pdfBlob,
      });
    } catch (err: any) {
      console.error(`Error processing file ${file.name}:`, err);
      results.push({
        documentIndex: i,
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
    onProgress(total, total, 'Complete');
  }

  return results;
}
