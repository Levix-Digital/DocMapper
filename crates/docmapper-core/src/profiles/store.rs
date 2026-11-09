//! The profile store: twin of `profile-store.ts` (parity module `profiles`).
//! Every operation reads the clock, the random source and the repository in
//! the order the TypeScript code does.

use super::document::ProfileDocument;
use super::js::{
    is_truthy, iso_string, number_text, parse_json, read_property, strict_equals, template_text,
    text_receiver,
};
use super::ports::{Clock, ProfileRepository, RandomSource, RepositoryError};
use crate::text::ecmascript::{number_to_radix_string, to_lower_case};
use serde_json::{json, Value};
use std::fmt;

/// Id of the built-in profile older versions stored; purged on every listing.
pub const BUILTIN_CMR_PROFILE_ID: &str = "builtin-cmr-standard";

/// Name of a profile created without one.
pub const DEFAULT_PROFILE_NAME: &str = "Untitled Profile";

/// Output name pattern of a new profile.
pub const DEFAULT_OUTPUT_FILE_NAME_PATTERN: &str = "{originalName}_{seq:001}";

/// Message of a `.dmap` file without a name, fields or destination mappings.
pub const INVALID_FILE_MESSAGE: &str =
    "Invalid .dmap file format: Missing name, fields, or destinationMappings.";

/// Why an operation failed; each kind stands for the error JavaScript throws.
#[derive(Debug, Clone, PartialEq)]
pub enum StoreError {
    /// The repository failed (no JavaScript twin: browser storage does not fail).
    Repository(RepositoryError),
    /// `Error`: the file lacks a name, a field list or a destination mapping list.
    InvalidFile,
    /// `SyntaxError`: the file is not JSON; the message is this reader's own.
    Syntax(String),
    /// `TypeError` with V8's message.
    Type(String),
    /// `RangeError` with V8's message (a clock outside the `Date` range).
    Range(String),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Repository(error) => error.fmt(f),
            Self::InvalidFile => f.write_str(INVALID_FILE_MESSAGE),
            Self::Syntax(message) => write!(f, "not a valid .dmap file: {message}"),
            Self::Type(message) | Self::Range(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<RepositoryError> for StoreError {
    fn from(error: RepositoryError) -> Self {
        Self::Repository(error)
    }
}

/// The profile operations of the application over a repository.
pub struct ProfileStore<R, C, G> {
    repository: R,
    clock: C,
    random: G,
}

impl<R: ProfileRepository, C: Clock, G: RandomSource> ProfileStore<R, C, G> {
    pub fn new(repository: R, clock: C, random: G) -> Self {
        Self {
            repository,
            clock,
            random,
        }
    }

    /// The repository, to read it back.
    pub fn repository(&self) -> &R {
        &self.repository
    }

    /// `profile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.
    fn new_id(&mut self) -> String {
        let now = number_text(self.clock.now_millis());
        let random = number_to_radix_string(self.random.next_f64(), 36);
        let suffix: String = random.chars().skip(2).take(5).collect();
        format!("profile-{now}-{suffix}")
    }

    /// `new Date().toISOString()`.
    fn now_iso(&self) -> Result<String, StoreError> {
        iso_string(self.clock.now_millis())
    }

    /// `createEmptyProfile(name)`; `None` stands for `undefined` (the default name).
    ///
    /// # Errors
    /// `Range` for a clock outside the `Date` range.
    pub fn create_empty_profile(
        &mut self,
        name: Option<Value>,
    ) -> Result<ProfileDocument, StoreError> {
        let id = self.new_id();
        let name = name.unwrap_or_else(|| json!(DEFAULT_PROFILE_NAME));
        let created_at = self.now_iso()?;
        let updated_at = self.now_iso()?;
        let value = json!({
            "id": id,
            "name": name,
            "version": 1,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "fields": [],
            "destinationMappings": [],
            "outputFileNamePattern": DEFAULT_OUTPUT_FILE_NAME_PATTERN,
        });
        Ok(ProfileDocument::from_value(value).unwrap_or_else(|| unreachable!("an object literal")))
    }

    /// `getAllProfiles()`: the stored profiles, after purging the legacy
    /// built-in profile.
    ///
    /// # Errors
    /// The repository fails.
    pub fn all_profiles(&mut self) -> Result<Vec<ProfileDocument>, StoreError> {
        let mut profiles = self.repository.list()?;
        if profiles
            .iter()
            .any(|p| p.id() == Some(BUILTIN_CMR_PROFILE_ID))
        {
            profiles.retain(|p| p.id() != Some(BUILTIN_CMR_PROFILE_ID));
            self.repository.delete(BUILTIN_CMR_PROFILE_ID)?;
        }
        Ok(profiles)
    }

    /// `getProfileById(id)`.
    ///
    /// # Errors
    /// The repository fails.
    pub fn profile_by_id(&mut self, id: &Value) -> Result<Option<ProfileDocument>, StoreError> {
        Ok(self
            .all_profiles()?
            .into_iter()
            .find(|p| strict_equals(p.get("id"), Some(id))))
    }

    /// `saveProfile(profile)`: replaces the profile with the same id in place,
    /// or appends it, with a new `updatedAt`.
    ///
    /// # Errors
    /// The repository fails or refuses the document; `Range` for a bad clock.
    pub fn save_profile(&mut self, profile: ProfileDocument) -> Result<(), StoreError> {
        // The listing purges and finds the index; the repository saves by id,
        // which is the same place (ids are unique text in a repository).
        self.all_profiles()?;
        let mut updated = profile;
        updated.set("updatedAt", json!(self.now_iso()?));
        self.repository.save(updated)?;
        Ok(())
    }

    /// `deleteProfile(id)`: always `true`.
    ///
    /// # Errors
    /// The repository fails.
    pub fn delete_profile(&mut self, id: &Value) -> Result<bool, StoreError> {
        let profiles = self.all_profiles()?;
        if let Some(text) = id.as_str() {
            if profiles.iter().any(|p| p.id() == Some(text)) {
                self.repository.delete(text)?;
            }
        }
        Ok(true)
    }

    /// `duplicateProfile(id)`: the copy as built before it is saved (the stored
    /// copy has a later `updatedAt`), or `None` when no profile has the id.
    ///
    /// # Errors
    /// The repository fails; `Type` for a name with an own `toString` key.
    pub fn duplicate_profile(&mut self, id: &Value) -> Result<Option<ProfileDocument>, StoreError> {
        let Some(source) = self.profile_by_id(id)? else {
            return Ok(None);
        };
        let profiles = self.all_profiles()?;
        let source_name = template_text(source.get("name"))?;
        let mut base_name = format!("{source_name} (Copy)");
        let mut counter = 1u64;
        while profiles
            .iter()
            .any(|p| p.get("name").and_then(Value::as_str) == Some(base_name.as_str()))
        {
            counter += 1;
            base_name = format!("{source_name} (Copy {counter})");
        }
        let mut clone = source;
        let id = self.new_id();
        clone.set("id", json!(id));
        clone.set("name", json!(base_name));
        clone.set("createdAt", json!(self.now_iso()?));
        clone.set("updatedAt", json!(self.now_iso()?));
        self.save_profile(clone.clone())?;
        Ok(Some(clone))
    }

    /// `importProfileFromDocMapper(text)`: the imported profile as built before
    /// it is saved (the stored one has a later `updatedAt`).
    ///
    /// # Errors
    /// `Syntax` for text that is not JSON, `InvalidFile` without a name or the
    /// two lists, `Type` where JavaScript throws one, or the repository fails.
    pub fn import_docmapper(&mut self, text: &str) -> Result<ProfileDocument, StoreError> {
        let parsed = parse_json(text)?;
        let name = read_property(&parsed, "name")?.cloned();
        let has_lists = matches!(read_property(&parsed, "fields")?, Some(Value::Array(_)))
            && matches!(
                read_property(&parsed, "destinationMappings")?,
                Some(Value::Array(_))
            );
        if !is_truthy(name.as_ref()) || !has_lists {
            return Err(StoreError::InvalidFile);
        }
        let Value::Object(map) = parsed else {
            unreachable!("only an object has the lists")
        };
        let profiles = self.all_profiles()?;
        let mut unique_name = name.clone();
        let mut counter = 1u64;
        while name_taken(&profiles, unique_name.as_ref())? {
            unique_name = Some(json!(format!(
                "{} ({counter})",
                template_text(name.as_ref())?
            )));
            counter += 1;
        }
        let mut imported = ProfileDocument::from_map(map);
        let id = self.new_id();
        imported.set("id", json!(id));
        imported.set("name", unique_name.unwrap_or(Value::Null));
        imported.set("updatedAt", json!(self.now_iso()?));
        self.save_profile(imported.clone())?;
        Ok(imported)
    }
}

/// `profiles.some(p => p.name.toLowerCase() === uniqueName.toLowerCase())`.
fn name_taken(
    profiles: &[ProfileDocument],
    unique_name: Option<&Value>,
) -> Result<bool, StoreError> {
    for profile in profiles {
        let stored = to_lower_case(text_receiver(profile.get("name"), "p.name", "toLowerCase")?);
        let wanted = to_lower_case(text_receiver(unique_name, "uniqueName", "toLowerCase")?);
        if stored == wanted {
            return Ok(true);
        }
    }
    Ok(false)
}
