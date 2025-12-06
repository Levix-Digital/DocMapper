# Feature Specification: App-Level Licensing (Legal Shield)

**Feature Branch**: `004-app-licensing`
**Created**: 2025-12-06
**Status**: Draft
**Input**: Chat discussion regarding "Legal Shield" and "Phone Home" license checks.

## User Scenarios & Testing

### User Story 1 - License Verification
As a product owner, I want the application to verify its license key with a central server on startup, so that unauthorized copies of the application (e.g., stolen source code running on unauthorized domains) are disabled.

**Acceptance Scenarios**:
1.  **Given** a valid license key and authorized domain, **When** the app loads, **Then** it should initialize normally and load the WASM module.
2.  **Given** an invalid or expired license key, **When** the app loads, **Then** it should show a blocking "License Error" screen and **NOT** load the WASM module.
3.  **Given** a network failure during license check, **When** the app loads, **Then** it should fail safe (block access) OR enter a grace period (depending on policy - strictly blocking for now).

## Requirements

### Functional Requirements
- **FR-001**: App MUST check for a valid license key on startup before initializing the Vue app or loading WASM.
- **FR-002**: License check MUST validate the current domain against the authorized domains for the key.
- **FR-003**: The WASM module MUST NOT be loaded if the license check fails.
- **FR-004**: License keys and server URL MUST be configurable via environment variables (`VITE_LICENSE_KEY`, `VITE_LICENSE_SERVER`).
- **FR-005**: **Offline Behavior**: The app MUST retry the license check up to 3 times with a 1-second delay between attempts on network failure (total timeout: ~3 seconds). If all attempts fail, it MUST block access (Strict Mode, no grace period).
    - **Note**: HTTP 500 responses (e.g., Database Down) MUST be treated as network failures and trigger the retry logic.
- **FR-006**: **Backend Storage**: Valid keys and domains MUST be stored in a persistent SQLite database (`licenses` table).
    - Schema: `id` (UUID/AutoInc), `key` (Text), `authorized_domain` (Text), `is_active` (Boolean), `customer_name` (Text).
- **FR-007**: **Key Format**: License keys MUST start with `cpx_live_` followed by a random alphanumeric string.
- **FR-007.1**: **Error Response Format**: The backend MUST return HTTP 400 for malformed license keys (invalid format) and HTTP 403 for valid-format but unauthorized keys.

### Technical Constraints
- **TC-001**: **Zero Data Transfer**: The license check payload MUST ONLY contain license metadata (key, domain, version), NOT document data.
- **TC-002**: **Production Hardening**:
    - **Rate Limiting**: Backend MUST implement basic rate limiting (e.g., max 100 requests/minute per IP) to prevent brute-force key guessing.
    - **Logging**: Failed validation attempts MUST be logged with timestamp and IP.

## Success Criteria
- **SC-001**: Unauthorized domains cannot run the application even if they have the static assets.
- **SC-002**: License check is performed before WASM fetch.

## Verification Plan

### Automated Tests
- **Unit Tests**: Test `LicenseService` handles 200 and 403 responses correctly.
- **Integration**: Verify `wasm-bridge` throws when license is invalid.

### Manual Verification
1.  **Valid License Flow**:
    - Set valid `VITE_LICENSE_KEY`.
    - Start app.
    - Verify app loads and WASM functions work.
2.  **Invalid License Flow**:
    - Change `VITE_LICENSE_KEY` to invalid.
    - Reload app.
    - Verify "License Error" screen appears.
    - Check Network tab: Verify `logic.wasm` is NOT fetched.
3.  **Domain Mismatch**:
    - (If possible locally) spoof domain or set license to allow only 'levix.digital'.
    - Verify app blocks access.
