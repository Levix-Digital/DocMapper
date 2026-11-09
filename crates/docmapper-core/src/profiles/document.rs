//! A stored profile as the JSON object JavaScript holds: keys in ECMAScript
//! property order and every value kept, including keys the application does
//! not know (research R2 of M3).

use crate::text::array_index;
use serde_json::{Map, Value};

/// One stored profile.
#[derive(Debug, Clone, PartialEq)]
pub struct ProfileDocument(Map<String, Value>);

impl ProfileDocument {
    /// A document from a JSON object whose keys are already in ECMAScript
    /// order (written by `JSON.stringify` or read back from a repository).
    pub fn from_map(map: Map<String, Value>) -> Self {
        Self(map)
    }

    /// A document from a JSON value, or `None` when it is not an object.
    pub fn from_value(value: Value) -> Option<Self> {
        match value {
            Value::Object(map) => Some(Self(map)),
            _ => None,
        }
    }

    /// The `id` key when it holds text.
    pub fn id(&self) -> Option<&str> {
        self.0.get("id").and_then(Value::as_str)
    }

    /// The value of `key`, `None` when the key is absent (`undefined`).
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.0.get(key)
    }

    /// The object, keys in order.
    pub fn as_map(&self) -> &Map<String, Value> {
        &self.0
    }

    /// The document as a JSON value.
    pub fn into_value(self) -> Value {
        Value::Object(self.0)
    }

    /// `{...document, [key]: value}` for a key that is not an array index: an
    /// existing key keeps its position and takes the new value; a new key is
    /// appended.
    pub(crate) fn set(&mut self, key: &str, value: Value) {
        debug_assert!(array_index(key).is_none());
        self.0.insert(key.to_string(), value);
    }
}

/// Puts the keys of every object in `value` in ECMAScript property order:
/// array indexes first in ascending order, then the other keys in insertion
/// order. `JSON.parse` builds objects in this order.
pub fn into_ecmascript_order(value: Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.into_iter().map(into_ecmascript_order).collect()),
        Value::Object(map) => {
            let mut indexes: Vec<(u64, String, Value)> = Vec::new();
            let mut others: Vec<(String, Value)> = Vec::new();
            for (key, item) in map {
                let item = into_ecmascript_order(item);
                match array_index(&key) {
                    Some(index) => indexes.push((index, key, item)),
                    None => others.push((key, item)),
                }
            }
            indexes.sort_by_key(|(index, _, _)| *index);
            let mut ordered = Map::new();
            for (_, key, item) in indexes {
                ordered.insert(key, item);
            }
            for (key, item) in others {
                ordered.insert(key, item);
            }
            Value::Object(ordered)
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn keys(value: &Value) -> Vec<&str> {
        value
            .as_object()
            .map(|m| m.keys().map(String::as_str).collect())
            .unwrap_or_default()
    }

    #[test]
    fn array_indexes_come_first_in_numeric_order() {
        let parsed: Value = serde_json::from_str(
            r#"{"z": 1, "10": 2, "2": 3, "02": 4, "__proto__": {"9": 0, "a": 1}, "4294967295": 5}"#,
        )
        .unwrap_or_default();
        let ordered = into_ecmascript_order(parsed);
        assert_eq!(
            keys(&ordered),
            ["2", "10", "z", "02", "__proto__", "4294967295"]
        );
        assert_eq!(keys(&ordered["__proto__"]), ["9", "a"]);
    }

    #[test]
    fn duplicate_keys_keep_the_first_position_and_the_last_value() {
        let parsed: Value = serde_json::from_str(r#"{"a": 1, "b": 2, "a": 3}"#).unwrap_or_default();
        assert_eq!(keys(&parsed), ["a", "b"]);
        assert_eq!(parsed["a"], json!(3));
    }

    #[test]
    fn set_replaces_in_place_or_appends() {
        let mut document = ProfileDocument::from_value(json!({"name": "n", "id": "x"}))
            .unwrap_or_else(|| unreachable!());
        document.set("id", json!("y"));
        document.set("updatedAt", json!("t"));
        assert_eq!(
            document.into_value(),
            json!({"name": "n", "id": "y", "updatedAt": "t"})
        );
        assert!(ProfileDocument::from_value(json!([1])).is_none());
    }

    #[test]
    fn id_is_text_only() {
        let text =
            ProfileDocument::from_value(json!({"id": "p"})).unwrap_or_else(|| unreachable!());
        let number =
            ProfileDocument::from_value(json!({"id": 7})).unwrap_or_else(|| unreachable!());
        assert_eq!(text.id(), Some("p"));
        assert_eq!(number.id(), None);
        assert_eq!(number.get("id"), Some(&json!(7)));
        assert_eq!(text.as_map().len(), 1);
    }
}
