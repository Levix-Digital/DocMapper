# Specification: LLM-Powered Pattern Extraction

## 1. Overview
This feature introduces a new method for data extraction using Large Language Models (LLM) to generate robust Regex patterns during the mapping phase. This replaces/augments the current region-based OCR approach, offering higher accuracy for extracting data completely from full-page text.

## 2. Motivation
- **Accuracy**: Region-based OCR is brittle to layout shifts. Full-page text extraction is more reliable.
- **Flexibility**: Regex patterns can handle variations in spacing and format better than fixed coordinates.
- **Performance**: While the mapping phase uses a slow LLM, the runtime extraction uses fast Regex matching.

## 3. User Flows

### 3.1. Field Mapping (Setup Phase)
1.  **New Mapping Page**: The user navigates to a new "Mapping" page.
2.  **Upload Sample**: User uploads a sample document (e.g., CMR PDF).
3.  **UI Interaction**:
    - The document is displayed.
    - User uses a drag-and-drop interface to draw boxes defining a **Label** and a **Value**.
    - Both boxes share a color code but are visually distinct.
    - Together, they form a "Field" (e.g., "Invoice Number").
4.  **Pattern Generation**:
    - The system extracts the full text of the page.
    - The system sends the text and the user's selected Label/Value content to an LLM.
    - The LLM analyzes the context and generates a precise Regex pattern (e.g., `Invoice #[:\s]*([A-Z0-9-]+)`).
5.  **Verification**:
    - The generated pattern is immediately tested against the sample document text.
    - The match result is shown to the user.
6.  **Save**: The pattern is saved associated with the field name.

### 3.2. Destination Mapping (Template Setup)
1.  **Upload Template**: User uploads the destination document (PDF/Image) where data should be placed.
2.  **UI Interaction**:
    - User draws boxes on the destination document.
    - Each box is linked to one of the extracted fields defined in the previous step.
3.  **Save**:
    - The mapping configuration is saved (coordinates, field associations).
    - The destination template is stored (e.g., Base64 encoded).

### 3.3. Runtime Extraction (Application)
1.  **Input**: A new document document is processed.
2.  **Extraction**: The system extracts the full text of the document (once).
3.  **Pattern Matching**: The system iterates through saved fields and applies their corresponding Regex patterns to the full text.
4.  **Result**: Values are extracted and ready for placement on the destination doc.

## 4. Technical Requirements

### 4.1. Frontend
- **New Route**: `/mapping` (or similar).
- **Components**:
    - PDF/Image Viewer with Canvas overlay for drawing boxes.
    - Tools for creating "Label" and "Value" pairs.
    - Visual feedback for LLM processing status.
    - Regex test result display.
- **State Management**:
    - Store current fields, patterns, and destination mappings.

### 4.2. Backend / Service Integration
- **LLM Service**: Integration with an LLM Provider (e.g., OpenAI, Anthropic, or local model) to generate Regex.
    - *Prompt Engineering*: Construct prompts that include document text and target value to request a Regex.
- **Text Extraction**: Robust PDF-to-Text extraction (already likely available, but needs verification for full-page accuracy).

### 4.3. Data Structure
- **Mapping File (JSON)**:
    - Fields List:
        - `name`: string
        - `regex_pattern`: string
        - `label_coords`: {x, y, w, h} (optional, for UI reference)
        - `value_coords`: {x, y, w, h} (optional, for UI reference)
    - Destination:
        - `template_base64`: string
        - `fields_map`: [{ field_name, dest_coords }]

## 5. Non-Functional Requirements
- **Latency**: Runtime extraction must be fast (ms range). Setup phase can take seconds (LLM latency).
- **Cost**: Minimize tokens sent to LLM during setup.
- **Privacy**: Ensure sensitive data in samples is handled according to policy (though this is likely local/client-side for now, LLM usage requires privacy thought).

## 6. Open Questions
- Which LLM provider to use?
- How to handle cases where Regex fails (fallback)?
- Is the new mapping page a replacement for an existing one or a parallel feature? (Assumed new parallel feature for now).
