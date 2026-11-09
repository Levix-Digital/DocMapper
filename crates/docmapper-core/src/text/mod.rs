//! Text utilities ported from the TypeScript application with ECMAScript
//! semantics (migration module M1, parity module `text`).

pub mod ecmascript;
mod file_name;
pub mod js_value;
mod property_map;
mod translation;
mod validation_pattern;

pub use file_name::{format_output_file_name, CalendarDate, FileNameError, FileNameOptions};
pub use property_map::{array_index, PropertyMap};
pub use translation::{flatten_dictionary, sanitize_punctuation, FlatDictionary, LeafWithoutText};
pub use validation_pattern::{check_validation_pattern, PatternCheck};
