//! Commands the interface calls with `invoke` (contracts in
//! `specs/006-m0-foundation/contracts/desktop-commands.md` and
//! `specs/009-profiles-ui-wiring/contracts/desktop-profile-commands.md`). Each
//! one is a thin handler over a core call.

use crate::profiles::{document_from, export_to, CommandError, ProfileState, SaveTarget};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

/// Returns the version of the DocMapper core.
#[tauri::command]
pub fn core_version() -> &'static str {
    docmapper_core::version()
}

/// `createEmptyProfile(name)`: a missing or `null` name gives the default name.
#[tauri::command]
pub fn profiles_create_empty(
    state: State<'_, ProfileState>,
    name: Option<Value>,
) -> Result<Value, CommandError> {
    create_empty(&state, name)
}

/// `getAllProfiles()`.
#[tauri::command]
pub fn profiles_list(state: State<'_, ProfileState>) -> Result<Vec<Value>, CommandError> {
    list(&state)
}

/// `getProfileById(id)`.
#[tauri::command]
pub fn profiles_get(
    state: State<'_, ProfileState>,
    id: Value,
) -> Result<Option<Value>, CommandError> {
    get(&state, &id)
}

/// `saveProfile(profile)`.
#[tauri::command]
pub fn profiles_save(state: State<'_, ProfileState>, profile: Value) -> Result<(), CommandError> {
    save(&state, profile)
}

/// `deleteProfile(id)`.
#[tauri::command]
pub fn profiles_delete(state: State<'_, ProfileState>, id: Value) -> Result<bool, CommandError> {
    delete(&state, &id)
}

/// `duplicateProfile(id)`.
#[tauri::command]
pub fn profiles_duplicate(
    state: State<'_, ProfileState>,
    id: Value,
) -> Result<Option<Value>, CommandError> {
    duplicate(&state, &id)
}

/// `importProfileFromDocMapper(text)`.
#[tauri::command]
pub fn profiles_import(
    state: State<'_, ProfileState>,
    text: String,
) -> Result<Value, CommandError> {
    import(&state, &text)
}

/// Exports a profile (stored or not) to a `.dmap` file the user chooses in the
/// native save dialog. Returns the saved path, or `null` when cancelled.
/// Asynchronous so the dialog never blocks the main thread.
#[tauri::command]
pub async fn profiles_export(
    app: tauri::AppHandle,
    profile: Value,
) -> Result<Option<PathBuf>, CommandError> {
    export_to(profile, &DialogTarget(app))
}

/// The native save dialog, driven from Rust: the window needs no dialog or
/// file system permission.
struct DialogTarget(tauri::AppHandle);

impl SaveTarget for DialogTarget {
    fn choose(&self, proposed_file_name: &str) -> Option<PathBuf> {
        self.0
            .dialog()
            .file()
            .set_file_name(proposed_file_name)
            .add_filter("DocMapper profile", &["dmap"])
            .blocking_save_file()
            .and_then(|path| path.into_path().ok())
    }
}

fn create_empty(state: &ProfileState, name: Option<Value>) -> Result<Value, CommandError> {
    let name = name.filter(|value| !value.is_null());
    state.with_store(|store| Ok(store.create_empty_profile(name)?.into_value()))
}

fn list(state: &ProfileState) -> Result<Vec<Value>, CommandError> {
    state.with_store(|store| {
        Ok(store
            .all_profiles()?
            .into_iter()
            .map(|p| p.into_value())
            .collect())
    })
}

fn get(state: &ProfileState, id: &Value) -> Result<Option<Value>, CommandError> {
    state.with_store(|store| Ok(store.profile_by_id(id)?.map(|p| p.into_value())))
}

fn save(state: &ProfileState, profile: Value) -> Result<(), CommandError> {
    let document = document_from(profile)?;
    state.with_store(|store| store.save_profile(document))
}

fn delete(state: &ProfileState, id: &Value) -> Result<bool, CommandError> {
    state.with_store(|store| store.delete_profile(id))
}

fn duplicate(state: &ProfileState, id: &Value) -> Result<Option<Value>, CommandError> {
    state.with_store(|store| Ok(store.duplicate_profile(id)?.map(|p| p.into_value())))
}

fn import(state: &ProfileState, text: &str) -> Result<Value, CommandError> {
    state.with_store(|store| Ok(store.import_docmapper(text)?.into_value()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profiles::tests::{memory_state, FixedClock, FixedRandom};
    use docmapper_core::profiles::{InMemoryProfileRepository, ProfileDocument, ProfileStore};
    use serde_json::json;

    const FILE: &str = r#"{"name":"Invoice","fields":[{"id":"f","x":12.5}],"destinationMappings":[],"extra":true}"#;

    /// The core store over memory with the same clock and random source as
    /// `memory_state`: what every command must match.
    fn reference() -> ProfileStore<InMemoryProfileRepository, FixedClock, FixedRandom> {
        ProfileStore::new(
            InMemoryProfileRepository::default(),
            FixedClock(1_767_225_600_000.0),
            FixedRandom(0.5),
        )
    }

    fn values(documents: Vec<ProfileDocument>) -> Vec<Value> {
        documents
            .into_iter()
            .map(ProfileDocument::into_value)
            .collect()
    }

    #[test]
    fn core_version_returns_the_core_version() {
        assert_eq!(core_version(), docmapper_core::VERSION);
    }

    #[test]
    fn create_empty_matches_the_core_store() {
        let state = memory_state();
        let mut core = reference();
        let expected = core.create_empty_profile(None).expect("core").into_value();
        assert_eq!(create_empty(&state, None), Ok(expected.clone()));
        assert_eq!(create_empty(&state, Some(Value::Null)), Ok(expected));
        let named = core
            .create_empty_profile(Some(json!("Named")))
            .expect("core")
            .into_value();
        assert_eq!(create_empty(&state, Some(json!("Named"))), Ok(named));
        assert_eq!(list(&state), Ok(vec![]), "creating stores nothing");
    }

    #[test]
    fn the_profile_lifecycle_matches_the_core_store() {
        let state = memory_state();
        let mut core = reference();

        let imported = import(&state, FILE).expect("import");
        assert_eq!(
            imported,
            core.import_docmapper(FILE).expect("core").into_value()
        );
        let id = imported["id"].clone();

        let mut renamed = imported.clone();
        renamed["name"] = json!("Renamed");
        save(&state, renamed.clone()).expect("save");
        core.save_profile(ProfileDocument::from_value(renamed).expect("object"))
            .expect("core");

        let copy = duplicate(&state, &id).expect("duplicate");
        assert_eq!(
            copy,
            core.duplicate_profile(&id)
                .expect("core")
                .map(ProfileDocument::into_value)
        );

        assert_eq!(list(&state), Ok(values(core.all_profiles().expect("core"))));
        assert_eq!(
            get(&state, &id),
            Ok(core
                .profile_by_id(&id)
                .expect("core")
                .map(ProfileDocument::into_value))
        );
        assert_eq!(get(&state, &json!("missing")), Ok(None));
        assert_eq!(duplicate(&state, &json!("missing")), Ok(None));

        assert_eq!(delete(&state, &id), Ok(true));
        core.delete_profile(&id).expect("core");
        assert_eq!(list(&state), Ok(values(core.all_profiles().expect("core"))));
    }

    #[test]
    fn imported_keys_keep_their_order() {
        let state = memory_state();
        let imported = import(&state, FILE).expect("import");
        let keys: Vec<&String> = imported.as_object().expect("object").keys().collect();
        assert_eq!(
            keys,
            [
                "name",
                "fields",
                "destinationMappings",
                "extra",
                "id",
                "updatedAt"
            ]
        );
        let stored = list(&state).expect("list");
        assert_eq!(stored[0]["fields"][0]["x"], json!(12.5));
    }

    #[test]
    fn import_errors_keep_their_kind() {
        let state = memory_state();
        assert_eq!(import(&state, "{").expect_err("error").kind, "syntax");
        assert_eq!(
            import(&state, r#"{"name":"A"}"#).expect_err("error"),
            CommandError {
                kind: "invalid_file",
                message: docmapper_core::profiles::INVALID_FILE_MESSAGE.to_string(),
            }
        );
        assert_eq!(list(&state), Ok(vec![]));
    }

    #[test]
    fn saving_a_value_that_is_not_an_object_is_a_type_error() {
        let state = memory_state();
        assert_eq!(save(&state, json!("x")).expect_err("error").kind, "type");
    }
}
