//! Validation pattern check: the twin of `testRegexPattern`
//! (`frontend/src/services/llm/gemini-service.ts`), an ECMAScript regular
//! expression without flags tested against a value.

/// The answer of a pattern check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatternCheck {
    /// The pattern matches somewhere in the value; `false` when invalid.
    pub matches: bool,
    /// Why the pattern is invalid, in the regex engine's words. Only its
    /// presence is part of parity (ADR-0010).
    pub error: Option<String>,
}

/// Tests `pattern` against `candidate` as `new RegExp(pattern).test(candidate)`.
pub fn check_validation_pattern(pattern: &str, candidate: &str) -> PatternCheck {
    let units: Vec<u32> = pattern.encode_utf16().map(u32::from).collect();
    if let Some(error) = early_error(&units) {
        return PatternCheck {
            matches: false,
            error: Some(error.into()),
        };
    }
    match regress::Regex::from_unicode(pattern_code_units(&units).into_iter(), "") {
        Ok(regex) => {
            let units: Vec<u16> = candidate.encode_utf16().collect();
            PatternCheck {
                matches: regex.find_from_ucs2(&units, 0).next().is_some(),
                error: None,
            }
        }
        Err(error) => PatternCheck {
            matches: false,
            error: Some(error.text),
        },
    }
}

const BACKSLASH: u32 = '\\' as u32;
const LETTER_U: u32 = 'u' as u32;
const LETTER_C: u32 = 'c' as u32;
/// Digits of a `\uHHHH` escape.
const HEX4_DIGITS: usize = 4;

/// The pattern as JavaScript reads it without the Unicode flag: a sequence
/// of UTF-16 code units, which `regress` then matches against code units.
/// Two legacy forms that `regress` reads differently are rewritten:
///
/// - `\u` not followed by four hex digits is the letter `u` (so `\u{61}` is
///   `u` repeated 61 times; `regress` reads a code point);
/// - a `\uHHHH` escape of a surrogate stands for that one code unit
///   (`regress` joins `\uD83D\uDE00` into one code point), so it is passed
///   as the raw unit.
fn pattern_code_units(units: &[u32]) -> Vec<u32> {
    let mut result = Vec::with_capacity(units.len());
    let mut in_class = false;
    let mut i = 0;
    while i < units.len() {
        let unit = units[i];
        if unit != BACKSLASH || i + 1 >= units.len() {
            if in_class {
                in_class = unit != u32::from(b']');
            } else {
                in_class = unit == u32::from(b'[');
            }
            result.push(unit);
            i += 1;
            continue;
        }
        let escaped = units[i + 1];
        if escaped == LETTER_C && !is_control_letter(units.get(i + 2).copied(), in_class) {
            // `\c` without a control letter is a literal backslash; the `c`
            // is read again as an ordinary character.
            result.extend([BACKSLASH, BACKSLASH]);
            i += 1;
            continue;
        }
        if escaped != LETTER_U {
            result.extend([BACKSLASH, escaped]);
            i += 2;
            continue;
        }
        match hex4(units.get(i + 2..i + 2 + HEX4_DIGITS)) {
            Some(unit) if is_surrogate(unit) => result.push(unit),
            Some(_) => result.extend_from_slice(&units[i..i + 2 + HEX4_DIGITS]),
            None => {
                result.push(LETTER_U);
                i += 2;
                continue;
            }
        }
        i += 2 + HEX4_DIGITS;
    }
    result
}

/// Whether `unit` after `\c` makes a control escape: an ASCII letter, and
/// inside a class also a digit or `_` (Annex B).
fn is_control_letter(unit: Option<u32>, in_class: bool) -> bool {
    let Some(c) = unit.and_then(char::from_u32) else {
        return false;
    };
    c.is_ascii_alphabetic() || (in_class && (c.is_ascii_digit() || c == '_'))
}

/// Syntax errors JavaScript (V8 in Node.js 22) reports and `regress`
/// accepts: a quantified word boundary (`\b*`, `\B{2}`) and a capture group
/// name used twice, even in different alternatives.
fn early_error(units: &[u32]) -> Option<&'static str> {
    let mut names: Vec<&[u32]> = Vec::new();
    let mut in_class = false;
    let mut i = 0;
    while i < units.len() {
        let unit = units[i];
        if unit == BACKSLASH {
            let escaped = units.get(i + 1).copied();
            let boundary = escaped == Some(u32::from(b'b')) || escaped == Some(u32::from(b'B'));
            if boundary && !in_class && starts_with_quantifier(&units[i + 2..]) {
                return Some("Nothing to repeat");
            }
            let literal_backslash = escaped == Some(LETTER_C)
                && !is_control_letter(units.get(i + 2).copied(), in_class);
            i += if literal_backslash { 1 } else { 2 };
            continue;
        }
        if in_class {
            in_class = unit != u32::from(b']');
        } else if unit == u32::from(b'[') {
            in_class = true;
        } else if let Some(name) = group_name_at(&units[i..]) {
            if names.contains(&name) {
                return Some("Duplicate capture group name");
            }
            names.push(name);
        }
        i += 1;
    }
    None
}

/// The name of a `(?<name>` group starting at the first unit.
fn group_name_at(units: &[u32]) -> Option<&[u32]> {
    let rest = units.strip_prefix(&[u32::from(b'('), u32::from(b'?'), u32::from(b'<')])?;
    let end = rest.iter().position(|unit| *unit == u32::from(b'>'))?;
    let name = &rest[..end];
    let lookbehind =
        matches!(name.first(), Some(&u) if u == u32::from(b'=') || u == u32::from(b'!'));
    (!lookbehind).then_some(name)
}

/// Whether a well-formed quantifier starts here: `*`, `+`, `?`, `{n}`,
/// `{n,}` or `{n,m}` (a `{` in any other form is a literal brace).
fn starts_with_quantifier(units: &[u32]) -> bool {
    let is_digit = |unit: &u32| (u32::from(b'0')..=u32::from(b'9')).contains(unit);
    match units.first().copied() {
        Some(u) if u == u32::from(b'*') || u == u32::from(b'+') || u == u32::from(b'?') => true,
        Some(u) if u == u32::from(b'{') => {
            let rest = &units[1..];
            let min = rest.iter().take_while(|u| is_digit(u)).count();
            if min == 0 {
                return false;
            }
            let rest = &rest[min..];
            match rest.first().copied() {
                Some(u) if u == u32::from(b'}') => true,
                Some(u) if u == u32::from(b',') => {
                    let max = rest[1..].iter().take_while(|u| is_digit(u)).count();
                    rest.get(1 + max).copied() == Some(u32::from(b'}'))
                }
                _ => false,
            }
        }
        _ => false,
    }
}

fn hex4(digits: Option<&[u32]>) -> Option<u32> {
    digits?.iter().try_fold(0, |value, unit| {
        char::from_u32(*unit)?
            .to_digit(16)
            .map(|digit| value * 16 + digit)
    })
}

fn is_surrogate(unit: u32) -> bool {
    (0xD800..=0xDFFF).contains(&unit)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn matches(pattern: &str, candidate: &str) -> bool {
        check_validation_pattern(pattern, candidate).matches
    }

    #[test]
    fn valid_patterns_match_like_javascript_without_flags() {
        assert!(matches("^\\d{3}$", "123"));
        assert!(!matches("^\\d{3}$", "1234"));
        assert!(!matches("^.$", "😀"));
        assert!(matches("^..$", "😀"));
        assert!(matches("\\p{L}", "p{L}"));
        assert!(!matches("\\p{L}", "a"));
        assert!(matches("^\\s$", "\u{FEFF}"));
        assert!(!matches("^\\s$", "\u{0085}"));
        assert!(matches("a{", "a{"));
        assert!(matches("]", "]"));
    }

    #[test]
    fn invalid_patterns_do_not_match_and_report_an_error() {
        let check = check_validation_pattern("(", "(");
        assert!(!check.matches);
        assert!(check.error.is_some_and(|text| !text.is_empty()));
    }

    #[test]
    fn legacy_unicode_escape_is_the_letter_u() {
        assert!(matches("^\\u{3}$", "uuu"));
        assert!(!matches("\\u{61}", "a"));
        assert!(matches("^[\\u{61}]+$", "u{61}"));
        assert!(matches("^\\u0061$", "a"));
        assert!(matches("^\\\\u{2}$", "\\uu"));
        assert!(matches("^\\u$", "u"));
    }

    #[test]
    fn surrogates_are_code_units() {
        assert!(matches("^\\uD83D\\uDE00$", "😀"));
        assert!(matches("^😀+$", "😀"));
        assert!(!matches("^[😀]$", "😀"));
        assert!(matches("^[😀]{2}$", "😀"));
        assert!(matches("^\\uD83D.$", "😀"));
        assert!(matches("😀|(a)", "😀"));
    }

    #[test]
    fn code_units_only_rewrite_legacy_unicode_escapes() {
        let units = |text: &str| -> Vec<u32> { text.encode_utf16().map(u32::from).collect() };
        let rewritten = |text: &str| pattern_code_units(&units(text));
        assert_eq!(rewritten("\\u{61}"), units("u{61}"));
        assert_eq!(rewritten("\\u0061\\\\u\\d\\"), units("\\u0061\\\\u\\d\\"));
        assert_eq!(rewritten("\\uD83D\\uDE00"), vec![0xD83D, 0xDE00]);
        assert_eq!(rewritten("\\uD83"), units("uD83"));
    }

    #[test]
    fn backslash_c_without_a_control_letter_is_a_literal_backslash() {
        assert!(matches("^\\c\\u*$", "\\cuu"));
        assert!(matches("^\\cA$", "\u{1}"));
        assert!(matches("^\\c1$", "\\c1"));
        assert!(matches("^[\\c1]$", "\u{11}"));
        assert!(matches("^[\\c_]$", "\u{1f}"));
        assert!(matches("^[\\c*]+$", "\\c*"));
    }

    #[test]
    fn quantified_word_boundaries_are_errors() {
        for pattern in ["\\b*", "\\B+", "\\b?", "a|\\b{2}", "\\b{2,}", "\\B{1,3}?"] {
            assert!(
                check_validation_pattern(pattern, "").error.is_some(),
                "{pattern}"
            );
        }
        for pattern in ["\\b{a", "\\b{,2}", "[\\b]*", "\\\\b*", "\\b"] {
            assert!(
                check_validation_pattern(pattern, "").error.is_none(),
                "{pattern}"
            );
        }
    }

    #[test]
    fn repeated_group_names_are_errors() {
        for pattern in ["(?<a>x)|(?<a>y)", "(?<a>x)(?:(?<a>y))"] {
            assert!(
                check_validation_pattern(pattern, "").error.is_some(),
                "{pattern}"
            );
        }
        for pattern in ["[(?<a>x)](?<a>y)", "(?<=a)(?<=a)", "(?<a>x)(?<b>y)"] {
            assert!(
                check_validation_pattern(pattern, "").error.is_none(),
                "{pattern}"
            );
        }
    }
}
