//! Fails when a parity case id exists on one side only (see `check`).
//! Run it from the repository after the TypeScript and Rust parity runs.

use docmapper_parity::check::check_repository;
use docmapper_parity::find_root;
use std::process::ExitCode;

fn main() -> ExitCode {
    let current = match std::env::current_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("parity-check: cannot read the current directory: {e}");
            return ExitCode::FAILURE;
        }
    };
    let Some(root) = find_root(&current) else {
        eprintln!(
            "parity-check: no {} above {}",
            docmapper_parity::REGISTRY_FILE,
            current.display()
        );
        return ExitCode::FAILURE;
    };
    let problems = check_repository(&root);
    if problems.is_empty() {
        println!("parity-check: every case id is on every required side");
        return ExitCode::SUCCESS;
    }
    eprintln!("parity-check: {} problem(s)", problems.len());
    for problem in &problems {
        eprintln!("  {problem}");
    }
    ExitCode::FAILURE
}
