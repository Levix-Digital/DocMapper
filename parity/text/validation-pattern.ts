// Frozen reference copy for the parity module `text` (ADR-0003): the function
// below is copied unchanged from frontend/src/services/llm/gemini-service.ts at commit f38b9e9.
// Do not edit: the application code is the reference until the module switches.

/**
 * Safely tests a regex pattern against a candidate sample string.
 */
export function testRegexPattern(pattern: string, candidate: string): { matches: boolean; error?: string } {
  try {
    const regex = new RegExp(pattern);
    return { matches: regex.test(candidate) };
  } catch (err: any) {
    return { matches: false, error: err?.message || 'Invalid regular expression syntax' };
  }
}
