# Manual Tests

Curated manual test suite: one section per feature, each test describing how the software behaves **today**. Tests are edited in place when behavior changes and removed when they no longer apply. Only what cannot be automated is tested here.

How to record a run: in each test of the current run, mark exactly one box of the `Result` line with `x` and, for `Fail` or `Blocked`, describe what happened in `Notes`.

## Desktop Shell

### MT-DESK-001: The desktop app opens the current interface

- **Covers**: Desktop Shell, Interface
- **Prerequisites**: the release build of the candidate installed or built with `npm run tauri --prefix frontend -- build` on Windows, macOS or Linux; the license server and key the interface needs configured as for the browser version
- **Steps**:
  1. Start DocMapper from the installed app or from `target/release/docmapper-desktop`.
  2. Open the Processor screen, then the Mapping Studio, then switch the language and the theme.
- **Expected**:
  - A window titled DocMapper opens with the Processor screen.
  - Every screen opens and the language and theme change as in the browser version.
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:

### MT-DESK-002: The main flows give the same results in the desktop app and in the browser

- **Covers**: Desktop Shell, Interface, Profiles, Batch Processing, PDF Stamping
- **Prerequisites**: the desktop app of MT-DESK-001; the browser version from the same commit (`npm run dev --prefix frontend`); a sample PDF with a recurring layout and its destination template
- **Steps**:
  1. In the browser, map the sample in the Mapping Studio, save the profile and export it as a `.dmap` file.
  2. In the desktop app, import that file, process the sample in the Processor and download the results.
  3. Process the same sample in the browser and download the results.
- **Expected**:
  - The profile imports without errors in the desktop app.
  - The extracted values and the stamped PDFs are the same in both.
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:

## Profiles

### MT-PROF-001: Profiles of the desktop app live in the local database and survive a restart

- **Covers**: Profiles, Desktop Shell, Interface
- **Prerequisites**: the desktop app of MT-DESK-001; a sample PDF with a recurring layout
- **Steps**:
  1. In the Mapping Studio, map one field on the sample and save the profile; save a second profile the same way.
  2. Open Profiles: rename the first profile, duplicate it, and delete the second (click the delete button twice).
  3. Close DocMapper and start it again; open the Processor, then Profiles.
- **Expected**:
  - Profiles says the profiles are in the local database and lists the renamed profile and its copy (`<name> (Copy)`), in that order.
  - The first click on delete only asks for a second click; the second click deletes the profile.
  - After the restart the Processor offers the same two profiles and Profiles lists them in the same order.
  - The application data folder holds `docmapper.sqlite3` (`~/.local/share/digital.levix.docmapper` on Linux, `~/Library/Application Support/digital.levix.docmapper` on macOS, `%APPDATA%\digital.levix.docmapper` on Windows).
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:

### MT-PROF-002: Import and export of .dmap files in the desktop app

- **Covers**: Profiles, Desktop Shell
- **Prerequisites**: the desktop app with at least one profile (MT-PROF-001); a text file that is not a valid profile (for example `{"name":"x"}` saved as `bad.dmap`)
- **Steps**:
  1. In Profiles, export a profile; in the save dialog keep the proposed name and save.
  2. Export it again and cancel the dialog.
  3. Import the file saved in step 1.
  4. Import `bad.dmap`.
  5. In the Mapping Studio, export the profile being edited without saving it.
- **Expected**:
  - The save dialog proposes `<name>.dmap` with characters outside letters, digits, `_` and `-` replaced by `_`; the saved file is indented JSON of the profile.
  - Cancelling writes nothing and shows no message.
  - The imported profile is listed with the name `<name> (1)` and opens in the Mapping Studio.
  - Importing `bad.dmap` shows a red message inside the window that names the missing name, fields or destination mappings, and adds nothing.
  - The unsaved profile is exported as it is on screen.
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:

### MT-PROF-003: Profiles move from the browser version to the desktop app

- **Covers**: Profiles (FEAT-013)
- **Prerequisites**: the browser version with saved profiles (`npm run dev --prefix frontend`); the desktop app from the same commit
- **Steps**:
  1. In the browser version, open Profiles and export each profile.
  2. In the desktop app, import each exported file.
  3. Export each imported profile from the desktop app and compare it with the file from step 1.
- **Expected**:
  - Every profile imports and is listed in the desktop app.
  - Each file exported from the desktop app is the same as the browser one except `id`, `updatedAt` and a `(N)` suffix when the name was already used.
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:

### MT-PROF-004: A database the app cannot use is reported and the app keeps working

- **Covers**: Profiles, Desktop Shell
- **Prerequisites**: the desktop app closed; a copy of the application data folder kept aside
- **Steps**:
  1. Mark the database as written by a newer DocMapper: `sqlite3 docmapper.sqlite3 "PRAGMA user_version = 99"` in the application data folder.
  2. Start DocMapper, open the Processor, the Mapping Studio and Profiles.
  3. Close DocMapper and put the copied folder back.
- **Expected**:
  - The app starts and every screen opens.
  - The Mapping Studio and Profiles show a red message that the profile database schema version 99 is newer than this version of DocMapper knows.
  - The database file is not changed (its `user_version` stays 99).
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:

### MT-PROF-005: The shadow mode finds no difference between the two stores

- **Covers**: Profiles, Interface
- **Prerequisites**: the desktop app started with `npm run tauri --prefix frontend -- dev` with an empty application data folder (no profile in the database); the window's developer tools opened with right click, Inspect
- **Steps**:
  1. In the developer console run `localStorage.setItem('docmapper_profile_shadow', '1')` and reload the window.
  2. Run MT-PROF-001 steps 1 and 2 and MT-PROF-002 step 3.
  3. Run `localStorage.removeItem('docmapper_profile_shadow')` and reload.
- **Expected**:
  - No console entry starts with `[profiles shadow]` during step 2.
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:
