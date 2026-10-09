# Implementation Plan: App-Level Licensing

**Feature Branch**: `004-app-licensing`
**Spec**: [Spec](file:///c:/Users/guilh/source/repos/DocMapper/specs/004-app-licensing/spec.md)

## Goal Description
Implement a "phone home" license check (Legal Shield). The app must verify its license key with a backend server before loading the critical WASM module. If verification fails (or network is down after retries), the app blocks access.

## User Review Required
> [!NOTE]
> **Backend Initialization**: Since the backend folder appears empty, this plan includes initializing a minimal Express server to handle the license check.

## Proposed Changes

### Configuration
#### [NEW] [.env.example](file:///c:/Users/guilh/source/repos/DocMapper/.env.example)
- Add `VITE_LICENSE_KEY` (Client) and `VITE_LICENSE_SERVER` (Client).
- Remove `VALID_KEYS` (Backend) - moved to Database.

### Backend (Initialization & Logic)
#### [NEW] [backend/package.json](file:///c:/Users/guilh/source/repos/DocMapper/backend/package.json)
- Initialize minimal `package.json` with `express`, `cors`, `dotenv`, `ts-node`.
- **Add Dependency**: `sqlite3` (and `@types/sqlite3`).

#### [NEW] [backend/src/index.ts](file:///c:/Users/guilh/source/repos/DocMapper/backend/src/index.ts)
- Create entry point:
    - Configure CORS.
    - Load env vars.
    - **Initialize Database**: Check if `licenses.db` exists; if not, create `licenses` table.
    - Register `licenseRoutes`.
    - Start server on port 3000 (default).

#### [NEW] [backend/src/routes/license.ts](file:///c:/Users/guilh/source/repos/DocMapper/backend/src/routes/license.ts)
- Implement `POST /api/verify`.
- Logic:
    - Get `key` and `domain` from body.
    - **DB Query**: `SELECT * FROM licenses WHERE key = ? AND authorized_domain = ? AND is_active = 1`.
    - Return `{ valid: true/false }`.

### Frontend Services
#### [NEW] [frontend/src/services/license-service.ts](file:///c:/Users/guilh/source/repos/DocMapper/frontend/src/services/license-service.ts)
- Implement singleton `LicenseService`.
- `verify()`:
    - Retries up to 3 times with 1-second delay between attempts on network error.
    - Posts to `VITE_LICENSE_SERVER/api/verify`.
    - Returns `boolean` (total timeout: ~3 seconds).
- `isLicenseValid()`: Returns cached status.

#### [MODIFY] [frontend/src/services/WasmService.ts](file:///c:/Users/guilh/source/repos/DocMapper/frontend/src/services/WasmService.ts)
- Import `LicenseService`.
- In `init()`:
    - Check `LicenseService.isLicenseValid()`.
    - If false, throw `Error("Security Module Missing: License Invalid")`.

### Application Entry
#### [MODIFY] [frontend/src/main.ts](file:///c:/Users/guilh/source/repos/DocMapper/frontend/src/main.ts)
- Import `LicenseService`.
- Wrap startup in `init()`.
- Call `await LicenseService.verify()`.
- If invalid:
    - Overwrite `#app` innerHTML with a blocking "License Error" message.
- If valid:
    - Mount Vue app.

## Verification Plan

### Automated Tests
- **Unit Tests**:
    - Create `frontend/src/services/license-service.test.ts` (if test runner exists, or manual check).
    - detailed instructions below for manual verification as no test runner is active yet.

### Manual Verification
1.  **Setup**:
    - Run `cd backend && npm install && npm run dev` (or `ts-node src/index.ts`).
    - Set `backend/.env`: (No VALID_KEYS needed).
    - **Seed DB**: Run script to insert test key `cpx_live_test` for `localhost`.
    - Set `frontend/.env`: `VITE_LICENSE_KEY="cpx_live_test"`, `VITE_LICENSE_SERVER="http://localhost:3000"`.

2.  **Scenario A: Valid License**:
    - Start Frontend (`npm run dev`).
    - **Verify**: App loads, WASM module loads (Console: "WASM Module Loaded Successfully").

3.  **Scenario B: Invalid License**:
    - Change `frontend/.env`: `VITE_LICENSE_KEY="invalid_key"`.
    - Reload Frontend.
    - **Verify**: "License Error" screen appears. Console shows "License invalid". Network tab shows NO request for `.wasm` file.

4.  **Scenario C: Server Down (Offline)**:
    - Stop Backend server.
    - Reload Frontend.
    - **Verify**: App waits (3 retries), then shows "License Error" or "Connection Failed".
