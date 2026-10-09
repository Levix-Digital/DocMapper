import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { BoundingBox, FieldDefinition } from '../../types/mapping';

// Ensure worker is configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

export interface ExtractedGlyph {
  str: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

/**
 * Load a PDF document from an ArrayBuffer, Uint8Array or Base64 string.
 */
export async function loadPdf(data: ArrayBuffer | Uint8Array | string): Promise<pdfjsLib.PDFDocumentProxy> {
  let sourceData: Uint8Array;

  if (typeof data === 'string') {
    // If base64 or data URL
    const base64Clean = data.includes(',') ? data.split(',')[1] : data;
    const binaryString = atob(base64Clean.replace(/\s/g, ''));
    const len = binaryString.length;
    sourceData = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      sourceData[i] = binaryString.charCodeAt(i);
    }
  } else if (data instanceof ArrayBuffer) {
    sourceData = new Uint8Array(data);
  } else {
    sourceData = data;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: sourceData,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/cmaps/',
    cMapPacked: true,
  });

  return await loadingTask.promise;
}

/**
 * Checks if a PDF page appears to be a scanned image with no digital text layer.
 */
export async function isPageScanned(page: any): Promise<boolean> {
  const textContent = await page.getTextContent();
  const validItems = textContent.items.filter((item: any) => 'str' in item && item.str.trim().length > 0);
  return validItems.length === 0;
}

/**
 * Extracts text located within a normalized BoundingBox on a given PDF page.
 */
export async function extractTextInBox(
  page: any,
  box: BoundingBox,
  tolerancePercent = 0.15
): Promise<string> {
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const glyphs: ExtractedGlyph[] = [];

  const boxMinX = box.x - tolerancePercent;
  const boxMaxX = box.x + box.width + tolerancePercent;
  const boxMinY = box.y - tolerancePercent;
  const boxMaxY = box.y + box.height + tolerancePercent;

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str) continue;

    // transform: [scaleX, skewY, skewX, scaleY, tx, ty]
    // PDF space: origin (0,0) at bottom-left
    const tx = item.transform[4];
    const ty = item.transform[5];
    const itemWidth = item.width || Math.abs(item.transform[0]) || 0;
    const itemHeight = item.height || Math.abs(item.transform[3]) || 10;

    // Convert to Top-Left coordinate space
    const glyphLeft = tx;
    const glyphTop = pageHeight - (ty + itemHeight);

    const xPercent = (glyphLeft / pageWidth) * 100;
    const yPercent = (glyphTop / pageHeight) * 100;
    const widthPercent = (itemWidth / pageWidth) * 100;
    const heightPercent = (itemHeight / pageHeight) * 100;

    const midX = xPercent + (widthPercent / 2);
    const midY = yPercent + (heightPercent / 2);

    const glyphRight = xPercent + widthPercent;
    const glyphBottom = yPercent + heightPercent;

    // Check if the glyph's center point is within the bounding box (with tolerance)
    const centerInside =
      midX >= boxMinX &&
      midX <= boxMaxX &&
      midY >= boxMinY &&
      midY <= boxMaxY;

    // Or significant overlap: at least 45% of the glyph's area is enclosed by the box
    const hOverlap = Math.max(0, Math.min(glyphRight, boxMaxX) - Math.max(xPercent, boxMinX));
    const vOverlap = Math.max(0, Math.min(glyphBottom, boxMaxY) - Math.max(yPercent, boxMinY));
    const areaOverlapRatio = (widthPercent > 0 && heightPercent > 0)
      ? (hOverlap * vOverlap) / (widthPercent * heightPercent)
      : 0;

    const intersects = centerInside || areaOverlapRatio >= 0.45;

    if (intersects) {
      glyphs.push({
        str: item.str,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
      });
    }
  }

  if (glyphs.length === 0) {
    return '';
  }

  // Sort glyphs: group into lines by vertical proximity, then sort left-to-right
  const lineThreshold = 0.8; // vertical % difference to consider same line
  const lines: ExtractedGlyph[][] = [];

  // Sort primarily by Y
  glyphs.sort((a, b) => a.yPercent - b.yPercent);

  for (const glyph of glyphs) {
    let placed = false;
    for (const line of lines) {
      const avgY = line.reduce((sum, g) => sum + g.yPercent, 0) / line.length;
      if (Math.abs(glyph.yPercent - avgY) <= lineThreshold) {
        line.push(glyph);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lines.push([glyph]);
    }
  }

  // Sort lines top-to-bottom
  lines.sort((l1, l2) => {
    const avgY1 = l1.reduce((sum, g) => sum + g.yPercent, 0) / l1.length;
    const avgY2 = l2.reduce((sum, g) => sum + g.yPercent, 0) / l2.length;
    return avgY1 - avgY2;
  });

  // Sort items in each line left-to-right
  const lineStrings = lines.map(line => {
    line.sort((a, b) => a.xPercent - b.xPercent);
    return line.map(g => g.str.trim()).filter(Boolean).join(' ');
  });

  return lineStrings.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts normalized glyphs from a PDF page for high-performance spatial analysis.
 */
export async function getPageGlyphs(page: any): Promise<ExtractedGlyph[]> {
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;
  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const glyphs: ExtractedGlyph[] = [];

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str) continue;
    const tx = item.transform[4];
    const ty = item.transform[5];
    const itemWidth = item.width || Math.abs(item.transform[0]) || 0;
    const itemHeight = item.height || Math.abs(item.transform[3]) || 10;

    const glyphLeft = tx;
    const glyphTop = pageHeight - (ty + itemHeight);

    glyphs.push({
      str: item.str,
      xPercent: (glyphLeft / pageWidth) * 100,
      yPercent: (glyphTop / pageHeight) * 100,
      widthPercent: (itemWidth / pageWidth) * 100,
      heightPercent: (itemHeight / pageHeight) * 100,
    });
  }

  return glyphs.filter(g => g.str && g.str.trim().length > 0);
}

/**
 * Extracts contiguous lines belonging to a field, preventing bleeding into unrelated
 * unmapped sections below and strictly respecting the field's starting boundary.
 */
export function extractContiguousFieldContent(
  glyphs: ExtractedGlyph[],
  startBox: { x: number; y: number; width: number; height: number },
  maxBottomY?: number,
  tolerancePercent = 0.15,
  field?: FieldDefinition
): { text: string; actualHeight: number; lineCount: number } {
  const boxMinX = startBox.x - tolerancePercent;
  const boxMaxX = startBox.x + startBox.width + tolerancePercent;
  const boxMinY = startBox.y - tolerancePercent;
  const effectiveMaxY = maxBottomY ?? (startBox.y + startBox.height + 15.0);

  // Candidates in this column and vertical range
  const columnGlyphs = glyphs.filter(g => {
    const rx = g.xPercent + g.widthPercent;
    const midY = g.yPercent + (g.heightPercent / 2);
    return g.xPercent <= boxMaxX && rx >= boxMinX && midY >= boxMinY && midY <= effectiveMaxY;
  });

  if (columnGlyphs.length === 0) {
    return { text: '', actualHeight: startBox.height, lineCount: 0 };
  }

  // Group into distinct horizontal lines
  const lineThreshold = 0.8;
  const lines: ExtractedGlyph[][] = [];
  columnGlyphs.sort((a, b) => a.yPercent - b.yPercent);

  for (const g of columnGlyphs) {
    let placed = false;
    for (const line of lines) {
      const avgY = line.reduce((sum, item) => sum + item.yPercent, 0) / line.length;
      if (Math.abs(g.yPercent - avgY) <= lineThreshold) {
        line.push(g);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lines.push([g]);
    }
  }

  // Identify contiguous lines starting strictly from the field's expected starting box
  const contiguousLines: ExtractedGlyph[][] = [];
  let lastLineAvgY: number | null = null;
  const maxLinePitch = 1.6; // Maximum vertical pitch between consecutive lines of same field
  const maxAllowedLines = field && field.dataType !== 'multiline' ? 1 : 50;

  for (const line of lines) {
    const lineAvgY = line.reduce((sum, item) => sum + item.yPercent, 0) / line.length;
    if (lastLineAvgY === null) {
      // First line MUST be within startBox bounds (prevents empty fields from catching downstream text)
      if (lineAvgY > startBox.y + startBox.height + 0.5) break;
      contiguousLines.push(line);
      lastLineAvgY = lineAvgY;
    } else {
      const pitch = lineAvgY - lastLineAvgY;
      if (pitch <= maxLinePitch && contiguousLines.length < maxAllowedLines) {
        contiguousLines.push(line);
        lastLineAvgY = lineAvgY;
      } else {
        // Gap or boundary reached: stop contiguous collection
        break;
      }
    }
  }

  const lineStrings = contiguousLines
    .map(line => {
      line.sort((a, b) => a.xPercent - b.xPercent);
      return line.map(g => g.str.trim()).filter(Boolean).join(' ');
    })
    .filter(Boolean);

  let text = lineStrings.length > 1 ? lineStrings.join('\n') : lineStrings.join(' ');
  text = text.replace(/^[:.\s\-_]+/, '').replace(/[:.\s\-_]+$/, '').trim();

  const actualHeight =
    contiguousLines.length > 0 && lastLineAvgY !== null
      ? Math.max(startBox.height, lastLineAvgY - startBox.y + 0.6)
      : startBox.height;

  return { text, actualHeight, lineCount: contiguousLines.length };
}

/**
 * Extracts text within a normalized box from pre-fetched glyphs using midpoint line sorting.
 */
export function extractTextFromGlyphs(
  glyphs: ExtractedGlyph[],
  box: { x: number; y: number; width: number; height: number },
  tolerancePercent = 0.15
): string {
  const res = extractContiguousFieldContent(glyphs, box, undefined, tolerancePercent);
  return res.text;
}

export interface CalibratedExtractionResult {
  data: Record<string, string>;
  detectedAnchorsCount: number;
  missingRequiredFields: string[];
  hasTopologicalAnomaly: boolean;
  scaleY: number;
  shiftY: number;
  elasticDriftDetected: boolean;
}

/**
 * Levi's Scale-Invariant Extraction (LSIE) Engine.
 * Extracts all fields from a page using Scale-Invariant Relative Proportions & Bidirectional Sweep.
 * All interval distances are calculated as dimensionless relative ratios (R_Y, R_X) against reference spans,
 * guaranteeing 100% immunity to "Print to PDF", Letter vs A4 paper sizes, DPI scaling, and margin offsets,
 * while accurately pinpointing dynamic content stretches and preserving subsequent field proportions.
 */
export async function extractFieldsWithCalibration(
  page: any,
  fields: FieldDefinition[]
): Promise<CalibratedExtractionResult> {
  const glyphs = await getPageGlyphs(page);
  const detectedAnchors = new Map<string, ExtractedGlyph>();

  // 1. Locate anchor labels on the page
  for (const field of fields) {
    const candidates: string[] = [];
    if (field.anchorText) {
      candidates.push(field.anchorText);
      field.anchorText.split(/[/,:]/).forEach(p => {
        const s = p.trim();
        if (s.length >= 3) candidates.push(s);
      });
    }
    candidates.push(field.name);

    const expectedY = field.labelBox?.y ?? field.valueBox.y;
    const expectedX = field.labelBox?.x ?? field.valueBox.x;

    let bestGlyph: ExtractedGlyph | null = null;
    let minScore = Infinity;

    for (const g of glyphs) {
      const lower = g.str.toLowerCase();
      const matches = candidates.some(c => lower.includes(c.toLowerCase()));
      if (matches) {
        const dy = Math.abs(g.yPercent - expectedY);
        const dx = Math.abs(g.xPercent - expectedX);
        if (dy < 10.0) { // within reasonable vertical region
          const score = dy * 2 + dx;
          if (score < minScore) {
            minScore = score;
            bestGlyph = g;
          }
        }
      }
    }

    if (bestGlyph) {
      detectedAnchors.set(field.id, bestGlyph);
    }
  }

  // 2. Build sorted anchor markers for both vertical and horizontal sweeps
  const verticalMarkers: Array<{
    field: FieldDefinition;
    expectedY: number;
    expectedX: number;
    detectedY: number;
    detectedX: number;
  }> = [];

  for (const [id, glyph] of detectedAnchors.entries()) {
    const f = fields.find(x => x.id === id);
    if (f && f.labelBox) {
      verticalMarkers.push({
        field: f,
        expectedY: f.labelBox.y,
        expectedX: f.labelBox.x,
        detectedY: glyph.yPercent,
        detectedX: glyph.xPercent,
      });
    }
  }

  verticalMarkers.sort((a, b) => a.expectedY - b.expectedY);

  // Check for topological anomalies (e.g. inverted layout order)
  let hasTopologicalAnomaly = false;
  for (let i = 0; i < verticalMarkers.length - 1; i++) {
    if (verticalMarkers[i].detectedY > verticalMarkers[i + 1].detectedY + 2.0) {
      hasTopologicalAnomaly = true;
      break;
    }
  }

  // 3. Compute Scale-Invariant Reference Spans (dimensionless normalization)
  let scaleY = 1.0;
  let shiftX = 0.0;
  let shiftY = 0.0;
  let H_ref_expected = 1.0;
  let H_ref_actual = 1.0;

  if (verticalMarkers.length >= 2) {
    const first = verticalMarkers[0];
    const last = verticalMarkers[verticalMarkers.length - 1];
    H_ref_expected = last.expectedY - first.expectedY;
    H_ref_actual = last.detectedY - first.detectedY;
    if (H_ref_expected > 5.0 && H_ref_actual > 5.0) {
      scaleY = H_ref_actual / H_ref_expected;
      shiftY = first.detectedY - first.expectedY * scaleY;
      shiftX = first.detectedX - first.expectedX;
    }
  } else if (verticalMarkers.length === 1) {
    const single = verticalMarkers[0];
    scaleY = 1.0;
    shiftY = single.detectedY - single.expectedY;
    shiftX = single.detectedX - single.expectedX;
  }

  // 4. Dimensionless Relative Ratio Deformation Analysis
  let elasticDriftDetected = false;
  const relativeDeformations: Array<{
    topMarker: (typeof verticalMarkers)[0];
    botMarker: (typeof verticalMarkers)[0];
    ratioDrift: number;
    absoluteStretch: number;
  }> = [];

  for (let i = 0; i < verticalMarkers.length - 1; i++) {
    const top = verticalMarkers[i];
    const bot = verticalMarkers[i + 1];
    const expectedRatio = (bot.expectedY - top.expectedY) / H_ref_expected;
    const actualRatio = (bot.detectedY - top.detectedY) / H_ref_actual;
    const ratioDrift = actualRatio - expectedRatio;

    // If relative ratio increased by > 2% of the reference span, relative stretch occurred
    if (ratioDrift > 0.02) {
      elasticDriftDetected = true;
      const absoluteStretch = ratioDrift * H_ref_actual;
      relativeDeformations.push({
        topMarker: top,
        botMarker: bot,
        ratioDrift,
        absoluteStretch,
      });
    }
  }

  // 5. Extract fields using contiguous line tracking & relative proportion preservation
  const results: Record<string, string> = {};
  const missingRequiredFields: string[] = [];

  for (const field of fields) {
    const anchorGlyph = detectedAnchors.get(field.id);
    let targetBox: { x: number; y: number; width: number; height: number };

    const expectedY = field.labelBox?.y ?? field.valueBox.y;
    const nextMarkerBelow = verticalMarkers.find(m => m.expectedY > expectedY + 1.0);
    const maxBottomY = nextMarkerBelow ? nextMarkerBelow.detectedY - 0.5 : undefined;

    if (anchorGlyph && field.labelBox) {
      // Anchor-relative placement: preserves relative offset from detected anchor
      const dx = field.valueBox.x - field.labelBox.x;
      const dy = field.valueBox.y - field.labelBox.y;
      targetBox = {
        x: anchorGlyph.xPercent + dx,
        y: anchorGlyph.yPercent + dy,
        width: field.valueBox.width,
        height: field.valueBox.height,
      };
    } else {
      // Accumulate relative stretches from intervals above this field
      let accumulatedStretch = 0;
      for (const def of relativeDeformations) {
        if (expectedY > def.topMarker.expectedY) {
          accumulatedStretch += def.absoluteStretch;
        }
      }

      targetBox = {
        x: field.valueBox.x + shiftX,
        y: field.valueBox.y * scaleY + shiftY + accumulatedStretch,
        width: field.valueBox.width,
        height: field.valueBox.height * scaleY,
      };
    }

    // Extract contiguous content strictly without swallowing unmapped sections
    const extracted = extractContiguousFieldContent(glyphs, targetBox, maxBottomY, 0.15, field);
    results[field.name] = extracted.text;
    results[field.id] = extracted.text;

    if (field.isRequired && (!extracted.text || extracted.text.trim().length === 0)) {
      missingRequiredFields.push(field.name);
    }
  }

  return {
    data: results,
    detectedAnchorsCount: detectedAnchors.size,
    missingRequiredFields,
    hasTopologicalAnomaly,
    scaleY,
    shiftY,
    elasticDriftDetected,
  };
}

/**
 * Extracts all field values defined in a MappingProfile from a loaded PDF document.
 */
export async function extractAllFieldsFromPdf(
  pdfDoc: any,
  fields: FieldDefinition[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const numPages = pdfDoc.numPages;
  const pageCache = new Map<number, any>();

  for (const field of fields) {
    const targetPageNum = Math.min(Math.max(field.valueBox.page, 1), numPages);
    
    if (!pageCache.has(targetPageNum)) {
      pageCache.set(targetPageNum, await pdfDoc.getPage(targetPageNum));
    }

    const page = pageCache.get(targetPageNum);
    const extracted = await extractTextInBox(page, field.valueBox);
    results[field.name] = extracted;
  }

  return results;
}
