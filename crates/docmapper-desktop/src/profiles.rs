//! The profile store of the desktop app: the M3 `ProfileStore` over the local
//! SQLite database (ADR-0006), the errors the interface receives and the save
//! target of `.dmap` exports (contract in
//! `specs/009-profiles-ui-wiring/contracts/desktop-profile-commands.md`).

use docmapper_core::profiles::{
    export_docmapper, into_ecmascript_order, Clock, ProfileDocument, ProfileStore, RandomSource,
    RepositoryError, StdRandom, StoreError, SystemClock,
};
use docmapper_sqlite::SqliteProfileRepository;
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// File name of the local profile database in the application data directory.
pub const DATABASE_FILE_NAME: &str = "docmapper.sqlite3";

/// The clock of the store; the system clock in the app, a fixed one in tests.
pub struct StoreClock(Box<dyn Clock + Send>);

impl Clock for StoreClock {
    fn now_millis(&self) -> f64 {
        self.0.now_millis()
    }
}

/// The random source of the store; the system one in the app, a fixed one in tests.
pub struct StoreRandom(Box<dyn RandomSource + Send>);

impl RandomSource for StoreRandom {
    fn next_f64(&mut self) -> f64 {
        self.0.next_f64()
    }
}

/// The store the desktop app uses.
pub type DesktopStore = ProfileStore<SqliteProfileRepository, StoreClock, StoreRandom>;

/// An error as the interface receives it: `{ "kind": ..., "message": ... }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommandError {
    pub kind: &'static str,
    pub message: String,
}

impl CommandError {
    fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    /// A profile value that is not a JSON object (`TypeError` in the interface).
    fn not_an_object() -> Self {
        Self::new("type", "profile is not an object")
    }
}

impl From<StoreError> for CommandError {
    fn from(error: StoreError) -> Self {
        let kind = match &error {
            StoreError::InvalidFile => "invalid_file",
            StoreError::Syntax(_) => "syntax",
            StoreError::Type(_) => "type",
            StoreError::Range(_) => "range",
            StoreError::Repository(_) => "database",
        };
        Self::new(kind, error.to_string())
    }
}

/// The profile store of the running app, or why its database could not be
/// opened. Commands run one at a time on it (one mutex).
pub struct ProfileState {
    store: Result<Mutex<DesktopStore>, String>,
}

impl ProfileState {
    /// Opens `docmapper.sqlite3` in `directory` (created when absent) with the
    /// system clock and random source. A failure is kept, not returned: the
    /// app keeps running and every profile command reports it.
    pub fn open_in(directory: &Path) -> Self {
        let opened = std::fs::create_dir_all(directory)
            .map_err(|error| {
                RepositoryError::Unavailable(format!(
                    "cannot create {}: {error}",
                    directory.display()
                ))
            })
            .and_then(|()| SqliteProfileRepository::open(&directory.join(DATABASE_FILE_NAME)));
        Self::from_repository(
            opened,
            Box::new(SystemClock),
            Box::new(StdRandom::default()),
        )
    }

    /// A state over an opened (or failed) repository with the given clock and
    /// random source.
    pub fn from_repository(
        repository: Result<SqliteProfileRepository, RepositoryError>,
        clock: Box<dyn Clock + Send>,
        random: Box<dyn RandomSource + Send>,
    ) -> Self {
        let store = repository
            .map(|repository| {
                Mutex::new(ProfileStore::new(
                    repository,
                    StoreClock(clock),
                    StoreRandom(random),
                ))
            })
            .map_err(|error| error.to_string());
        Self { store }
    }

    /// A state without a database, for a reason found before opening it.
    pub fn unavailable(reason: String) -> Self {
        Self { store: Err(reason) }
    }

    /// Why the database could not be opened, if it could not.
    pub fn open_error(&self) -> Option<&str> {
        self.store.as_ref().err().map(String::as_str)
    }

    /// Runs `operation` on the store, alone.
    ///
    /// # Errors
    /// `database` when the database could not be opened; the operation's error.
    pub fn with_store<T>(
        &self,
        operation: impl FnOnce(&mut DesktopStore) -> Result<T, StoreError>,
    ) -> Result<T, CommandError> {
        let store = self
            .store
            .as_ref()
            .map_err(|reason| CommandError::new("database", reason.clone()))?;
        // A panic inside an earlier operation leaves the store as the last
        // finished repository call left it; the database stays consistent.
        let mut store = store
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        Ok(operation(&mut store)?)
    }
}

/// A profile value from the interface as a document, keys in JavaScript order.
///
/// # Errors
/// `type` when the value is not a JSON object.
pub fn document_from(value: Value) -> Result<ProfileDocument, CommandError> {
    ProfileDocument::from_value(into_ecmascript_order(value))
        .ok_or_else(CommandError::not_an_object)
}

/// Where an exported `.dmap` file goes: asks the user, proposing a file name.
pub trait SaveTarget {
    /// The chosen path, or `None` when the user cancelled.
    fn choose(&self, proposed_file_name: &str) -> Option<PathBuf>;
}

/// Exports `profile` to the file the user chooses: the text and proposed name
/// of `export_docmapper`. Returns the saved path, or `None` when cancelled.
///
/// # Errors
/// `type` for a value that is not an object or a name that is not text;
/// `file` when the file cannot be written.
pub fn export_to(profile: Value, target: &dyn SaveTarget) -> Result<Option<PathBuf>, CommandError> {
    let file = export_docmapper(&document_from(profile)?)?;
    let Some(path) = target.choose(&file.file_name) else {
        return Ok(None);
    };
    std::fs::write(&path, file.contents.as_bytes()).map_err(|error| {
        CommandError::new("file", format!("cannot write {}: {error}", path.display()))
    })?;
    Ok(Some(path))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

    pub struct FixedClock(pub f64);

    impl Clock for FixedClock {
        fn now_millis(&self) -> f64 {
            self.0
        }
    }

    pub struct FixedRandom(pub f64);

    impl RandomSource for FixedRandom {
        fn next_f64(&mut self) -> f64 {
            self.0
        }
    }

    /// A state over an in-memory database, clock at 2026-01-01, random 0.5.
    pub fn memory_state() -> ProfileState {
        ProfileState::from_repository(
            SqliteProfileRepository::open_in_memory(),
            Box::new(FixedClock(1_767_225_600_000.0)),
            Box::new(FixedRandom(0.5)),
        )
    }

    struct Target(Option<PathBuf>);

    impl SaveTarget for Target {
        fn choose(&self, _proposed_file_name: &str) -> Option<PathBuf> {
            self.0.clone()
        }
    }

    struct Recording(std::cell::RefCell<String>, PathBuf);

    impl SaveTarget for Recording {
        fn choose(&self, proposed_file_name: &str) -> Option<PathBuf> {
            proposed_file_name.clone_into(&mut self.0.borrow_mut());
            Some(self.1.clone())
        }
    }

    #[test]
    fn opening_creates_the_database_file_in_the_directory() {
        let dir = tempfile::tempdir().expect("temporary directory");
        let data = dir.path().join("nested").join("data");
        let state = ProfileState::open_in(&data);
        assert_eq!(state.open_error(), None);
        assert!(data.join(DATABASE_FILE_NAME).is_file());
        let listed = state.with_store(|store| store.all_profiles());
        assert_eq!(listed.map(|p| p.len()), Ok(0));
    }

    #[test]
    fn profiles_survive_reopening_the_database() {
        let dir = tempfile::tempdir().expect("temporary directory");
        {
            let state = ProfileState::open_in(dir.path());
            state
                .with_store(|store| {
                    store.import_docmapper(r#"{"name":"A","fields":[],"destinationMappings":[]}"#)
                })
                .expect("import");
        }
        let state = ProfileState::open_in(dir.path());
        let names: Vec<Value> = state
            .with_store(|store| store.all_profiles())
            .expect("list")
            .into_iter()
            .map(|p| p.get("name").cloned().unwrap_or(Value::Null))
            .collect();
        assert_eq!(names, vec![json!("A")]);
    }

    #[test]
    fn a_database_that_cannot_be_opened_is_reported_by_every_operation() {
        let dir = tempfile::tempdir().expect("temporary directory");
        let blocker = dir.path().join("file");
        std::fs::write(&blocker, "not a directory").expect("write");
        let state = ProfileState::open_in(&blocker);
        let reason = state.open_error().expect("open error").to_string();
        assert!(reason.contains("profile storage unavailable"), "{reason}");
        let error = state
            .with_store(|store| store.all_profiles())
            .expect_err("error");
        assert_eq!(error, CommandError::new("database", reason));
    }

    #[test]
    fn a_newer_database_is_refused_with_a_database_error() {
        let dir = tempfile::tempdir().expect("temporary directory");
        let path = dir.path().join(DATABASE_FILE_NAME);
        let connection = rusqlite::Connection::open(&path).expect("open");
        connection
            .pragma_update(None, "user_version", 99)
            .expect("user_version");
        drop(connection);
        let state = ProfileState::open_in(dir.path());
        let error = state
            .with_store(|store| store.all_profiles())
            .expect_err("error");
        assert_eq!(error.kind, "database");
        assert!(
            error.message.contains("schema version 99"),
            "{}",
            error.message
        );
    }

    #[test]
    fn store_errors_map_to_their_kinds() {
        let cases = [
            (StoreError::InvalidFile, "invalid_file"),
            (StoreError::Syntax("x".into()), "syntax"),
            (StoreError::Type("x".into()), "type"),
            (StoreError::Range("x".into()), "range"),
            (
                StoreError::Repository(RepositoryError::Unavailable("x".into())),
                "database",
            ),
        ];
        for (error, kind) in cases {
            let message = error.to_string();
            assert_eq!(CommandError::from(error), CommandError::new(kind, message));
        }
    }

    #[test]
    fn command_errors_serialize_as_kind_and_message() {
        let text = serde_json::to_string(&CommandError::new("syntax", "bad")).expect("json");
        assert_eq!(text, r#"{"kind":"syntax","message":"bad"}"#);
    }

    #[test]
    fn documents_must_be_objects_and_take_javascript_key_order() {
        assert_eq!(
            document_from(json!([1])).expect_err("error"),
            CommandError::not_an_object()
        );
        let document = document_from(json!({"b": 1, "2": 2, "a": 3})).expect("object");
        let keys: Vec<&String> = document.as_map().keys().collect();
        assert_eq!(keys, ["2", "b", "a"]);
    }

    #[test]
    fn export_writes_the_core_text_to_the_chosen_file() {
        let dir = tempfile::tempdir().expect("temporary directory");
        let path = dir.path().join("out.dmap");
        let target = Recording(std::cell::RefCell::new(String::new()), path.clone());
        let profile = json!({"id": "p", "name": "Für Kunden/1", "fields": [16.0]});
        let saved = export_to(profile.clone(), &target).expect("export");
        assert_eq!(saved, Some(path.clone()));
        assert_eq!(*target.0.borrow(), "F_r_Kunden_1.dmap");
        let expected = export_docmapper(&document_from(profile).expect("doc")).expect("file");
        assert_eq!(
            std::fs::read_to_string(&path).expect("read"),
            expected.contents
        );
        assert!(expected.contents.contains("16\n"));
    }

    #[test]
    fn a_cancelled_export_writes_nothing() {
        assert_eq!(export_to(json!({"name": "A"}), &Target(None)), Ok(None));
    }

    #[test]
    fn an_export_that_cannot_be_written_is_a_file_error() {
        let dir = tempfile::tempdir().expect("temporary directory");
        let target = Target(Some(dir.path().join("missing").join("a.dmap")));
        let error = export_to(json!({"name": "A"}), &target).expect_err("error");
        assert_eq!(error.kind, "file");
    }

    #[test]
    fn an_export_of_a_name_that_is_not_text_is_a_type_error() {
        let error = export_to(json!({"name": 1}), &Target(None)).expect_err("error");
        assert_eq!(error.kind, "type");
    }

    #[test]
    fn operations_never_interleave() {
        let state = std::sync::Arc::new(ProfileState::from_repository(
            SqliteProfileRepository::open_in_memory(),
            Box::new(SystemClock),
            Box::new(StdRandom::default()),
        ));
        let threads: Vec<_> = (0..4)
            .map(|i| {
                let state = state.clone();
                std::thread::spawn(move || {
                    for j in 0..10 {
                        let text = format!(
                            r#"{{"name":"P{i}-{j}","fields":[],"destinationMappings":[]}}"#
                        );
                        state
                            .with_store(|store| store.import_docmapper(&text))
                            .expect("import");
                    }
                })
            })
            .collect();
        for thread in threads {
            thread.join().expect("thread");
        }
        let profiles = state
            .with_store(|store| store.all_profiles())
            .expect("list");
        let mut names: Vec<String> = profiles
            .iter()
            .filter_map(|p| p.get("name").and_then(Value::as_str).map(str::to_string))
            .collect();
        names.sort();
        names.dedup();
        assert_eq!(names.len(), 40);
    }
}
