export interface FormatFileNameOptions {
  pattern?: string;
  originalFileName: string;
  extractedData: Record<string, string>;
  docIndex: number;
  totalDocs?: number;
}

/**
 * Evaluates dynamic file naming tokens based on profile configuration:
 * Supports tokens: {originalName}, {index}, {seq:001}, {date}, and any extracted field name {FieldName}.
 * Strips invalid filesystem characters and guarantees .pdf extension.
 */
export function formatOutputFileName(options: FormatFileNameOptions): string {
  const { pattern, originalFileName, extractedData, docIndex } = options;
  const baseOriginalName = originalFileName.replace(/\.[^/.]+$/, '').trim();
  const index = docIndex + 1;
  const dateStr = new Date().toISOString().split('T')[0];

  let raw = pattern?.trim() || '';

  if (!raw) {
    // Default fallback: OriginalName_001.pdf
    raw = `${baseOriginalName}_${String(index).padStart(3, '0')}`;
  } else {
    // 1. Replace special token {originalName}
    raw = raw.replace(/\{originalName\}/gi, baseOriginalName);

    // 2. Replace {seq} or {seq:001} or {seq:3} (dynamic zero-padding)
    raw = raw.replace(/\{seq(?::([0-9]+))?\}/gi, (_, width) => {
      let padLen = 3;
      if (width) {
        if (width.startsWith('0')) {
          padLen = width.length;
        } else {
          padLen = parseInt(width, 10) || 3;
        }
      }
      return String(index).padStart(padLen, '0');
    });

    // 3. Replace {index} (1-based integer)
    raw = raw.replace(/\{index\}/gi, String(index));

    // 4. Replace {date}
    raw = raw.replace(/\{date\}/gi, dateStr);

    // 5. Replace dynamic field tokens {Field Name} or {field-id}
    raw = raw.replace(/\{([^}]+)\}/g, (_, token) => {
      const trimmed = token.trim();
      // Direct match
      if (extractedData[trimmed] !== undefined && extractedData[trimmed].trim() !== '') {
        return extractedData[trimmed].trim();
      }
      // Case-insensitive match
      const matchedKey = Object.keys(extractedData).find(
        k => k.toLowerCase() === trimmed.toLowerCase()
      );
      if (matchedKey && extractedData[matchedKey] && extractedData[matchedKey].trim() !== '') {
        return extractedData[matchedKey].trim();
      }
      // If field not found or empty, return empty string
      return '';
    });
  }

  // Remove illegal characters for filesystems: \ / : * ? " < > |
  let sanitized = raw
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading/trailing underscores and dots
  sanitized = sanitized.replace(/^[_.\s]+|[_.\s]+$/g, '');

  if (!sanitized) {
    sanitized = `${baseOriginalName}_${String(index).padStart(3, '0')}`;
  }

  return sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}
