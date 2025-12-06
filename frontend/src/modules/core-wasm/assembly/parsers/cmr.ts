import { DocumentParser } from "../interfaces/DocumentParser";
import { Scanner } from "../utils/scanner";

export class CMRParser implements DocumentParser {
    parse(content: string): string {
        let seal: string = "";
        let shipment: string = "";
        let trailer: string = "";
        let consignments: string = "";

        // 1. Seal
        // Look for "Seal" or "Plombe" or "Plomb"
        // Logic: Try to find "Seal", then look for next non-whitespace token
        let scanner = new Scanner(content);
        if (scanner.scanTo("Seal")) {
            // Skip potential separator like ':', ' ', '.', '/'
            // We just verify if we are near "Plombe / Seal / Plomb" structure
            // Simplified: Just extract the next alphanumeric token after "Seal" + some chars
            scanner.scanTo(":"); // Try to find colon
            // Consume whitespace
            const token = this.extractNextToken(scanner);
            if (token.length > 3) seal = token;
        }
        // Fallback if not found via "Seal", try "Plomb"
        if (seal == "") {
            scanner = new Scanner(content);
            if (scanner.scanTo("Plomb")) {
                scanner.scanTo(":");
                const token = this.extractNextToken(scanner);
                if (token.length > 3) seal = token;
            }
        }

        // 2. Shipment
        // "Shipment:"
        scanner = new Scanner(content);
        if (scanner.scanTo("Shipment:")) {
            shipment = this.extractNextToken(scanner);
        }

        // 3. Trailer
        // "trailer" (case insensitive? AS indexOf is case sensitive).
        // content should probably be lowercased? AS toLowerCase() creates copy.
        // For MVP we assume standard casing or check multiple.
        scanner = new Scanner(content);
        if (scanner.scanTo("trailer")) {
            scanner.scanTo(":"); // Optional
            trailer = this.extractNextToken(scanner);
        } else {
            // Try Title Case
            scanner = new Scanner(content);
            if (scanner.scanTo("Trailer")) {
                scanner.scanTo(":");
                trailer = this.extractNextToken(scanner);
            }
        }

        // 4. Consignments
        // "Consignments:"
        scanner = new Scanner(content);
        if (scanner.scanTo("Consignments:")) {
            consignments = "MULTI";
        }

        // Build JSON
        let json = "{";
        json += "\"seal\": \"" + seal + "\",";
        json += "\"shipment\": \"" + shipment + "\",";
        json += "\"trailer\": \"" + trailer + "\",";
        json += "\"consignments\": \"" + consignments + "\"";
        json += "}";

        return json;
    }

    // Helper to skip whitespace and grab next token
    private extractNextToken(scanner: Scanner): string {
        // Manually skip whitespace (space, tab, colon, dot, slash if needed)
        // We loop until we find alphanumeric?
        // For MVP: just skip non-alphanumeric?

        const source = scanner.source;
        let i = scanner.cursor;
        const len = source.length;

        // forward loop to skip junk
        while (i < len) {
            const code = source.charCodeAt(i);
            // Check if char is A-Z, 0-9, or -
            // A-Z: 65-90, a-z: 97-122, 0-9: 48-57, -: 45
            if (this.isAlphaNumeric(code)) {
                break;
            }
            i++;
        }
        scanner.cursor = i;

        // Now capture until space or newline
        return scanner.captureUntil(" \n\r\t");
    }

    private isAlphaNumeric(code: i32): boolean {
        if (code >= 48 && code <= 57) return true; // 0-9
        if (code >= 65 && code <= 90) return true; // A-Z
        if (code >= 97 && code <= 122) return true; // a-z
        if (code == 45) return true; // -
        return false;
    }
}
