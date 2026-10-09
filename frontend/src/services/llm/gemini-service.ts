import type { GeminiPatternResponse, FieldDataType, FieldDefinition } from '../../types/mapping';

const API_KEY_STORAGE_KEY = 'copyx_gemini_api_key';
const MODEL_STORAGE_KEY = 'copyx_gemini_model';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface GeminiModelInfo {
  id: string;
  name: string;
  tag: string;
  description: string;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    tag: 'Econômico & Rápido ($0.30/1M)',
    description: 'Ultra-econômico e veloz para extração e geração de regex.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tag: 'Padrão Google 3.x',
    description: 'Modelo de alta precisão para regras e formatos complexos.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tag: 'Compatibilidade 2.5',
    description: 'Alternativa da família 2.5 para contas legadas.',
  },
];

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

export function setStoredApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  }
}

export function getStoredModel(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL;
  return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL;
}

export function setStoredModel(model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MODEL_STORAGE_KEY, model.trim());
  }
}

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

export interface PatternGenerationRequest {
  fieldName: string;
  sampleValue: string;
  labelContext?: string;
  apiKey?: string;
  model?: string;
}

/**
 * Calls Google Gemini (prioritizing budget-friendly gemini-3.5-flash-lite with automated fallback chain)
 * to generate a deterministic regex format mask and semantic data type based on field name and sample text.
 * Strictly used during setup; never invoked during batch production runs.
 */
export async function generateValidationPattern(
  request: PatternGenerationRequest
): Promise<GeminiPatternResponse> {
  const { fieldName, sampleValue, labelContext, apiKey, model: explicitModel } = request;
  const key = apiKey?.trim() || getStoredApiKey();

  if (!key) {
    throw new Error(
      'Google Gemini API key não configurada. Por favor, clique no botão "Configurar Chave" (🔑) para inserir sua chave.'
    );
  }

  const prompt = `You are an expert document parser specializing in logistics and commercial documents (CMRs, delivery notes, manifests).
Analyze this extracted field and generate a deterministic format validation regular expression.

Field Label/Name: "${fieldName}"
Sample Extracted Value: "${sampleValue}"
${labelContext ? `Surrounding Anchor Text: "${labelContext}"` : ''}

Rules:
1. Provide a precise regex pattern anchored with ^ and $ (e.g., "^[0-9]{3}-[A-Z]{3}-[0-9]{4}$" or "^[0-9A-Za-z\\-_/]+$").
2. The regex MUST successfully match the sample value "${sampleValue}".
3. Select the best dataType from: "text", "alphanumeric", "date", "number", "multiline".
4. Return ONLY valid JSON adhering strictly to this format:
{
  "regex": "^...$",
  "dataType": "alphanumeric",
  "sampleMatch": true,
  "explanation": "Short 1-sentence description of the format rule"
}`;

  const preferredModel = explicitModel || getStoredModel();
  const modelsToTry = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  let response: Response | null = null;
  let lastErrorMessage = '';

  for (const currentModel of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(key)}`;
    console.log(`[Copyx Gemini] Chamando Google Generative AI (${currentModel})...`, {
      fieldName,
      sampleValue,
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) {
        response = res;
        console.log(`[Copyx Gemini] Sucesso com modelo ${currentModel}!`);
        break;
      }

      const errorBody = await res.text();
      console.warn(`[Copyx Gemini] Modelo ${currentModel} retornou ${res.status}:`, errorBody);
      let errMsg = `Gemini API error (${res.status}): ${res.statusText}`;
      try {
        const parsedErr = JSON.parse(errorBody);
        if (parsedErr.error?.message) {
          errMsg = parsedErr.error.message;
        }
      } catch {}

      lastErrorMessage = errMsg;

      // If model not found or deprecated, try next in chain
      if (
        res.status === 404 ||
        errMsg.toLowerCase().includes('no longer available') ||
        errMsg.toLowerCase().includes('not found')
      ) {
        continue;
      }

      // If other error (e.g. invalid API key, quota limit), don't try other models, fail immediately with clear message
      throw new Error(errMsg);
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('404') ||
          err.message.toLowerCase().includes('no longer available') ||
          err.message.toLowerCase().includes('not found'))
      ) {
        lastErrorMessage = err.message;
        continue;
      }
      throw err;
    }
  }

  if (!response || !response.ok) {
    throw new Error(lastErrorMessage || 'Não foi possível conectar a nenhum modelo Gemini disponível.');
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error('Failed to parse Gemini response as JSON: ' + rawText);
  }

  const regexPattern = parsed.regex || '.+';
  const localTest = testRegexPattern(regexPattern, sampleValue);

  return {
    regex: regexPattern,
    dataType: (['text', 'alphanumeric', 'date', 'number', 'multiline'].includes(parsed.dataType)
      ? parsed.dataType
      : 'text') as FieldDataType,
    sampleMatch: localTest.matches,
    explanation: parsed.explanation || 'Validation pattern generated by Gemini.',
  };
}

/**
 * Renders a PDF page to a base64 JPEG image in memory for Gemini Vision analysis.
 */
export async function renderPageToJpegBase64(page: any, scale = 1.5): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas rendering is only available in browser environments.');
  }
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D canvas context for PDF rendering');

  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return dataUrl.split(',')[1] || dataUrl;
}

/**
 * Transparent AI Rescue: Calls Gemini Vision to extract fields directly from the page image
 * when deterministic extraction encounters a severe layout anomaly, missing anchors, or scanned documents.
 */
export async function extractDocumentViaVision(
  page: any,
  fields: FieldDefinition[],
  apiKey?: string
): Promise<Record<string, string>> {
  const key = apiKey?.trim() || getStoredApiKey();
  if (!key) {
    throw new Error('Gemini API key is not configured for Vision rescue.');
  }

  const imageBase64 = await renderPageToJpegBase64(page, 1.5);

  const fieldDescriptions = fields
    .map(
      f =>
        `- "${f.name}" (ID: "${f.id}"): ${f.anchorText ? `near label "${f.anchorText}"` : ''} - DataType: ${f.dataType}, Required: ${f.isRequired}`
    )
    .join('\n');

  const prompt = `You are an expert document extraction AI specializing in logistics, transport, and freight documents (CMRs, delivery notes, bills of lading).
Analyze the provided document image and extract the following requested fields accurately:
${fieldDescriptions}

CRITICAL INSTRUCTIONS:
1. For multi-line or list fields (like "Consignment Number" or goods descriptions), extract ALL codes/lines present in that section. Join multiple codes with a newline.
2. If a field value is not found or empty in the document, return an empty string "" for that field ID.
3. Return ONLY a valid, raw JSON object mapping each field ID to its extracted string value. Do NOT include markdown backticks or commentary.
Example output format:
{
  "field-shipment": "015-TSO-S10000430442",
  "field-seal": "KSM1012290",
  "field-consignments": "23422-SUP-ECIS8459",
  "field-transport-id": "EMHU200739"
}`;

  const modelsToTry = [getStoredModel(), 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'];
  const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean)));

  let lastError = '';
  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        lastError = errJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed: Record<string, string> = JSON.parse(rawText);
      const results: Record<string, string> = {};

      for (const field of fields) {
        const val = (parsed[field.id] ?? parsed[field.name] ?? '').toString().trim();
        results[field.name] = val;
        results[field.id] = val;
      }

      return results;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  throw new Error(`Gemini Vision extraction failed across fallback models: ${lastError}`);
}
