# Contract: core profiles API

Module `docmapper_core::profiles`. Twins of `profile-store.ts`; errors carry the JavaScript error kind so the parity test maps them to `{name, message}`.

```rust
pub struct ProfileStore<R: ProfileRepository, C: Clock, G: RandomSource> { /* repository, clock, random */ }

impl<R, C, G> ProfileStore<R, C, G> {
    pub fn new(repository: R, clock: C, random: G) -> Self;
    pub fn create_empty_profile(&mut self, name: Option<Value>) -> ProfileDocument;          // createEmptyProfile
    pub fn all_profiles(&mut self) -> Result<Vec<ProfileDocument>, StoreError>;              // getAllProfiles
    pub fn profile_by_id(&mut self, id: &Value) -> Result<Option<ProfileDocument>, StoreError>; // getProfileById
    pub fn save_profile(&mut self, profile: ProfileDocument) -> Result<(), StoreError>;     // saveProfile
    pub fn delete_profile(&mut self, id: &Value) -> Result<bool, StoreError>;               // deleteProfile
    pub fn duplicate_profile(&mut self, id: &Value) -> Result<Option<ProfileDocument>, StoreError>; // duplicateProfile
    pub fn import_docmapper(&mut self, text: &str) -> Result<ProfileDocument, StoreError>;  // importProfileFromDocMapper
}

pub fn export_docmapper(profile: &ProfileDocument) -> Result<DocMapperFile, StoreError>;     // exportProfileAsDocMapper
pub struct DocMapperFile { pub file_name: String, pub contents: String }

pub enum StoreError {
    Repository(RepositoryError),
    InvalidFile,                       // Error: "Invalid .dmap file format: Missing name, fields, or destinationMappings."
    Syntax(String),                    // SyntaxError, message compared by presence (ADR to add)
    Type(String),                      // TypeError with the V8 message
}

pub trait ProfileRepository {
    fn list(&self) -> Result<Vec<ProfileDocument>, RepositoryError>;   // stored order
    fn save(&mut self, document: ProfileDocument) -> Result<(), RepositoryError>; // replace in place or append
    fn delete(&mut self, id: &str) -> Result<(), RepositoryError>;
}

pub enum RepositoryError { InvalidDocument(String), Corrupt { position: i64, reason: String }, NewerSchema { found: i64, known: i64 }, Unavailable(String) }
```

Crate `docmapper_sqlite`:

```rust
pub struct SqliteProfileRepository { /* rusqlite::Connection */ }
impl SqliteProfileRepository {
    pub fn open(path: &Path) -> Result<Self, RepositoryError>;   // creates or migrates, WAL
    pub fn open_in_memory() -> Result<Self, RepositoryError>;
    pub fn schema_version(&self) -> Result<i64, RepositoryError>;
}
impl ProfileRepository for SqliteProfileRepository { /* ... */ }
```

Ids are text in every profile the interface saves (they come from `createEmptyProfile`, `duplicateProfile` or `importProfileFromDocMapper`). A repository refuses to save a document without a text `id` with `RepositoryError::InvalidDocument`; this input is outside the parity domain and is written down in the subsystem page.
