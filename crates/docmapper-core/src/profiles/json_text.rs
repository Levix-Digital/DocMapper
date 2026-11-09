//! `JSON.stringify(value, null, 2)` for JSON values: two-space indentation,
//! `[]` and `{}` for empty containers, strings escaped as V8 does for valid
//! Unicode and numbers written as JavaScript writes them.

use crate::text::js_value::number_to_string;
use serde_json::Value;

/// The indented JSON text JavaScript writes for `value`.
pub fn stringify_pretty(value: &Value) -> String {
    let mut out = String::new();
    write_value(&mut out, value, 0);
    out
}

fn write_value(out: &mut String, value: &Value, depth: usize) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Value::Number(number) => out.push_str(&number_to_string(number)),
        Value::String(text) => write_string(out, text),
        Value::Array(items) if items.is_empty() => out.push_str("[]"),
        Value::Array(items) => {
            out.push('[');
            for (position, item) in items.iter().enumerate() {
                if position > 0 {
                    out.push(',');
                }
                newline(out, depth + 1);
                write_value(out, item, depth + 1);
            }
            newline(out, depth);
            out.push(']');
        }
        Value::Object(map) if map.is_empty() => out.push_str("{}"),
        Value::Object(map) => {
            out.push('{');
            for (position, (key, item)) in map.iter().enumerate() {
                if position > 0 {
                    out.push(',');
                }
                newline(out, depth + 1);
                write_string(out, key);
                out.push_str(": ");
                write_value(out, item, depth + 1);
            }
            newline(out, depth);
            out.push('}');
        }
    }
}

fn newline(out: &mut String, depth: usize) {
    out.push('\n');
    out.push_str(&"  ".repeat(depth));
}

/// `QuoteJSONString` for valid Unicode: `"` and `\` escaped, `\b \f \n \r \t`
/// short forms, other code points below U+0020 as `\u00xx`, everything else
/// as it is.
fn write_string(out: &mut String, text: &str) {
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c < '\u{20}' => out.push_str(&format!("\\u{:04x}", u32::from(c))),
            c => out.push(c),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn layout_matches_javascript() {
        let value = json!({"a": [1, {"b": 2}], "c": {}, "d": [], "e": [[], [{}]]});
        assert_eq!(
            stringify_pretty(&value),
            "{\n  \"a\": [\n    1,\n    {\n      \"b\": 2\n    }\n  ],\n  \"c\": {},\n  \"d\": [],\n  \"e\": [\n    [],\n    [\n      {}\n    ]\n  ]\n}"
        );
        assert_eq!(stringify_pretty(&json!("x")), "\"x\"");
        assert_eq!(stringify_pretty(&json!(null)), "null");
        assert_eq!(
            stringify_pretty(&json!([true, false])),
            "[\n  true,\n  false\n]"
        );
    }

    #[test]
    fn numbers_are_written_as_javascript_does() {
        let parsed: Value =
            serde_json::from_str("[16.0, 0.1, 1e21, 1e-7, 123456789012345678901, -2.5e-300]")
                .unwrap_or_default();
        assert_eq!(
            stringify_pretty(&parsed),
            "[\n  16,\n  0.1,\n  1e+21,\n  1e-7,\n  123456789012345680000,\n  -2.5e-300\n]"
        );
    }

    #[test]
    fn strings_are_escaped_as_javascript_does() {
        assert_eq!(
            stringify_pretty(&json!("q\"\\\n\t\u{1}\u{1f}\u{7f}\u{2028}/<\u{8}\u{c}\r📦")),
            "\"q\\\"\\\\\\n\\t\\u0001\\u001f\u{7f}\u{2028}/<\\b\\f\\r📦\""
        );
    }
}
