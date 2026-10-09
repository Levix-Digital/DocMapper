import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { DestinationFieldMapping, FieldDefinition } from '../../types/mapping';

/**
 * Converts a data URL (image/png) to Uint8Array for pdf-lib embedding.
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a Code 128 barcode as PNG bytes safely.
 */
function generateBarcodePng(value: string): Uint8Array | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return dataUrlToUint8Array(canvas.toDataURL('image/png'));
  } catch (err) {
    console.warn('Barcode generation failed for value:', value, err);
    return null;
  }
}

/**
 * Generates a 2D QR Code as PNG bytes safely.
 */
async function generateQrCodePng(value: string): Promise<Uint8Array | null> {
  try {
    const dataUrl = await QRCode.toDataURL(value, {
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.warn('QR Code generation failed for value:', value, err);
    return null;
  }
}

export interface StampOptions {
  templatePdfBytes?: ArrayBuffer | Uint8Array | string | null;
  mappings: DestinationFieldMapping[];
  fields: FieldDefinition[];
  extractedValues: Record<string, string>;
}

/**
 * Stamps extracted values onto a destination PDF template at mapped coordinates,
 * or generates a clean document if no template is supplied.
 */
export async function stampDestinationPdf(options: StampOptions): Promise<Uint8Array> {
  const { templatePdfBytes, mappings, fields, extractedValues } = options;

  let pdfDoc: PDFDocument;

  if (templatePdfBytes && (typeof templatePdfBytes === 'string' ? templatePdfBytes.length > 50 : true)) {
    let cleanBytes: Uint8Array;
    if (typeof templatePdfBytes === 'string') {
      const base64Clean = templatePdfBytes.includes(',') ? templatePdfBytes.split(',')[1] : templatePdfBytes;
      cleanBytes = dataUrlToUint8Array(base64Clean);
    } else if (templatePdfBytes instanceof ArrayBuffer) {
      cleanBytes = new Uint8Array(templatePdfBytes);
    } else {
      cleanBytes = templatePdfBytes;
    }
    pdfDoc = await PDFDocument.load(cleanBytes);
  } else {
    // Generate clean A4 standalone document
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595.28, 841.89]);
  }

  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Flatten any AcroForm fields cleanly to prevent interactive widgets or duplicate values
  // from conflicting with or double-rendering over the visual coordinate mappings.
  try {
    const form = pdfDoc.getForm();
    form.flatten();
  } catch (_) {
    // Non-acroform template, proceed to visual coordinate stamping
  }

  // Map fields by id and name for quick lookup
  const fieldById = new Map<string, FieldDefinition>();
  const fieldByName = new Map<string, FieldDefinition>();
  for (const f of fields) {
    fieldById.set(f.id, f);
    fieldByName.set(f.name, f);
  }

  for (const mapping of mappings) {
    const field = fieldById.get(mapping.fieldId);
    if (!field) continue;

    // Resolve value (by field name or id)
    const rawValue = extractedValues[field.name] ?? extractedValues[field.id] ?? '';
    const value = rawValue.trim();
    if (!value) continue;

    const pageIndex = Math.min(Math.max((mapping.targetBox.page || 1) - 1, 0), pages.length - 1);
    const targetPage = pages[pageIndex];

    const pageWidth = targetPage.getWidth();
    const pageHeight = targetPage.getHeight();

    // Convert normalized percentages to points
    const boxX = (mapping.targetBox.x / 100) * pageWidth;
    const boxWidth = (mapping.targetBox.width / 100) * pageWidth;
    const boxHeight = (mapping.targetBox.height / 100) * pageHeight;
    const boxTop = (mapping.targetBox.y / 100) * pageHeight;
    // In pdf-lib, y=0 is at page bottom
    const boxBottomY = pageHeight - (boxTop + boxHeight);

    try {
      if (mapping.renderFormat === 'CODE128') {
        const barcodeBytes = generateBarcodePng(value);
        if (barcodeBytes) {
          const barcodeImage = await pdfDoc.embedPng(barcodeBytes);
          targetPage.drawImage(barcodeImage, {
            x: boxX,
            y: boxBottomY,
            width: boxWidth,
            height: boxHeight,
          });
        }
      } else if (mapping.renderFormat === 'QR_CODE') {
        const qrBytes = await generateQrCodePng(value);
        if (qrBytes) {
          const qrImage = await pdfDoc.embedPng(qrBytes);
          const size = Math.min(boxWidth, boxHeight);
          const offsetX = (boxWidth - size) / 2;
          const offsetY = (boxHeight - size) / 2;
          targetPage.drawImage(qrImage, {
            x: boxX + offsetX,
            y: boxBottomY + offsetY,
            width: size,
            height: size,
          });
        }
      } else {
        // Render as plain text with dynamic auto-fit font sizing
        let fontSize = mapping.fontSize || 11;
        const minFontSize = 7;
        const maxFontSize = 14;
        fontSize = Math.min(Math.max(fontSize, minFontSize), maxFontSize);

        let textWidth = font.widthOfTextAtSize(value, fontSize);
        while (textWidth > boxWidth && fontSize > minFontSize) {
          fontSize -= 0.5;
          textWidth = font.widthOfTextAtSize(value, fontSize);
        }

        const fontHeight = font.heightAtSize(fontSize);
        const verticalPadding = Math.max((boxHeight - fontHeight) / 2, 2);

        targetPage.drawText(value, {
          x: boxX + 2,
          y: boxBottomY + verticalPadding,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: boxWidth - 4,
        });
      }
    } catch (err) {
      console.warn(`Failed to stamp field ${field.name}:`, err);
    }
  }

  // If this was a blank generated document with no mappings, draw a default layout
  if (!templatePdfBytes && mappings.length === 0) {
    const page = pages[0];
    page.drawText('Transport & Delivery Note', {
      x: 50,
      y: 790,
      size: 20,
      font,
      color: rgb(0.1, 0.1, 0.2),
    });

    let currentY = 740;
    for (const [key, val] of Object.entries(extractedValues)) {
      if (key.startsWith('field-') || !val) continue;
      page.drawText(`${key}:`, {
        x: 50,
        y: currentY,
        size: 11,
        font,
        color: rgb(0.2, 0.2, 0.3),
      });
      page.drawText(val, {
        x: 200,
        y: currentY,
        size: 11,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      currentY -= 25;
    }
  }

  return await pdfDoc.save();
}
