//! Local SQLite repository of DocMapper profiles: the default storage of
//! ADR-0006. SQLite is compiled into the binary (`bundled`), so no system
//! library is needed.

mod migrations;
mod repository;

pub use migrations::SCHEMA_VERSION;
pub use repository::SqliteProfileRepository;
