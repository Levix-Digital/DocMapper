export function removeSpaces(text: string): string {
    return text.replaceAll(" ", "");
}

export function extractCurrency(text: string): string {
    return text.trim();
}
