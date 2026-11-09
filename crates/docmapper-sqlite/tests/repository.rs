//! The SQLite profile repository on database files (US3 of M3).

use docmapper_core::profiles::{ProfileDocument, ProfileRepository, RepositoryError};
use docmapper_sqlite::{SqliteProfileRepository, SCHEMA_VERSION};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::Path;
use std::time::Instant;

type TestResult = Result<(), Box<dyn std::error::Error>>;

fn doc(value: Value) -> ProfileDocument {
    ProfileDocument::from_value(value).unwrap_or_else(|| unreachable!("an object"))
}

fn values(repository: &SqliteProfileRepository) -> Result<Vec<Value>, RepositoryError> {
    Ok(repository
        .list()?
        .into_iter()
        .map(ProfileDocument::into_value)
        .collect())
}

#[test]
fn a_new_file_gets_the_latest_schema_in_wal_mode() -> TestResult {
    let dir = tempfile::tempdir()?;
    let repository = SqliteProfileRepository::open(&dir.path().join("docmapper.sqlite3"))?;
    assert_eq!(repository.schema_version()?, SCHEMA_VERSION);
    assert_eq!(repository.journal_mode()?, "wal");
    assert!(repository.list()?.is_empty());
    Ok(())
}

#[test]
fn profiles_and_their_order_survive_reopening() -> TestResult {
    let dir = tempfile::tempdir()?;
    let path = dir.path().join("profiles.sqlite3");
    let unusual = json!({"zeta": [1, 2.5, 1e21, -0.0001], "id": "b", "name": "B", "2": {"y": null, "x": true}});
    {
        let mut repository = SqliteProfileRepository::open(&path)?;
        repository.save(doc(json!({"id": "a", "name": "A"})))?;
        repository.save(doc(unusual.clone()))?;
        repository.save(doc(json!({"id": "c", "name": "C"})))?;
        repository.save(doc(json!({"name": "A2", "id": "a"})))?;
        repository.delete("c")?;
        repository.save(doc(json!({"id": "d"})))?;
        repository.delete("missing")?;
    }
    let repository = SqliteProfileRepository::open(&path)?;
    assert_eq!(
        values(&repository)?,
        vec![
            json!({"name": "A2", "id": "a"}),
            unusual,
            json!({"id": "d"})
        ]
    );
    let keys: Vec<String> = repository.list()?[1].as_map().keys().cloned().collect();
    assert_eq!(keys, ["zeta", "id", "name", "2"]);
    Ok(())
}

#[test]
fn a_newer_database_is_refused_without_writes() -> TestResult {
    let dir = tempfile::tempdir()?;
    let path = dir.path().join("newer.sqlite3");
    {
        let connection = Connection::open(&path)?;
        connection.pragma_update(None, "user_version", SCHEMA_VERSION + 1)?;
    }
    let before = std::fs::read(&path)?;
    match SqliteProfileRepository::open(&path) {
        Err(RepositoryError::NewerSchema { found, known }) => {
            assert_eq!((found, known), (SCHEMA_VERSION + 1, SCHEMA_VERSION));
        }
        other => panic!("expected NewerSchema, got {:?}", other.map(|_| ())),
    }
    assert_eq!(std::fs::read(&path)?, before);
    assert!(!Path::new(&format!("{}-wal", path.display())).exists());
    Ok(())
}

#[test]
fn corrupt_rows_are_reported_with_their_position() -> TestResult {
    let dir = tempfile::tempdir()?;
    let path = dir.path().join("corrupt.sqlite3");
    drop(SqliteProfileRepository::open(&path)?);
    let connection = Connection::open(&path)?;
    connection.execute(
        "INSERT INTO profile (id, position, document) VALUES ('x', 4, '{broken')",
        [],
    )?;
    let repository = SqliteProfileRepository::open(&path)?;
    assert!(matches!(
        repository.list(),
        Err(RepositoryError::Corrupt { position: 4, .. })
    ));
    connection.execute("UPDATE profile SET document = '[1]' WHERE id = 'x'", [])?;
    assert!(matches!(
        repository.list(),
        Err(RepositoryError::Corrupt { position: 4, reason }) if reason == "not a JSON object"
    ));
    Ok(())
}

#[test]
fn documents_need_a_text_id() -> TestResult {
    let mut repository = SqliteProfileRepository::open_in_memory()?;
    assert!(matches!(
        repository.save(doc(json!({"id": 7}))),
        Err(RepositoryError::InvalidDocument(_))
    ));
    assert!(matches!(
        repository.save(doc(json!({}))),
        Err(RepositoryError::InvalidDocument(_))
    ));
    assert_eq!(repository.journal_mode()?, "memory");
    Ok(())
}

#[test]
fn a_missing_directory_is_unavailable() {
    let result =
        SqliteProfileRepository::open(Path::new("/nonexistent-docmapper-dir/x/profiles.sqlite3"));
    assert!(matches!(result, Err(RepositoryError::Unavailable(_))));
}

#[test]
fn listing_a_thousand_profiles_is_fast() -> TestResult {
    let dir = tempfile::tempdir()?;
    let mut repository = SqliteProfileRepository::open(&dir.path().join("many.sqlite3"))?;
    let field = json!({"id": "f", "name": "Seal", "valueBox": {"x": 16.0, "y": 36.3, "width": 6.8, "height": 0.6, "page": 1}});
    for index in 0..1000 {
        repository.save(doc(json!({"id": format!("profile-{index}"), "name": format!("P{index}"), "fields": vec![field.clone(); 10]})))?;
    }
    let started = Instant::now();
    let listed = repository.list()?;
    let elapsed = started.elapsed();
    assert_eq!(listed.len(), 1000);
    assert!(elapsed.as_millis() < 100, "listing took {elapsed:?}");
    Ok(())
}
