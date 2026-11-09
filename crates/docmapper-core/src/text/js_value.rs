//! `String(value)` for the values JSON can carry.

use serde_json::{Number, Value};

/// `Number.prototype.toString()` of the number JSON text stands for. Integers
/// beyond 2^53 are rounded to the nearest f64 first, as `JSON.parse` does.
pub fn number_to_string(number: &Number) -> String {
    let value = number.as_f64().unwrap_or(f64::NAN);
    if value.is_nan() {
        return "NaN".into();
    }
    let mut buffer = ryu_js::Buffer::new();
    buffer.format(value).to_string()
}

/// The own key that hides the `toString` method an object inherits.
const TO_STRING_KEY: &str = "toString";

/// An object has no text: its own `toString` key (always data, never a
/// function, in JSON) hides the inherited method, and `valueOf` gives back
/// the object (`TypeError: Cannot convert object to primitive value`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NotConvertible;

/// `String(value)`: text as it is, numbers as JavaScript writes them,
/// `true`/`false`, `null`, arrays joined with `,` (with `null` items as
/// empty text) and objects as `[object Object]`.
///
/// # Errors
/// [`NotConvertible`] for an object with an own `toString` key, as in
/// JavaScript.
pub fn to_js_string(value: &Value) -> Result<String, NotConvertible> {
    Ok(match value {
        Value::Null => "null".into(),
        Value::Bool(flag) => flag.to_string(),
        Value::Number(number) => number_to_string(number),
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .map(|item| match item {
                Value::Null => Ok(String::new()),
                other => to_js_string(other),
            })
            .collect::<Result<Vec<_>, _>>()?
            .join(","),
        Value::Object(object) if object.contains_key(TO_STRING_KEY) => return Err(NotConvertible),
        Value::Object(_) => "[object Object]".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn text_of(json_text: &str) -> String {
        to_js_string(&serde_json::from_str(json_text).unwrap_or(Value::Null)).unwrap_or_default()
    }

    #[test]
    fn numbers_are_written_as_javascript_writes_them() {
        assert_eq!(text_of("1e21"), "1e+21");
        assert_eq!(text_of("1e20"), "100000000000000000000");
        assert_eq!(text_of("0.1"), "0.1");
        assert_eq!(text_of("-1e-7"), "-1e-7");
        assert_eq!(text_of("0.000001"), "0.000001");
        assert_eq!(text_of("5"), "5");
        assert_eq!(text_of("-0"), "0");
        assert_eq!(text_of("1.5e300"), "1.5e+300");
        assert_eq!(text_of("12345678901234567890"), "12345678901234567000");
        assert_eq!(text_of("9007199254740993"), "9007199254740992");
        assert_eq!(text_of("-9223372036854775808"), "-9223372036854776000");
    }

    fn text(value: Value) -> String {
        to_js_string(&value).unwrap_or_else(|_| "<not convertible>".into())
    }

    #[test]
    fn other_values() {
        assert_eq!(text(json!(true)), "true");
        assert_eq!(text(json!(false)), "false");
        assert_eq!(text(json!(null)), "null");
        assert_eq!(text(json!("x")), "x");
        assert_eq!(text(json!({"a": 1})), "[object Object]");
        assert_eq!(text(json!({"valueOf": 1})), "[object Object]");
    }

    #[test]
    fn arrays_join_with_commas_and_empty_nulls() {
        assert_eq!(
            text(json!([1, [null, 3], "a", {}])),
            "1,,3,a,[object Object]"
        );
        assert_eq!(text(json!([])), "");
        assert_eq!(text(json!([null])), "");
        assert_eq!(text(json!([[[]]])), "");
    }

    #[test]
    fn objects_with_an_own_to_string_key_have_no_text() {
        assert_eq!(to_js_string(&json!({"toString": ""})), Err(NotConvertible));
        assert_eq!(
            to_js_string(&json!([1, [{"toString": 1}]])),
            Err(NotConvertible)
        );
    }
}
