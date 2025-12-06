import { DocumentParser } from "./interfaces/DocumentParser";
import { CMRParser } from "./parsers/cmr";

export function processDocument(docType: string, content: string): string {
    // Strategy Pattern Factory
    let strategy: DocumentParser | null = null;

    if (docType == "CMR") {
        strategy = new CMRParser();
    } else if (docType == "BOL") {
        // strategy = new BOLParser();
        return '{"status": "placeholder", "content": "BOL Not Implemented Yet"}';
    }

    if (strategy != null) {
        return strategy.parse(content);
    }

    return '{"error": "Unknown Document Type"}';
}
