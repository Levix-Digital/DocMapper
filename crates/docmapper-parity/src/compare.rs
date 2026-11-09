//! Exact comparison of JSON values as TypeScript produces them: object key
//! order matters, numbers compare as the f64 JavaScript holds (so `3` equals
//! `3.0`), and negative zero differs from zero.

use serde_json::Value;
use std::fmt;

/// The first place where two values differ.
#[derive(Debug, Clone, PartialEq)]
pub struct Mismatch {
    /// JSON path of the difference, such as `$.items[2].name`.
    pub path: String,
    pub expected: String,
    pub actual: String,
}

impl fmt::Display for Mismatch {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "at {}: expected {}, got {}",
            self.path, self.expected, self.actual
        )
    }
}

fn mismatch(path: &str, expected: impl fmt::Display, actual: impl fmt::Display) -> Mismatch {
    Mismatch {
        path: path.to_string(),
        expected: expected.to_string(),
        actual: actual.to_string(),
    }
}

fn same_number(expected: &serde_json::Number, actual: &serde_json::Number) -> bool {
    match (expected.as_f64(), actual.as_f64()) {
        (Some(a), Some(b)) => a.to_bits() == b.to_bits(),
        _ => false,
    }
}

/// Compares `actual` with `expected`; returns the first difference.
pub fn exact_eq(expected: &Value, actual: &Value) -> Result<(), Mismatch> {
    compare_at("$", expected, actual)
}

fn compare_at(path: &str, expected: &Value, actual: &Value) -> Result<(), Mismatch> {
    match (expected, actual) {
        (Value::Number(a), Value::Number(b)) if same_number(a, b) => Ok(()),
        (Value::Number(_), Value::Number(_)) => Err(mismatch(path, expected, actual)),
        (Value::Array(a), Value::Array(b)) => {
            if a.len() != b.len() {
                return Err(mismatch(
                    path,
                    format!("{} items", a.len()),
                    format!("{} items", b.len()),
                ));
            }
            a.iter()
                .zip(b)
                .enumerate()
                .try_for_each(|(i, (x, y))| compare_at(&format!("{path}[{i}]"), x, y))
        }
        (Value::Object(a), Value::Object(b)) => {
            let expected_keys: Vec<&String> = a.keys().collect();
            let actual_keys: Vec<&String> = b.keys().collect();
            if expected_keys != actual_keys {
                return Err(mismatch(
                    path,
                    format!("keys {expected_keys:?}"),
                    format!("keys {actual_keys:?}"),
                ));
            }
            a.iter()
                .zip(b.values())
                .try_for_each(|((key, x), y)| compare_at(&format!("{path}.{key}"), x, y))
        }
        _ if expected == actual => Ok(()),
        _ => Err(mismatch(path, expected, actual)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn equal_values_match() {
        let value = json!({"a": [1, "x", null, true], "b": {"c": 0.1}});
        assert_eq!(exact_eq(&value, &value.clone()), Ok(()));
    }

    #[test]
    fn key_order_matters() {
        let expected: Value = serde_json::from_str(r#"{"a":1,"b":2}"#).expect("json");
        let actual: Value = serde_json::from_str(r#"{"b":2,"a":1}"#).expect("json");
        let error = exact_eq(&expected, &actual).expect_err("order differs");
        assert_eq!(error.path, "$");
        assert!(error.expected.contains("\"a\", \"b\""));
    }

    #[test]
    fn numbers_compare_as_javascript_doubles() {
        assert!(exact_eq(&json!(3), &json!(3.0)).is_ok());
        assert!(exact_eq(&json!(0.1), &json!(0.1)).is_ok());
        assert!(exact_eq(&json!(0.30000000000000004), &json!(0.1 + 0.2)).is_ok());
        assert!(exact_eq(&json!(0.3), &json!(0.1 + 0.2)).is_err());
        assert!(exact_eq(&json!(0), &json!(-0.0)).is_err());
    }

    #[test]
    fn json_numbers_round_trip_exactly() {
        let parsed: Value = serde_json::from_str("0.30000000000000004").expect("json");
        assert_eq!(parsed.as_f64(), Some(0.1 + 0.2));
        let large: Value = serde_json::from_str("1e+21").expect("json");
        assert_eq!(large.as_f64(), Some(1e21));
    }

    #[test]
    fn reports_the_path_of_the_first_difference() {
        let expected = json!({"items": [{"name": "a"}, {"name": "b"}]});
        let actual = json!({"items": [{"name": "a"}, {"name": "c"}]});
        let error = exact_eq(&expected, &actual).expect_err("differs");
        assert_eq!(error.path, "$.items[1].name");
        assert_eq!(
            error.to_string(),
            "at $.items[1].name: expected \"b\", got \"c\""
        );
    }

    #[test]
    fn types_and_lengths_must_match() {
        assert!(exact_eq(&json!("1"), &json!(1)).is_err());
        assert!(exact_eq(&json!(null), &json!(false)).is_err());
        assert_eq!(
            exact_eq(&json!([1]), &json!([1, 2]))
                .expect_err("length")
                .expected,
            "1 items"
        );
    }
}
