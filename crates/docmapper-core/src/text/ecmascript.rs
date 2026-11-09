//! The ECMAScript string algorithms the text utilities rely on, written so the
//! Rust results equal the JavaScript ones (ADR-0003).

/// Longest string V8 can build, in UTF-16 code units (2^29 - 24).
pub const MAX_STRING_LENGTH_UTF16: u64 = (1 << 29) - 24;

/// A string would exceed [`MAX_STRING_LENGTH_UTF16`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StringTooLong;

/// Whether `c` is ECMAScript white space or a line terminator: the set of
/// `String.prototype.trim` and of `\s` in regular expressions. It differs
/// from `char::is_whitespace` (U+0085 is not in it, U+FEFF is).
pub fn is_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'..='\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200A}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202F}'
            | '\u{205F}'
            | '\u{3000}'
            | '\u{FEFF}'
    )
}

/// `String.prototype.trim`.
pub fn trim(text: &str) -> &str {
    text.trim_matches(is_whitespace)
}

/// `String.prototype.toLowerCase`: the full, locale-independent Unicode
/// mapping, with the final sigma rule (Rust applies the same rules).
pub fn to_lower_case(text: &str) -> String {
    text.to_lowercase()
}

/// The `length` of a JavaScript string: its UTF-16 code units.
pub fn utf16_len(text: &str) -> u64 {
    if text.is_ascii() {
        return text.len() as u64;
    }
    text.chars().map(|c| c.len_utf16() as u64).sum()
}

/// `String.prototype.padStart(maxLength, fill)` for a fill of one code unit.
/// `max_length` is the JavaScript number passed (it may be very large).
///
/// # Errors
/// [`StringTooLong`] when the result would be longer than V8 allows
/// (`RangeError: Invalid string length`).
pub fn pad_start(text: &str, max_length: f64, fill: char) -> Result<String, StringTooLong> {
    let length = utf16_len(text);
    if max_length.is_nan() || max_length <= length as f64 {
        return Ok(text.to_string());
    }
    if max_length > MAX_STRING_LENGTH_UTF16 as f64 {
        return Err(StringTooLong);
    }
    // max_length is at most MAX_STRING_LENGTH_UTF16 here, so it fits in u64;
    // ToLength truncates a fraction.
    let target = max_length.trunc() as u64;
    let missing = usize::try_from(target.saturating_sub(length)).map_err(|_| StringTooLong)?;
    let mut padded = fill.to_string().repeat(missing);
    padded.push_str(text);
    Ok(padded)
}

/// `GetSubstitution` for a replacement with a pattern that has no capture
/// groups: `$$`, `$&`, `` $` `` and `$'` are expanded; `$n`, `$nn` and
/// `$<` stay as written (there is no group to refer to).
///
/// `start` and `end` are the byte bounds of the match in `subject`.
pub fn substitute(replacement: &str, subject: &str, start: usize, end: usize) -> String {
    let mut result = String::with_capacity(replacement.len());
    let mut chars = replacement.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '$' {
            result.push(c);
            continue;
        }
        match chars.peek() {
            Some('$') => result.push('$'),
            Some('&') => result.push_str(&subject[start..end]),
            Some('`') => result.push_str(&subject[..start]),
            Some('\'') => result.push_str(&subject[end..]),
            _ => {
                result.push('$');
                continue;
            }
        }
        chars.next();
    }
    result
}

/// Whether `a` and `b` are equal ignoring ASCII case, the comparison a
/// regular expression with the `i` flag and no `u` flag makes for ASCII
/// pattern letters (no non-ASCII character folds to an ASCII letter there).
pub fn eq_ignore_ascii_case_chars(text: &str, literal: &str) -> bool {
    text.eq_ignore_ascii_case(literal)
}

/// `Number.prototype.toString(radix)` for a finite number and a radix from 2
/// to 36: V8's `DoubleToRadixCString`, with its f64 operations in the same
/// order, so the digits are the same (fraction digits up to the precision of
/// the input, rounded half to even on the last one).
pub fn number_to_radix_string(value: f64, radix: u32) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    debug_assert!((2..=36).contains(&radix) && value.is_finite());
    let radix_f = f64::from(radix);
    let negative = value < 0.0;
    let value = value.abs();
    let mut integer = value.floor();
    let mut fraction = value - integer;
    let mut delta = (0.5 * (next_double(value) - value)).max(next_double(0.0));
    let mut fraction_digits: Vec<u8> = Vec::new();
    let mut has_point = false;
    if fraction >= delta {
        has_point = true;
        loop {
            fraction *= radix_f;
            delta *= radix_f;
            // `fraction` is in [0, radix) here, so the cast keeps the digit.
            let digit = fraction as u32;
            fraction_digits.push(DIGITS[digit as usize]);
            fraction -= f64::from(digit);
            if (fraction > 0.5 || (fraction == 0.5 && digit & 1 == 1)) && fraction + delta > 1.0 {
                // Carry into the digits already written.
                loop {
                    match fraction_digits.pop() {
                        None => {
                            integer += 1.0;
                            has_point = false;
                            break;
                        }
                        Some(c) => {
                            let d = if c > b'9' {
                                u32::from(c - b'a') + 10
                            } else {
                                u32::from(c - b'0')
                            };
                            if d + 1 < radix {
                                fraction_digits.push(DIGITS[(d + 1) as usize]);
                                break;
                            }
                        }
                    }
                }
                break;
            }
            if fraction < delta {
                break;
            }
        }
    }
    let mut integer_digits: Vec<u8> = Vec::new();
    while double_exponent(integer / radix_f) > 0 {
        integer /= radix_f;
        integer_digits.push(b'0');
    }
    loop {
        let remainder = integer % radix_f;
        integer_digits.push(DIGITS[remainder as usize]);
        integer = (integer - remainder) / radix_f;
        if integer <= 0.0 {
            break;
        }
    }
    let mut text = String::with_capacity(integer_digits.len() + fraction_digits.len() + 2);
    if negative {
        text.push('-');
    }
    text.extend(integer_digits.iter().rev().map(|b| char::from(*b)));
    if has_point {
        text.push('.');
        text.extend(fraction_digits.iter().map(|b| char::from(*b)));
    }
    text
}

/// The next f64 above a finite, non-negative `value`.
fn next_double(value: f64) -> f64 {
    f64::from_bits(value.to_bits() + 1)
}

/// The exponent of `value` written as a 53-bit integer significand times a
/// power of two (V8 `Double::Exponent`).
fn double_exponent(value: f64) -> i32 {
    let biased = ((value.to_bits() >> 52) & 0x7ff) as i32;
    if biased == 0 {
        -1074
    } else {
        biased - 1075
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whitespace_set_is_the_ecmascript_one() {
        let ecmascript = [
            0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
            0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F,
            0x3000, 0xFEFF,
        ];
        for code in 0..=0x10FFFF_u32 {
            if let Some(c) = char::from_u32(code) {
                assert_eq!(is_whitespace(c), ecmascript.contains(&code), "U+{code:04X}");
            }
        }
    }

    #[test]
    fn trim_uses_the_ecmascript_set() {
        assert_eq!(trim("\u{FEFF} a b\u{3000}\n"), "a b");
        assert_eq!(trim("\u{0085}a\u{180E}"), "\u{0085}a\u{180E}");
        assert_eq!(trim("   "), "");
    }

    #[test]
    fn lower_case_is_the_full_mapping() {
        assert_eq!(to_lower_case("İ"), "i\u{0307}");
        assert_eq!(to_lower_case("ΟΔΟΣ"), "οδος");
        assert_eq!(to_lower_case("ΣΑ Σ"), "σα σ");
        assert_eq!(to_lower_case("ẞ.PDF"), "ß.pdf");
    }

    #[test]
    fn length_counts_utf16_units() {
        assert_eq!(utf16_len("a😀é"), 4);
        assert_eq!(utf16_len(""), 0);
    }

    #[test]
    fn pad_start_pads_to_the_length_in_utf16_units() {
        assert_eq!(pad_start("7", 3.0, '0'), Ok("007".into()));
        assert_eq!(pad_start("1234", 3.0, '0'), Ok("1234".into()));
        assert_eq!(pad_start("😀", 3.0, '0'), Ok("0😀".into()));
        assert_eq!(pad_start("7", f64::NAN, '0'), Ok("7".into()));
    }

    #[test]
    fn pad_start_refuses_strings_longer_than_v8_allows() {
        assert_eq!(
            pad_start("7", MAX_STRING_LENGTH_UTF16 as f64 + 1.0, '0'),
            Err(StringTooLong)
        );
        assert_eq!(pad_start("7", 1e20, '0'), Err(StringTooLong));
        assert_eq!(pad_start("7", f64::INFINITY, '0'), Err(StringTooLong));
    }

    #[test]
    fn substitute_expands_the_patterns_without_groups() {
        let subject = "ab{x}cd";
        let (start, end) = (2, 5);
        assert_eq!(substitute("[$&]", subject, start, end), "[{x}]");
        assert_eq!(substitute("$`", subject, start, end), "ab");
        assert_eq!(substitute("$'", subject, start, end), "cd");
        assert_eq!(substitute("$$", subject, start, end), "$");
        assert_eq!(substitute("$1$<a>$", subject, start, end), "$1$<a>$");
        assert_eq!(substitute("$$&", subject, start, end), "$&");
    }

    #[test]
    fn ascii_case_comparison() {
        assert!(eq_ignore_ascii_case_chars(
            "{OriginalNAME}",
            "{originalname}"
        ));
        assert!(!eq_ignore_ascii_case_chars("\u{212A}", "k"));
    }

    #[test]
    fn radix_text_matches_v8() {
        let tiny = format!("0.{}3", "0".repeat(207));
        // Expected values printed by Node.js 22 (`x.toString(36)`).
        let cases: &[(f64, &str)] = &[
            (0.0, "0"),
            (0.5, "0.i"),
            (0.25, "0.9"),
            (0.123, "0.4feornbt361"),
            (0.123456789, "0.4fzzzxjylrx"),
            (0.000001, "0.0001ogs5wo29m8"),
            (0.9999999999999999, "0.zzzzzzzzzza"),
            (1.0, "1"),
            (35.5, "z.i"),
            (36.0, "10"),
            (-0.75, "-0.r"),
            (9007199254740993.0, "2gosa7pa2gw"),
            (1e21, "5v1j4f4ds7c000"),
        ];
        for (value, expected) in cases {
            assert_eq!(number_to_radix_string(*value, 36), *expected, "{value}");
        }
        assert_eq!(number_to_radix_string(5e-324, 36), tiny);
        assert_eq!(
            number_to_radix_string(0.1, 2),
            "0.0001100110011001100110011001100110011001100110011001101"
        );
        assert_eq!(number_to_radix_string(255.0, 16), "ff");
    }
}
