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
  1. In the browser, map the sample in the Mapping Studio, save the profile and export it as a `.docmapper` file.
  2. In the desktop app, import that file, process the sample in the Processor and download the results.
  3. Process the same sample in the browser and download the results.
- **Expected**:
  - The profile imports without errors in the desktop app.
  - The extracted values and the stamped PDFs are the same in both.
- **Result**: [ ] Pass [ ] Fail [ ] Blocked
- **Notes**:
