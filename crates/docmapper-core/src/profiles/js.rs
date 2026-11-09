//! The JavaScript semantics the profile store relies on: strict equality,
//! truthiness, property reads, method calls on non-text values with V8's
//! type error texts, template literal text, `Date.prototype.toISOString` and
//! the parsing of `.dmap` text (research R3 and R7 of M3).

use super::document::into_ecmascript_order;
use super::store::StoreError;
use crate::text::file_name::civil_from_days;
use crate::text::js_value::{number_to_string, to_js_string};
use serde_json::{Number, Value};

/// `a === b` for values that may be `undefined` (`None`). Objects and arrays
/// read from JSON are never the same object, so never equal.
pub(crate) fn strict_equals(a: Option<&Value>, b: Option<&Value>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(Value::Null), Some(Value::Null)) => true,
        (Some(Value::Bool(x)), Some(Value::Bool(y))) => x == y,
        (Some(Value::Number(x)), Some(Value::Number(y))) => x.as_f64() == y.as_f64(),
        (Some(Value::String(x)), Some(Value::String(y))) => x == y,
        _ => false,
    }
}

/// `!!value`: `undefined`, `null`, `false`, `0` and `""` are falsy.
pub(crate) fn is_truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(flag)) => *flag,
        Some(Value::Number(number)) => number.as_f64().is_some_and(|n| n != 0.0),
        Some(Value::String(text)) => !text.is_empty(),
        Some(Value::Array(_) | Value::Object(_)) => true,
    }
}

/// `value.<key>` on a parsed JSON value: an own key of an object; `null`
/// throws; other values have no such own key here (`undefined`).
pub(crate) fn read_property<'a>(
    value: &'a Value,
    key: &str,
) -> Result<Option<&'a Value>, StoreError> {
    match value {
        Value::Null => Err(StoreError::Type(format!(
            "Cannot read properties of null (reading '{key}')"
        ))),
        Value::Object(map) => Ok(map.get(key)),
        _ => Ok(None),
    }
}

/// The text of calling the string method `method` on `value`, written in the
/// source as `expression.method(...)`, or V8's type error when `value` is not
/// text.
pub(crate) fn text_receiver<'a>(
    value: Option<&'a Value>,
    expression: &str,
    method: &str,
) -> Result<&'a str, StoreError> {
    match value {
        Some(Value::String(text)) => Ok(text),
        None => Err(StoreError::Type(format!(
            "Cannot read properties of undefined (reading '{method}')"
        ))),
        Some(Value::Null) => Err(StoreError::Type(format!(
            "Cannot read properties of null (reading '{method}')"
        ))),
        Some(_) => Err(StoreError::Type(format!(
            "{expression}.{method} is not a function"
        ))),
    }
}

/// `${value}` in a template literal (`undefined` gives `undefined`).
pub(crate) fn template_text(value: Option<&Value>) -> Result<String, StoreError> {
    match value {
        None => Ok("undefined".to_string()),
        Some(value) => to_js_string(value)
            .map_err(|_| StoreError::Type("Cannot convert object to primitive value".to_string())),
    }
}

/// `${number}` for a clock reading.
pub(crate) fn number_text(value: f64) -> String {
    match Number::from_f64(value) {
        Some(number) => number_to_string(&number),
        None => (if value.is_nan() {
            "NaN"
        } else if value > 0.0 {
            "Infinity"
        } else {
            "-Infinity"
        })
        .to_string(),
    }
}

/// Largest time value a `Date` holds, in milliseconds either side of the epoch.
const MAX_TIME: f64 = 8.64e15;

/// `new Date(millis).toISOString()`.
///
/// # Errors
/// `RangeError: Invalid time value` outside the range a `Date` holds.
pub(crate) fn iso_string(millis: f64) -> Result<String, StoreError> {
    if !millis.is_finite() || millis.abs() > MAX_TIME {
        return Err(StoreError::Range("Invalid time value".to_string()));
    }
    // TimeClip: whole milliseconds, within ±8.64e15, so the cast is exact.
    let time = millis.trunc() as i64;
    let days = time.div_euclid(86_400_000);
    let in_day = time.rem_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    let year_text = if (0..=9999).contains(&year) {
        format!("{year:04}")
    } else if year < 0 {
        format!("-{:06}", -year)
    } else {
        format!("+{year:06}")
    };
    Ok(format!(
        "{year_text}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        in_day / 3_600_000,
        in_day / 60_000 % 60,
        in_day / 1_000 % 60,
        in_day % 1_000
    ))
}

/// `JSON.parse(text)`, with objects in ECMAScript key order. Text that is not
/// JSON, or holds a lone surrogate or a number beyond the f64 range, is a
/// `SyntaxError` with the reader's own message (FR-009 of M3).
pub(crate) fn parse_json(text: &str) -> Result<Value, StoreError> {
    serde_json::from_str::<Value>(text)
        .map(into_ecmascript_order)
        .map_err(|error| StoreError::Syntax(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn strict_equality_compares_primitives_only() {
        assert!(strict_equals(None, None));
        assert!(strict_equals(Some(&json!(null)), Some(&json!(null))));
        assert!(strict_equals(Some(&json!(true)), Some(&json!(true))));
        assert!(strict_equals(Some(&json!(7)), Some(&json!(7.0))));
        assert!(strict_equals(Some(&json!("a")), Some(&json!("a"))));
        assert!(!strict_equals(Some(&json!("7")), Some(&json!(7))));
        assert!(!strict_equals(Some(&json!({})), Some(&json!({}))));
        assert!(!strict_equals(Some(&json!([])), Some(&json!([]))));
        assert!(!strict_equals(None, Some(&json!(null))));
    }

    #[test]
    fn truthiness() {
        for falsy in [json!(null), json!(false), json!(0), json!(0.0), json!("")] {
            assert!(!is_truthy(Some(&falsy)), "{falsy}");
        }
        assert!(!is_truthy(None));
        for truthy in [json!(true), json!(-1), json!("0"), json!([]), json!({})] {
            assert!(is_truthy(Some(&truthy)), "{truthy}");
        }
    }

    #[test]
    fn property_reads_and_receivers() {
        assert!(
            matches!(read_property(&json!(null), "name"), Err(StoreError::Type(m)) if m == "Cannot read properties of null (reading 'name')")
        );
        assert_eq!(
            read_property(&json!({"name": 1}), "name").ok().flatten(),
            Some(&json!(1))
        );
        assert_eq!(read_property(&json!("text"), "name").ok().flatten(), None);
        assert_eq!(
            text_receiver(Some(&json!("x")), "a.b", "replace").ok(),
            Some("x")
        );
        let message = |r: Result<&str, StoreError>| match r {
            Err(StoreError::Type(m)) => m,
            other => panic!("{other:?}"),
        };
        assert_eq!(
            message(text_receiver(None, "a.b", "replace")),
            "Cannot read properties of undefined (reading 'replace')"
        );
        assert_eq!(
            message(text_receiver(Some(&json!(null)), "a.b", "replace")),
            "Cannot read properties of null (reading 'replace')"
        );
        assert_eq!(
            message(text_receiver(Some(&json!(5)), "a.b", "replace")),
            "a.b.replace is not a function"
        );
    }

    #[test]
    fn template_text_follows_string_conversion() {
        assert_eq!(template_text(None).ok().as_deref(), Some("undefined"));
        assert_eq!(
            template_text(Some(&json!(1e21))).ok().as_deref(),
            Some("1e+21")
        );
        assert_eq!(
            template_text(Some(&json!(["a", null, 1.5])))
                .ok()
                .as_deref(),
            Some("a,,1.5")
        );
        assert!(matches!(
            template_text(Some(&json!({"toString": 1}))),
            Err(StoreError::Type(_))
        ));
    }

    #[test]
    fn number_text_of_clock_readings() {
        assert_eq!(number_text(1_794_225_600_000.0), "1794225600000");
        assert_eq!(number_text(0.5), "0.5");
        assert_eq!(number_text(f64::NAN), "NaN");
        assert_eq!(number_text(f64::INFINITY), "Infinity");
        assert_eq!(number_text(f64::NEG_INFINITY), "-Infinity");
    }

    #[test]
    fn iso_strings_match_javascript() {
        let iso = |m: f64| iso_string(m).unwrap_or_default();
        assert_eq!(iso(0.0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso(1_794_225_600_001.9), "2026-11-09T12:00:00.001Z");
        assert_eq!(iso(951_782_399_999.0), "2000-02-28T23:59:59.999Z");
        assert_eq!(iso(253_402_300_799_999.0), "9999-12-31T23:59:59.999Z");
        assert_eq!(iso(253_402_300_800_000.0), "+010000-01-01T00:00:00.000Z");
        assert_eq!(iso(-1.0), "1969-12-31T23:59:59.999Z");
        assert_eq!(iso(-62_198_755_200_000.0), "-000001-01-01T00:00:00.000Z");
        assert_eq!(iso(8.64e15), "+275760-09-13T00:00:00.000Z");
        assert!(matches!(
            iso_string(8.64e15 + 1.0),
            Err(StoreError::Range(_))
        ));
        assert!(matches!(iso_string(f64::NAN), Err(StoreError::Range(_))));
    }

    #[test]
    fn parsing_orders_keys_and_reports_syntax_errors() {
        let parsed = parse_json(r#"{"b": 1, "1": 2}"#).unwrap_or_default();
        assert_eq!(
            parsed
                .as_object()
                .map(|m| m.keys().cloned().collect::<Vec<_>>()),
            Some(vec!["1".into(), "b".into()])
        );
        for bad in ["", "{", "[1,]", r#""\ud800""#, "1e400", "{} x"] {
            assert!(
                matches!(parse_json(bad), Err(StoreError::Syntax(_))),
                "{bad}"
            );
        }
    }
}
