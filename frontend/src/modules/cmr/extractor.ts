import { CMRData } from './types';

export const extractCMRData = (text: string): CMRData => {
    const data: Partial<CMRData> = {};

    // 1. Seal Number
    // Fallback: allow for any whitespace, dot, or colon between label and number
    const sealMatch = text.match(/Plombe\s*\/\s*Seal\s*\/\s*Plomb\s*\.?\s*:? *([A-Z0-9\-]+)?/i) ||
        text.match(/Plombe\s*\/\s*Seal\s*\/\s*Plomb\s*\.\s*:\s*\W?([A-Z0-9\-]+)?/i);

    if (sealMatch) {
        data.seal = sealMatch[1]?.trim();
        text = text.replace(sealMatch[0], '');
    }

    // 2. Shipment
    const shipmentMatch = text.match(/Shipment:\s*([A-Za-z0-9\-]+)/i);
    if (shipmentMatch) {
        data.shipment = shipmentMatch[1];
        text = text.replace(shipmentMatch[0], '');
    }

    // 3. Consignments
    const consignmentsPattern = /Consignments:(\s+[0-9]+-[a-zA-Z]+-[0-9a-zA-Z]+)+/g;
    const consignmentsMatches = [...text.matchAll(consignmentsPattern)];

    if (consignmentsMatches.length > 0) {
        const consignments = consignmentsMatches
            .flatMap(m => m[0].trim().split(/\s+/))
            .slice(1);

        data.consignments = consignments.length > 1 ? 'MULTI' : consignments.join(', ');

        for (const match of consignmentsMatches) {
            text = text.replace(match[0], '');
        }
    }

    // 4. Est. Arrival Date and Time
    const estArrivalMatch = text.match(/Est\.?\s*Arrival\(Orig\.\)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/i);
    if (estArrivalMatch) {
        data.est_arrival_date = estArrivalMatch[1];
        data.est_arrival_time = estArrivalMatch[2];
        text = text.replace(estArrivalMatch[0], '');
    }

    // 5. Trailer Extraction
    const trailerPatterns = [
        '\\b([A-Z]{3,}\\d{4,}BIOS)\\b',
        '\\b(\\d{4,}\\s*BIOS)\\b',
        '\\b(\\d{4,}BIOS)\\b',
        '\\b(\\d{4,}\\s*BISON)\\b',
        '\\b(\\d{4,}BISON)\\b',
        '\\b([A-Z]\\d{3,}\\s*BISON)\\b',
        '\\b(\\d?[A-Z]\\d{3,}\\s*BISON)\\b',
        '(?:trailer|container|anhänger|remorque):?\\s*([A-Z0-9]{6,})(?=\\s|$)'
    ];

    if (!data.trailer) {
        const normalizedText = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ');
        for (const pattern of trailerPatterns) {
            const trailerMatch = normalizedText.match(new RegExp(pattern, 'i'));
            if (trailerMatch) {
                const candidate = trailerMatch[1].trim();
                if (candidate !== data.seal) {
                    data.trailer = candidate;
                    text = text.replace(trailerMatch[0], '');
                    break;
                }
            }
        }
    }

    return data as CMRData;
};
