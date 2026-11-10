//! DocMapper desktop shell: the composition root of the desktop surface. It
//! builds the Tauri application, opens the local profile database, registers
//! the commands and opens the window with the interface (`tauri.conf.json`).

pub mod commands;
pub mod profiles;

use profiles::ProfileState;
use tauri::Manager;

/// Builds and runs the desktop application until its last window closes.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = match app.path().app_data_dir() {
                Ok(directory) => ProfileState::open_in(&directory),
                Err(error) => ProfileState::unavailable(format!(
                    "profile storage unavailable: no application data directory: {error}"
                )),
            };
            if let Some(reason) = state.open_error() {
                eprintln!("DocMapper could not open the profile database: {reason}");
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::core_version,
            commands::profiles_create_empty,
            commands::profiles_list,
            commands::profiles_get,
            commands::profiles_save,
            commands::profiles_delete,
            commands::profiles_duplicate,
            commands::profiles_import,
            commands::profiles_export,
        ])
        .run(tauri::generate_context!())
}
