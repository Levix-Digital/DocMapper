export class Scanner {
    source: string;
    cursor: i32;

    constructor(source: string) {
        this.source = source;
        this.cursor = 0;
    }

    // Find first occurrence of 'needle' starting from current cursor
    // Returns true if found and advances cursor to end of needle
    // Returns false if not found (cursor unchanged)
    scanTo(needle: string): boolean {
        const idx = this.source.indexOf(needle, this.cursor);
        if (idx != -1) {
            this.cursor = idx + needle.length;
            return true;
        }
        return false;
    }

    // Capture characters until one of the delimiters is found
    // Delimiters is a string of characters, e.g. " \n\r"
    captureUntil(delimiters: string): string {
        const start = this.cursor;
        let end = start;
        const len = this.source.length;

        while (end < len) {
            const char = this.source.charAt(end);
            if (delimiters.includes(char)) {
                break;
            }
            end++;
        }

        this.cursor = end;
        return this.source.slice(start, end);
    }

    // New method: captureUntilPattern - stop when a pattern is seen?
    // For now simple delimiters are enough for Seal/Shipment
}
