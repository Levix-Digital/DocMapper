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
  tolerancePercent = 1.0
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

    const glyphRight = xPercent + widthPercent;
    const glyphBottom = yPercent + heightPercent;

    // Overlap / intersection check with tolerance
    const intersects =
      xPercent <= boxMaxX &&
      glyphRight >= boxMinX &&
      yPercent <= boxMaxY &&
      glyphBottom >= boxMinY;

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
  const lineThreshold = 1.2; // vertical % difference to consider same line
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
