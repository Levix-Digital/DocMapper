//! What the profile store needs from outside the core: the time, random
//! numbers and a place to keep profiles (FEAT-010).

use super::document::ProfileDocument;
use std::fmt;

/// `Date.now()`: milliseconds since the Unix epoch. Every `Date.now()` and
/// `new Date()` of the TypeScript store is one reading, in the same order.
pub trait Clock {
    fn now_millis(&self) -> f64;
}

/// `Math.random()`: a number in `[0, 1)`.
pub trait RandomSource {
    fn next_f64(&mut self) -> f64;
}

/// The stored profiles, in stored order. Ids are text and unique.
pub trait ProfileRepository {
    /// Every stored profile, in stored order.
    ///
    /// # Errors
    /// The storage cannot be read, or holds a document that is not a JSON object.
    fn list(&self) -> Result<Vec<ProfileDocument>, RepositoryError>;

    /// Replaces the profile with the same id where it stands, or appends it.
    ///
    /// # Errors
    /// The document has no text id, or the storage cannot be written.
    fn save(&mut self, document: ProfileDocument) -> Result<(), RepositoryError>;

    /// Removes the profile with this id, if any.
    ///
    /// # Errors
    /// The storage cannot be written.
    fn delete(&mut self, id: &str) -> Result<(), RepositoryError>;
}

/// Why a repository failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RepositoryError {
    /// The document cannot be stored (for example it has no text id).
    InvalidDocument(String),
    /// A stored document is not a profile JSON object.
    Corrupt { position: i64, reason: String },
    /// The database was written by a newer version of DocMapper.
    NewerSchema { found: i64, known: i64 },
    /// The storage cannot be opened, read or written.
    Unavailable(String),
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDocument(reason) => write!(f, "profile cannot be stored: {reason}"),
            Self::Corrupt { position, reason } => write!(f, "stored profile at position {position} is corrupt: {reason}"),
            Self::NewerSchema { found, known } => write!(
                f,
                "profile database schema version {found} is newer than this version of DocMapper knows ({known})"
            ),
            Self::Unavailable(reason) => write!(f, "profile storage unavailable: {reason}"),
        }
    }
}

impl std::error::Error for RepositoryError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn errors_explain_themselves() {
        assert_eq!(
            RepositoryError::InvalidDocument("no id".into()).to_string(),
            "profile cannot be stored: no id"
        );
        assert_eq!(
            RepositoryError::Corrupt {
                position: 3,
                reason: "not an object".into()
            }
            .to_string(),
            "stored profile at position 3 is corrupt: not an object"
        );
        assert_eq!(
            RepositoryError::NewerSchema { found: 4, known: 1 }.to_string(),
            "profile database schema version 4 is newer than this version of DocMapper knows (1)"
        );
        assert_eq!(
            RepositoryError::Unavailable("locked".into()).to_string(),
            "profile storage unavailable: locked"
        );
    }
}
