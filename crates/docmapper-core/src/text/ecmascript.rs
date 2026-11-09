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
    let mut padded = String::with_capacity(missing + text.len());
    padded.extend(std::iter::repeat_n(fill, missing));
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
}
