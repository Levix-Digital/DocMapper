//! `.dmap` export: twin of `exportProfileAsDocMapper` without the browser
//! download, which the interface does with the file it gets.

use super::document::ProfileDocument;
use super::js::text_receiver;
use super::json_text::stringify_pretty;
use super::store::StoreError;

/// Extension of exported profiles (`.docmapper` files are still imported).
pub const DMAP_EXTENSION: &str = ".dmap";

/// An exported profile: its file name and its text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocMapperFile {
    pub file_name: String,
    pub contents: String,
}

/// The profile as `JSON.stringify(profile, null, 2)` in a file named after it:
/// every UTF-16 unit of the name outside `A-Z a-z 0-9 _ -` becomes `_`.
///
/// # Errors
/// `Type` when the name is not text, as in JavaScript.
pub fn export_docmapper(profile: &ProfileDocument) -> Result<DocMapperFile, StoreError> {
    let contents = stringify_pretty(&profile.clone().into_value());
    let name = text_receiver(profile.get("name"), "profile.name", "replace")?;
    let mut file_name = String::with_capacity(name.len() + DMAP_EXTENSION.len());
    for c in name.chars() {
        if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
            file_name.push(c);
        } else {
            file_name.extend(std::iter::repeat_n('_', c.len_utf16()));
        }
    }
    file_name.push_str(DMAP_EXTENSION);
    Ok(DocMapperFile {
        file_name,
        contents,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn doc(value: Value) -> ProfileDocument {
        ProfileDocument::from_value(value).unwrap_or_else(|| unreachable!())
    }

    #[test]
    fn file_name_replaces_each_utf16_unit() -> Result<(), StoreError> {
        let file = export_docmapper(&doc(json!({"name": "São Paulo/2026-x_y 📦"})))?;
        assert_eq!(file.file_name, "S_o_Paulo_2026-x_y___.dmap");
        assert_eq!(file.contents, "{\n  \"name\": \"São Paulo/2026-x_y 📦\"\n}");
        assert_eq!(
            export_docmapper(&doc(json!({"name": ""})))?.file_name,
            ".dmap"
        );
        Ok(())
    }

    #[test]
    fn a_name_that_is_not_text_fails_as_in_javascript() {
        assert!(
            matches!(export_docmapper(&doc(json!({"name": 1}))), Err(StoreError::Type(m)) if m == "profile.name.replace is not a function")
        );
        assert!(matches!(
            export_docmapper(&doc(json!({}))),
            Err(StoreError::Type(_))
        ));
    }
}
