//! Schema migrations of the profile database: numbered steps tracked with
//! `PRAGMA user_version`. A released step is never edited; changes are new
//! steps that only add (tables, columns, indexes).

use docmapper_core::profiles::RepositoryError;
use rusqlite::Connection;

/// The steps in order; step N brings the schema to version N.
pub(crate) const MIGRATIONS: &[&str] = &[
    // 1: profiles as JSON documents in stored order.
    "CREATE TABLE profile (
        id       TEXT    PRIMARY KEY NOT NULL,
        position INTEGER NOT NULL UNIQUE,
        document TEXT    NOT NULL
    ) STRICT;",
];

/// The schema version this build creates and reads.
pub const SCHEMA_VERSION: i64 = MIGRATIONS.len() as i64;

pub(crate) fn unavailable(error: rusqlite::Error) -> RepositoryError {
    RepositoryError::Unavailable(error.to_string())
}

/// The schema version of the open database.
pub(crate) fn schema_version(connection: &Connection) -> Result<i64, RepositoryError> {
    connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(unavailable)
}

/// Brings the database to [`SCHEMA_VERSION`], one transaction per step.
///
/// # Errors
/// [`RepositoryError::NewerSchema`] for a database newer than this build,
/// checked before anything is written; `Unavailable` when a step fails.
pub(crate) fn migrate(connection: &mut Connection) -> Result<(), RepositoryError> {
    let found = schema_version(connection)?;
    if found > SCHEMA_VERSION {
        return Err(RepositoryError::NewerSchema {
            found,
            known: SCHEMA_VERSION,
        });
    }
    for (index, step) in MIGRATIONS
        .iter()
        .enumerate()
        .skip(usize::try_from(found).unwrap_or(0))
    {
        let version = index as i64 + 1;
        let transaction = connection.transaction().map_err(unavailable)?;
        transaction.execute_batch(step).map_err(unavailable)?;
        transaction
            .pragma_update(None, "user_version", version)
            .map_err(unavailable)?;
        transaction.commit().map_err(unavailable)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Released steps are frozen: a change here must be a new step.
    #[test]
    fn released_steps_are_unchanged() {
        assert_eq!(SCHEMA_VERSION, 1);
        assert_eq!(
            MIGRATIONS[0],
            "CREATE TABLE profile (
        id       TEXT    PRIMARY KEY NOT NULL,
        position INTEGER NOT NULL UNIQUE,
        document TEXT    NOT NULL
    ) STRICT;"
        );
    }

    #[test]
    fn migrating_twice_changes_nothing() -> Result<(), RepositoryError> {
        let mut connection = Connection::open_in_memory().map_err(unavailable)?;
        migrate(&mut connection)?;
        migrate(&mut connection)?;
        assert_eq!(schema_version(&connection)?, SCHEMA_VERSION);
        Ok(())
    }
}
