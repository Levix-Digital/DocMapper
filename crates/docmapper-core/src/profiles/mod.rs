//! Mapping profiles (migration module M3, parity module `profiles`): the
//! profile store of the application, its `.dmap` files, the typed profile
//! model and the ports to the clock, random numbers and the repository that
//! keeps profiles (ADR-0006).

mod document;
mod export;
mod js;
mod json_text;
mod memory;
pub mod model;
mod ports;
mod store;
mod system;

pub use document::{into_ecmascript_order, ProfileDocument};
pub use export::{export_docmapper, DocMapperFile, DMAP_EXTENSION};
pub use json_text::stringify_pretty;
pub use memory::InMemoryProfileRepository;
pub use ports::{Clock, ProfileRepository, RandomSource, RepositoryError};
pub use store::{
    ProfileStore, StoreError, BUILTIN_CMR_PROFILE_ID, DEFAULT_OUTPUT_FILE_NAME_PATTERN,
    DEFAULT_PROFILE_NAME, INVALID_FILE_MESSAGE,
};
pub use system::{StdRandom, SystemClock};
