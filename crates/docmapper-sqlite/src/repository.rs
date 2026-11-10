//! The profile repository on a SQLite database (FEAT-011).

use crate::migrations::{migrate, schema_version, unavailable};
use docmapper_core::profiles::{ProfileDocument, ProfileRepository, RepositoryError};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

/// How long a write waits for another connection holding the database.
const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// Profiles in a SQLite database: one row per profile with its JSON document
/// (keys in stored order) and its position in the stored order.
pub struct SqliteProfileRepository {
    connection: Connection,
}

impl SqliteProfileRepository {
    /// Opens or creates the database file, in WAL mode, and brings its schema
    /// to the latest version.
    ///
    /// # Errors
    /// `NewerSchema` for a database written by a newer DocMapper (nothing is
    /// written to it); `Unavailable` when the file cannot be opened or migrated.
    pub fn open(path: &Path) -> Result<Self, RepositoryError> {
        let connection = Connection::open(path).map_err(unavailable)?;
        Self::prepare(connection, true)
    }

    /// A database in memory (tests and previews).
    ///
    /// # Errors
    /// `Unavailable` when SQLite cannot create it.
    pub fn open_in_memory() -> Result<Self, RepositoryError> {
        let connection = Connection::open_in_memory().map_err(unavailable)?;
        Self::prepare(connection, false)
    }

    fn prepare(mut connection: Connection, wal: bool) -> Result<Self, RepositoryError> {
        connection.busy_timeout(BUSY_TIMEOUT).map_err(unavailable)?;
        // Refuse a newer schema before changing the journal mode or anything else.
        let found = schema_version(&connection)?;
        if found > crate::SCHEMA_VERSION {
            return Err(RepositoryError::NewerSchema {
                found,
                known: crate::SCHEMA_VERSION,
            });
        }
        if wal {
            let mode: String = connection
                .query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))
                .map_err(unavailable)?;
            if !mode.eq_ignore_ascii_case("wal") {
                return Err(RepositoryError::Unavailable(format!(
                    "journal mode {mode} instead of WAL"
                )));
            }
        }
        connection
            .pragma_update(None, "foreign_keys", true)
            .map_err(unavailable)?;
        migrate(&mut connection)?;
        Ok(Self { connection })
    }

    /// The schema version of the database.
    ///
    /// # Errors
    /// `Unavailable` when SQLite cannot answer.
    pub fn schema_version(&self) -> Result<i64, RepositoryError> {
        schema_version(&self.connection)
    }

    /// The journal mode of the database (`wal` for a file).
    ///
    /// # Errors
    /// `Unavailable` when SQLite cannot answer.
    pub fn journal_mode(&self) -> Result<String, RepositoryError> {
        self.connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .map_err(unavailable)
    }
}

fn text_id(document: &ProfileDocument) -> Result<&str, RepositoryError> {
    document
        .id()
        .ok_or_else(|| RepositoryError::InvalidDocument("profile without a text id".into()))
}

impl ProfileRepository for SqliteProfileRepository {
    fn list(&self) -> Result<Vec<ProfileDocument>, RepositoryError> {
        let mut statement = self
            .connection
            .prepare_cached("SELECT position, document FROM profile ORDER BY position")
            .map_err(unavailable)?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(unavailable)?;
        let mut documents = Vec::new();
        for row in rows {
            let (position, text) = row.map_err(unavailable)?;
            let value: Value =
                serde_json::from_str(&text).map_err(|error| RepositoryError::Corrupt {
                    position,
                    reason: error.to_string(),
                })?;
            let document =
                ProfileDocument::from_value(value).ok_or_else(|| RepositoryError::Corrupt {
                    position,
                    reason: "not a JSON object".into(),
                })?;
            documents.push(document);
        }
        Ok(documents)
    }

    fn save(&mut self, document: ProfileDocument) -> Result<(), RepositoryError> {
        let id = text_id(&document)?;
        let text = serde_json::to_string(document.as_map())
            .map_err(|error| RepositoryError::InvalidDocument(error.to_string()))?;
        let transaction = self.connection.transaction().map_err(unavailable)?;
        let updated = transaction
            .execute(
                "UPDATE profile SET document = ?2 WHERE id = ?1",
                params![id, text],
            )
            .map_err(unavailable)?;
        if updated == 0 {
            let last: Option<i64> = transaction
                .query_row("SELECT max(position) FROM profile", [], |row| row.get(0))
                .optional()
                .map_err(unavailable)?
                .flatten();
            let position = last.map_or(0, |p| p + 1);
            transaction
                .execute(
                    "INSERT INTO profile (id, position, document) VALUES (?1, ?2, ?3)",
                    params![id, position, text],
                )
                .map_err(unavailable)?;
        }
        transaction.commit().map_err(unavailable)
    }

    fn delete(&mut self, id: &str) -> Result<(), RepositoryError> {
        self.connection
            .execute("DELETE FROM profile WHERE id = ?1", params![id])
            .map_err(unavailable)?;
        Ok(())
    }
}
