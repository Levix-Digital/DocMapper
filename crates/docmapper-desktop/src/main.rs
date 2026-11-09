// Hides the console window of release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = docmapper_desktop::run() {
        eprintln!("DocMapper could not start: {error}");
        std::process::exit(1);
    }
}
