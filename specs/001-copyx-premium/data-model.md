# Data Model

## Core Interfaces

### DocumentModule
The contract that every document type (CMR, BOL, etc.) must implement.

```typescript
interface DocumentModule {
  id: string; // e.g., 'cmr-v1'
  name: string; // e.g., 'CMR Note'
  
  // Logic
  extractor: Extractor;
  validator: Validator;
  exporter: Exporter;
  
  // UI
  FormComponent: Component; // Vue component for the form
  TemplateComponent: Component; // Vue component for the PDF overlay
}
```

### ShipmentData
The normalized data structure extracted from a document.

```typescript
interface ShipmentData {
  id: string;
  sourceDocumentId: string;
  extractedAt: Date;
  fields: Record<string, any>; // Key-value pairs of extracted data
  confidence: Record<string, number>; // Confidence score per field
}
```

## Storage Entities (IndexedDB / Dexie)

### ExtractionProfile
Learned corrections for specific issuers.

```typescript
interface ExtractionProfile {
  id: string; // UUID
  issuerName: string; // e.g., "DHL Logistics"
  issuerKeywords: string[]; // Keywords to auto-detect this issuer
  
  // Field Mappings
  mappings: {
    fieldKey: string; // e.g., "sender_address"
    rect: { x: number, y: number, w: number, h: number }; // Location on PDF
    correctionHistory: string[]; // Last known good values
  }[];
  
  lastUsed: Date;
}
```

### CompanyProfile
User's organization details.

```typescript
interface CompanyProfile {
  id: string; // UUID
  name: string;
  address: string;
  vatNumber?: string;
  logoUrl?: string; // Data URL or local blob URL
  
  // Defaults
  defaultIncoterms?: string;
  defaultPlace?: string;
  
  // Sync
  isSynced: boolean;
  lastModified: Date;
}
```

### UserPreferences
Local app settings.

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultAiProvider: 'openai' | 'none';
  openaiApiKey?: string; // Stored locally ONLY
  enableTrackingQr: boolean;
}
```
