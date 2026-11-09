//! Translation dictionary helpers: twins of `flattenDictionary` and
//! `sanitizePunctuation` (`frontend/src/services/i18n/translation-service.ts`).

use super::ecmascript;
use super::js_value::{to_js_string, NotConvertible};
use super::property_map::PropertyMap;
use serde_json::{Map, Value};

/// Dot-separated dictionary paths to text, in ECMAScript property order.
pub type FlatDictionary = PropertyMap<String>;

/// Trailing marks a translation must not add when the source has none,
/// checked in this order.
const TRAILING_MARKS: [char; 4] = [';', ':', '.', ','];

/// A dictionary leaf that has no text: an array holding an object with an
/// own `toString` key (JavaScript throws `TypeError: Cannot convert object to
/// primitive value`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LeafWithoutText {
    /// Path of the leaf.
    pub path: String,
}

impl std::fmt::Display for LeafWithoutText {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "the dictionary leaf '{}' has no text", self.path)
    }
}

impl std::error::Error for LeafWithoutText {}

/// Flattens a nested dictionary into `a.b.c` paths. Text leaves are kept,
/// `null` leaves are skipped, other leaves become their JavaScript text, and
/// objects are flattened under their path. Keys are visited in ECMAScript
/// property order.
///
/// # Errors
/// [`LeafWithoutText`] where JavaScript cannot turn a leaf into text.
pub fn flatten_dictionary(
    nested: &Map<String, Value>,
    prefix: &str,
) -> Result<FlatDictionary, LeafWithoutText> {
    let mut result = FlatDictionary::new();
    let ordered: PropertyMap<&Value> = nested.iter().map(|(k, v)| (k.clone(), v)).collect();
    for (key, value) in ordered.iter() {
        let path = if prefix.is_empty() {
            key.to_string()
        } else {
            format!("{prefix}.{key}")
        };
        match value {
            Value::Object(child) => {
                for (child_path, text) in flatten_dictionary(child, &path)?.iter() {
                    result.assign_primitive(child_path.to_string(), text.clone());
                }
            }
            Value::Null => {}
            other => {
                let text = to_js_string(other)
                    .map_err(|NotConvertible| LeafWithoutText { path: path.clone() })?;
                result.assign_primitive(path, text);
            }
        }
    }
    Ok(result)
}

/// Removes trailing `;`, `:`, `.` or `,` (once each, in that order) that the
/// translation has and the source does not, trimming as it goes.
pub fn sanitize_punctuation(source: &str, translated: &str) -> String {
    if translated.is_empty() {
        return String::new();
    }
    let mut clean = ecmascript::trim(translated);
    let source = ecmascript::trim(source);
    for mark in TRAILING_MARKS {
        if !source.ends_with(mark) {
            if let Some(without) = clean.strip_suffix(mark) {
                clean = ecmascript::trim(without);
            }
        }
    }
    clean.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn flat(value: Value, prefix: &str) -> Vec<(String, String)> {
        let Value::Object(map) = value else {
            return Vec::new();
        };
        flatten_dictionary(&map, prefix)
            .unwrap_or_default()
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect()
    }

    fn pairs(items: &[(&str, &str)]) -> Vec<(String, String)> {
        items
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn flattens_in_property_order_with_javascript_text() {
        let nested = json!({
            "b": "1", "__proto__": "x", "10": 2, "2": [1, [null, 3]],
            "a": {"__proto__": "y", "c": {"d": ""}}, "z": 1e21, "n": null, "t": false, "e": {}
        });
        assert_eq!(
            flat(nested, ""),
            pairs(&[
                ("2", "1,,3"),
                ("10", "2"),
                ("b", "1"),
                ("a.__proto__", "y"),
                ("a.c.d", ""),
                ("z", "1e+21"),
                ("t", "false")
            ])
        );
    }

    #[test]
    fn prefix_is_prepended() {
        assert_eq!(flat(json!({"a": "x"}), "p"), pairs(&[("p.a", "x")]));
        assert_eq!(
            flat(json!({"__proto__": "x"}), "p"),
            pairs(&[("p.__proto__", "x")])
        );
    }

    #[test]
    fn later_paths_overwrite_in_place() {
        assert_eq!(
            flat(json!({"a.b": "1", "c": "2", "a": {"b": "3"}}), ""),
            pairs(&[("a.b", "3"), ("c", "2")])
        );
    }

    #[test]
    fn leaf_without_text_is_an_error() {
        let Value::Object(map) = json!({"a": {"b": [{"toString": "x"}]}}) else {
            return;
        };
        assert_eq!(
            flatten_dictionary(&map, ""),
            Err(LeafWithoutText { path: "a.b".into() })
        );
    }

    #[test]
    fn punctuation_follows_the_source() {
        assert_eq!(sanitize_punctuation("Name", " Nome: "), "Nome");
        assert_eq!(sanitize_punctuation("Name:", "Nome:"), "Nome:");
        assert_eq!(sanitize_punctuation("Name", "Nome;:., "), "Nome;:.");
        assert_eq!(sanitize_punctuation("Name", "Nome. ;"), "Nome");
        assert_eq!(sanitize_punctuation("x", ""), "");
        assert_eq!(sanitize_punctuation("x", "\u{FEFF}"), "");
    }
}
