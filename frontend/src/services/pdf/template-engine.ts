import { PDFDocument } from 'pdf-lib';
import JsBarcode from 'jsbarcode';
import { CMRData } from '../../modules/cmr/types';
import { SHIPMENT_DOC_TEMPLATE_BASE64 } from './assets';

export const generateShipmentDocsPdf = async (data: CMRData): Promise<Uint8Array> => {
    // 1. Load the template
    // We need to clean whitespace from the base64 string
    const cleanBase64 = SHIPMENT_DOC_TEMPLATE_BASE64.replace(/\s/g, '');
    const pdfDoc = await PDFDocument.load(cleanBase64);

    // 2. Fill the form
    const form = pdfDoc.getForm();
    const shipmentLastPart = data.shipment ? data.shipment.split('-').pop() : '';

    try {
        // Mapping as per reference app
        const safeSetText = (fieldName: string, value: string | undefined) => {
            try {
                form.getTextField(fieldName).setText(value || '');
            } catch (e) {
                console.warn(`Field ${fieldName} not found in template.`);
            }
        };

        safeSetText('shipment_number', shipmentLastPart);
        safeSetText('consignment_number', data.consignments);
        safeSetText('transport_identification', data.trailer);
        safeSetText('seal_number', data.seal);
        safeSetText('planned_arrival', `${data.est_arrival_date || ''} ${data.est_arrival_time || ''}`.trim());
        safeSetText('actual_arrival', data.est_arrival_date);
        safeSetText('container_number', data.trailer); // Often same as transport ID
        safeSetText('shipment_manifest', shipmentLastPart);
        safeSetText('inspection_completed', data.est_arrival_date);
        safeSetText('carrier_id', data.trailer ? `Carrier Id: ${data.trailer}` : '');

        form.flatten();
    } catch (e) {
        console.error('Error filling PDF form:', e);
        throw e;
    }

    // 3. Generate and Embed Barcode
    if (data.shipment) {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, data.shipment, {
                format: "CODE128",
                width: 2,
                height: 100,
                displayValue: true
            });
            const barcodeDataUrl = canvas.toDataURL('image/png');
            const barcodeImageBytes = await fetch(barcodeDataUrl).then(res => res.arrayBuffer());
            const barcodeImage = await pdfDoc.embedPng(barcodeImageBytes);

            const pages = pdfDoc.getPages();
            // Reference logic: page 3 or last page
            const targetPage = pages.length >= 3 ? pages[2] : pages[pages.length - 1];

            // Coordinates from reference: x=95, y=560, w=410, h=170 (units likely match PDF coordinate system)
            // Note: pdf-lib uses points (1/72 inch). Reference app comments said "mm" for logic but used raw numbers.
            // We'll stick to the raw numbers 95, 560 as they likely map to the specific template's coordinate space.
            targetPage.drawImage(barcodeImage, {
                x: 95,
                y: 560,
                width: 410,
                height: 170
            });
        } catch (e) {
            console.error('Error generating/embedding barcode:', e);
            // Non-critical, continue
        }
    }

    // 4. Return bytes
    return await pdfDoc.save();
};
