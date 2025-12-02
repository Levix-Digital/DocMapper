# Research & Technical Decisions

## 1. Sync Strategy: Encrypted Client-Side Sync

**Decision**: Implement "Encrypted Sync" where data is encrypted on the client before being sent to the backend.
**Rationale**: Adheres to the "Privacy-First" constitution. The backend acts as a dumb store for encrypted blobs and does not have access to the decryption keys.
**Alternatives Considered**: 
- *Plain Sync*: Rejected due to privacy concerns.
- *Local Only*: Rejected as it prevents multi-device usage which is a "Premium" requirement.

## 2. AI Integration: Hybrid (OpenAI) with BYOK

**Decision**: Use OpenAI (GPT-4o) via direct client-side API calls using a user-provided API Key (BYOK).
**Rationale**: 
- **Privacy**: Data goes directly from Client -> OpenAI, bypassing our backend.
- **Cost/Complexity**: BYOK avoids complex usage-based billing implementation for us.
**Alternatives Considered**:
- *Backend Proxy*: Rejected to minimize liability and backend complexity.
- *Included in Sub*: Rejected due to risk of high usage costs.

## 3. PDF Generation Library: pdf-lib

**Decision**: Use `pdf-lib` for all PDF manipulation and generation.
**Rationale**: The core requirement is filling *existing* PDF templates (CMR forms) and modifying them (adding QR codes). `pdf-lib` excels at this, whereas `jspdf` is better for creating PDFs from HTML/scratch.
**Alternatives Considered**:
- *jspdf*: Rejected as it is less robust for editing existing PDFs.
- *pdfkit*: Node-centric, harder to use in browser.

## 4. Mobile UI Pattern: Tabbed View

**Decision**: Implement a Tabbed View (PDF vs. Form) for mobile devices.
**Rationale**: Split-screen is unusable on narrow screens. Tabs allow focused work on either verification or data entry.
**Alternatives Considered**:
- *Stacked View*: Rejected due to excessive scrolling.

## 5. Conflict Resolution: Last Write Wins

**Decision**: Use "Last Write Wins" (LWW) for concurrent edits in shared workspaces.
**Rationale**: Simplest to implement for the initial Premium version. Real-time collaboration (OT/CRDT) is too complex for the current scope.
**Alternatives Considered**:
- *Locking*: Rejected as too intrusive for UX.
- *CRDTs*: Rejected as over-engineering for this phase.
