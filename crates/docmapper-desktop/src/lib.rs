//! DocMapper desktop shell: the composition root of the desktop surface. It
//! builds the Tauri application, registers the commands and opens the window
//! with the interface (`tauri.conf.json`).

pub mod commands;

/// Builds and runs the desktop application until its last window closes.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::core_version])
        .run(tauri::generate_context!())
}
