/**
 * Core type definitions for Visual Mapping Studio & LLM Pattern Extraction.
 * Normalized coordinates are stored as percentages (0 - 100) relative to page dimensions.
 */

export interface BoundingBox {
  /** X coordinate as percentage from left (0 - 100) */
  x: number;
  /** Y coordinate as percentage from top (0 - 100) */
  y: number;
  /** Width as percentage of page width (0 - 100) */
  width: number;
  /** Height as percentage of page height (0 - 100) */
  height: number;
  /** 1-indexed page number */
  page: number;
}

export type FieldDataType = 'text' | 'alphanumeric' | 'date' | 'number' | 'multiline';

export interface FieldDefinition {
  id: string;
  name: string;
  color: string;
  /** Optional bounding box for the field anchor label */
  labelBox?: BoundingBox;
  /** Optional text captured from the anchor label */
  anchorText?: string;
  /** Bounding box where the field value is extracted */
  valueBox?: BoundingBox;
  /** Deterministic regex pattern for format validation */
  validationPattern: string;
  /** Semantic data type */
  dataType: FieldDataType;
  /** Whether extraction must strictly find a non-empty value */
  isRequired: boolean;
  /** Last extracted sample value on setup canvas */
  sampleExtractedValue?: string;
}

export type RenderFormat = 'TEXT' | 'CODE128' | 'QR_CODE';

export type HorizontalAlignment = 'left' | 'center' | 'right';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';
export type DestinationMappingSourceType = 'field' | 'custom';

export interface DestinationFieldMapping {
  id: string;
  /** 'field' if bound to origin field, 'custom' if static text */
  sourceType?: DestinationMappingSourceType;
  /** Refers to FieldDefinition.id (when sourceType is 'field') */
  fieldId?: string | null;
  /** Static or custom literal text (when sourceType is 'custom') */
  customText?: string;
  /** Text prefix prepended before the value */
  prefix?: string;
  /** Text suffix appended after the value */
  suffix?: string;
  /** Target placement box on destination template */
  targetBox: BoundingBox;
  /** Render format: plain text, 1D Code128, or 2D QR */
  renderFormat: RenderFormat;
  /** Optional manual font size (otherwise auto-fit 8 - 14pt) */
  fontSize?: number;
  /** Horizontal alignment inside bounding box ('left' | 'center' | 'right') */
  horizontalAlign?: HorizontalAlignment;
  /** Vertical alignment inside bounding box ('top' | 'middle' | 'bottom') */
  verticalAlign?: VerticalAlignment;
}

export interface MappingProfile {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  fields: FieldDefinition[];
  /** Destination PDF template serialized as Base64 string */
  destinationTemplateBase64?: string;
  destinationTemplateName?: string;
  destinationMappings: DestinationFieldMapping[];
}

export interface ExtractionResult {
  documentIndex: number;
  fileName: string;
  extractedData: Record<string, string>;
  confidenceScores: Record<string, number>;
  overallConfidence: number;
  status: 'APPROVED' | 'FAILED';
  pdfBlob?: Blob;
  errorMessage?: string;
}

export interface GeminiPatternResponse {
  regex: string;
  dataType: FieldDataType;
  sampleMatch: boolean;
  explanation: string;
}
