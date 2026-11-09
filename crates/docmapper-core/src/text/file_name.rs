//! Output file names from a profile pattern: the twin of
//! `formatOutputFileName` (`frontend/src/services/mapping/filename-formatter.ts`).
//!
//! The steps run in the TypeScript order, each over the result of the one
//! before, so a token inside an original name or a value is expanded by the
//! later steps exactly as in TypeScript.

use super::ecmascript::{self, StringTooLong};
use super::property_map::PropertyMap;
use std::fmt;

/// Largest document index whose 1-based index is a safe JavaScript integer.
const MAX_DOC_INDEX: u64 = (1 << 53) - 2;
/// Default width of `{seq}` and of the index in the default name.
const DEFAULT_SEQ_WIDTH: f64 = 3.0;
/// Extension every output name ends with.
const PDF_EXTENSION: &str = ".pdf";
/// Characters file systems refuse, replaced by `_`.
const ILLEGAL_CHARACTERS: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
/// Members every JavaScript object inherits from `Object.prototype`; a field
/// token naming one of them finds that member instead of a value.
const INHERITED_MEMBERS: &[&str] = &[
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "__proto__",
    "toLocaleString",
];

/// What a file name is built from.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct FileNameOptions {
    /// Profile pattern; absent or blank means the default name.
    pub pattern: Option<String>,
    /// Name of the source PDF.
    pub original_file_name: String,
    /// Extracted values by field name or id.
    pub extracted_data: PropertyMap<String>,
    /// 0-based position of the document, at most 2^53 - 2.
    pub doc_index: u64,
    /// Number of documents of the run; not used in the name.
    pub total_docs: Option<u64>,
}

/// A UTC calendar date between 1970-01-01 and 9999-12-31.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CalendarDate {
    year: u16,
    month: u8,
    day: u8,
}

impl CalendarDate {
    /// The UTC date of a moment given in milliseconds since the Unix epoch,
    /// or `None` outside 1970-01-01 to 9999-12-31.
    pub fn from_unix_millis(millis: i64) -> Option<Self> {
        const MILLIS_PER_DAY: i64 = 86_400_000;
        if millis < 0 {
            return None;
        }
        let days = millis / MILLIS_PER_DAY;
        let (year, month, day) = civil_from_days(days);
        let year = u16::try_from(year).ok().filter(|y| *y <= 9999)?;
        Some(Self { year, month, day })
    }

    /// The date as `YYYY-MM-DD`, the date part of `Date.prototype.toISOString`.
    pub fn iso(&self) -> String {
        format!("{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

/// Year, month and day of a count of days since 1970-01-01 (proleptic
/// Gregorian calendar; H. Hinnant's `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, u8, u8) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    // month is 1..=12 and day 1..=31 by construction.
    (year, month as u8, day as u8)
}

/// Why no file name could be built (each stands for an error the
/// TypeScript code throws).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileNameError {
    /// A field token names an inherited object member (for example
    /// `{toString}`) that the extracted data does not hold.
    InheritedMemberToken { token: String },
    /// The name, or a step building it, is longer than the longest string
    /// JavaScript allows.
    StringTooLong,
    /// The document index is above 2^53 - 2, where JavaScript would round
    /// the 1-based index (callers pass list positions, far below it).
    IndexOutOfRange { doc_index: u64 },
}

impl fmt::Display for FileNameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InheritedMemberToken { token } => write!(
                f,
                "the file name token '{{{token}}}' names an inherited object member"
            ),
            Self::StringTooLong => {
                write!(f, "the file name is longer than the longest string allowed")
            }
            Self::IndexOutOfRange { doc_index } => {
                write!(f, "the document index {doc_index} is above 2^53 - 2")
            }
        }
    }
}

impl std::error::Error for FileNameError {}

impl From<StringTooLong> for FileNameError {
    fn from(_: StringTooLong) -> Self {
        Self::StringTooLong
    }
}

/// Builds the output file name of a document.
///
/// # Errors
/// [`FileNameError`] in the cases where the TypeScript code throws.
pub fn format_output_file_name(
    options: &FileNameOptions,
    today: CalendarDate,
) -> Result<String, FileNameError> {
    if options.doc_index > MAX_DOC_INDEX {
        return Err(FileNameError::IndexOutOfRange {
            doc_index: options.doc_index,
        });
    }
    let base_name = ecmascript::trim(&strip_extension(&options.original_file_name)).to_string();
    let index = options.doc_index + 1;
    let pattern = options
        .pattern
        .as_deref()
        .map(ecmascript::trim)
        .unwrap_or("");

    let raw = if pattern.is_empty() {
        default_name(&base_name, index)?
    } else {
        let raw = within_limit(replace_literal(pattern, "{originalName}", &base_name))?;
        let raw = within_limit(replace_seq(&raw, index)?)?;
        let raw = within_limit(replace_literal(&raw, "{index}", &index.to_string()))?;
        let raw = within_limit(replace_literal(&raw, "{date}", &today.iso()))?;
        within_limit(replace_field_tokens(&raw, &options.extracted_data)?)?
    };

    let mut sanitized = sanitize(&raw);
    if sanitized.is_empty() {
        sanitized = default_name(&base_name, index)?;
    }
    if ecmascript::to_lower_case(&sanitized).ends_with(PDF_EXTENSION) {
        Ok(sanitized)
    } else {
        Ok(within_limit(sanitized + PDF_EXTENSION)?)
    }
}

/// Fails as JavaScript does when a step builds a string longer than V8
/// allows (each step only grows the name, so checking its result is enough).
fn within_limit(text: String) -> Result<String, StringTooLong> {
    if ecmascript::utf16_len(&text) > ecmascript::MAX_STRING_LENGTH_UTF16 {
        Err(StringTooLong)
    } else {
        Ok(text)
    }
}

/// `name.replace(/\.[^/.]+$/, '')`: the match can only start at the last
/// dot, and only when something other than `/` follows it.
fn strip_extension(name: &str) -> String {
    match name.rfind('.') {
        Some(dot) if dot + 1 < name.len() && !name[dot + 1..].contains('/') => {
            name[..dot].to_string()
        }
        _ => name.to_string(),
    }
}

/// `<base>_<index padded to 3>`.
fn default_name(base_name: &str, index: u64) -> Result<String, StringTooLong> {
    let padded = ecmascript::pad_start(&index.to_string(), DEFAULT_SEQ_WIDTH, '0')?;
    Ok(format!("{base_name}_{padded}"))
}

/// `text.replace(/<literal>/gi, replacement)` for an ASCII literal, with the
/// replacement patterns of `String.prototype.replace`.
fn replace_literal(text: &str, literal: &str, replacement: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut copied_to = 0;
    let mut position = 0;
    while position < text.len() {
        let end = position + literal.len();
        let found = text
            .get(position..end)
            .is_some_and(|candidate| ecmascript::eq_ignore_ascii_case_chars(candidate, literal));
        if found {
            result.push_str(&text[copied_to..position]);
            result.push_str(&ecmascript::substitute(replacement, text, position, end));
            copied_to = end;
            position = end;
        } else {
            position += next_char_len(text, position);
        }
    }
    result.push_str(&text[copied_to..]);
    result
}

fn next_char_len(text: &str, position: usize) -> usize {
    text[position..].chars().next().map_or(1, char::len_utf8)
}

/// One `{seq}` or `{seq:N}` token (case-insensitive) at the start of `text`:
/// its byte length and its width digits, if any.
fn seq_token_at(text: &str) -> Option<(usize, Option<&str>)> {
    const OPEN: &str = "{seq";
    let head = text.get(..OPEN.len())?;
    if !head.eq_ignore_ascii_case(OPEN) {
        return None;
    }
    let rest = &text[OPEN.len()..];
    if rest.starts_with('}') {
        return Some((OPEN.len() + 1, None));
    }
    let digits_and_more = rest.strip_prefix(':')?;
    let digits_len = digits_and_more
        .bytes()
        .take_while(u8::is_ascii_digit)
        .count();
    if digits_len == 0 || !digits_and_more[digits_len..].starts_with('}') {
        return None;
    }
    Some((
        OPEN.len() + 1 + digits_len + 1,
        Some(&digits_and_more[..digits_len]),
    ))
}

/// Pad width of a `{seq:N}` token: the digit count when N starts with `0`,
/// otherwise N itself (`parseInt(width, 10) || 3`).
fn seq_width(width: Option<&str>) -> f64 {
    match width {
        None => DEFAULT_SEQ_WIDTH,
        Some(digits) if digits.starts_with('0') => digits.len() as f64,
        Some(digits) => match digits.parse::<f64>() {
            Ok(value) if value != 0.0 && !value.is_nan() => value,
            _ => DEFAULT_SEQ_WIDTH,
        },
    }
}

/// `text.replace(/\{seq(?::([0-9]+))?\}/gi, ...)`.
fn replace_seq(text: &str, index: u64) -> Result<String, StringTooLong> {
    let index_text = index.to_string();
    let mut result = String::with_capacity(text.len());
    let mut position = 0;
    let mut copied_to = 0;
    while position < text.len() {
        match seq_token_at(&text[position..]) {
            Some((length, width)) => {
                result.push_str(&text[copied_to..position]);
                result.push_str(&ecmascript::pad_start(&index_text, seq_width(width), '0')?);
                position += length;
                copied_to = position;
            }
            None => position += next_char_len(text, position),
        }
    }
    result.push_str(&text[copied_to..]);
    Ok(result)
}

/// `text.replace(/\{([^}]+)\}/g, ...)`: every `{...}` with at least one
/// character before the first `}` is a field token.
fn replace_field_tokens(
    text: &str,
    extracted: &PropertyMap<String>,
) -> Result<String, FileNameError> {
    let mut result = String::with_capacity(text.len());
    let mut position = 0;
    let mut copied_to = 0;
    while position < text.len() {
        let token_end = text[position..]
            .strip_prefix('{')
            .and_then(|after| after.find('}'))
            .filter(|length| *length > 0);
        match token_end {
            Some(length) => {
                let token = &text[position + 1..position + 1 + length];
                result.push_str(&text[copied_to..position]);
                result.push_str(&field_value(token, extracted)?);
                position += length + 2;
                copied_to = position;
            }
            None => position += next_char_len(text, position),
        }
    }
    result.push_str(&text[copied_to..]);
    Ok(result)
}

/// The value a field token stands for: the exact key, then the first key
/// equal ignoring case, then nothing.
fn field_value(token: &str, extracted: &PropertyMap<String>) -> Result<String, FileNameError> {
    let name = ecmascript::trim(token);
    match extracted.get(name) {
        Some(value) if !ecmascript::trim(value).is_empty() => {
            return Ok(ecmascript::trim(value).to_string())
        }
        Some(_) => {}
        None if INHERITED_MEMBERS.contains(&name) => {
            return Err(FileNameError::InheritedMemberToken {
                token: name.to_string(),
            })
        }
        None => {}
    }
    let lower_name = ecmascript::to_lower_case(name);
    let matched = extracted
        .iter()
        .find(|(key, _)| ecmascript::to_lower_case(key) == lower_name);
    Ok(match matched {
        Some((key, value)) if !key.is_empty() && !ecmascript::trim(value).is_empty() => {
            ecmascript::trim(value).to_string()
        }
        _ => String::new(),
    })
}

/// Illegal characters to `_`, white space runs to one space, then the
/// leading and trailing `_`, `.` and white space removed.
fn sanitize(raw: &str) -> String {
    let mut collapsed = String::with_capacity(raw.len());
    let mut in_space = false;
    for c in raw.chars() {
        if ecmascript::is_whitespace(c) {
            if !in_space {
                collapsed.push(' ');
            }
            in_space = true;
        } else {
            collapsed.push(if ILLEGAL_CHARACTERS.contains(&c) {
                '_'
            } else {
                c
            });
            in_space = false;
        }
    }
    let edge = |c: char| c == '_' || c == '.' || ecmascript::is_whitespace(c);
    collapsed.trim_matches(edge).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date() -> CalendarDate {
        CalendarDate::from_unix_millis(1_762_700_000_000).unwrap_or(CalendarDate {
            year: 1970,
            month: 1,
            day: 1,
        })
    }

    fn name(
        pattern: Option<&str>,
        original: &str,
        data: &[(&str, &str)],
    ) -> Result<String, FileNameError> {
        let options = FileNameOptions {
            pattern: pattern.map(str::to_string),
            original_file_name: original.into(),
            extracted_data: data
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            doc_index: 4,
            total_docs: None,
        };
        format_output_file_name(&options, date())
    }

    #[test]
    fn calendar_dates() {
        let iso = |ms| CalendarDate::from_unix_millis(ms).map(|d| d.iso());
        assert_eq!(iso(0), Some("1970-01-01".into()));
        assert_eq!(iso(951_782_400_000), Some("2000-02-29".into()));
        assert_eq!(iso(1_762_700_000_000), Some("2025-11-09".into()));
        assert_eq!(iso(253_402_300_799_999), Some("9999-12-31".into()));
        assert_eq!(iso(253_402_300_800_000), None);
        assert_eq!(iso(-1), None);
    }

    #[test]
    fn default_name_when_the_pattern_is_blank() {
        assert_eq!(name(None, "cmr.pdf", &[]), Ok("cmr_005.pdf".into()));
        assert_eq!(name(Some("  "), "cmr", &[]), Ok("cmr_005.pdf".into()));
    }

    #[test]
    fn tokens() {
        let data = [("Invoice", " 42 "), ("blank", " ")];
        assert_eq!(
            name(
                Some(
                    "{ORIGINALNAME}-{seq}-{Seq:05}-{seq:2}-{index}-{date}-{ invoice }-{blank}-{x}"
                ),
                "a.b.pdf",
                &data
            ),
            Ok("a.b-005-05-05-5-2025-11-09-42--.pdf".into())
        );
    }

    #[test]
    fn original_name_uses_replacement_patterns() {
        assert_eq!(
            name(Some("{originalName}"), "a$&b.pdf", &[]),
            Ok("ab.pdf".into())
        );
        assert_eq!(
            name(Some("x{originalName}"), "$`.pdf", &[]),
            Ok("xx.pdf".into())
        );
    }

    #[test]
    fn inherited_members_throw() {
        assert_eq!(
            name(Some("{ toString }"), "a", &[]),
            Err(FileNameError::InheritedMemberToken {
                token: "toString".into()
            })
        );
        assert_eq!(
            name(Some("{toString}"), "a", &[("toString", "v")]),
            Ok("v.pdf".into())
        );
    }

    #[test]
    fn huge_seq_width_throws() {
        assert_eq!(
            name(Some("{seq:99999999999}"), "a", &[]),
            Err(FileNameError::StringTooLong)
        );
    }

    #[test]
    fn the_whole_name_is_bounded_by_the_maximum_string_length() {
        assert_eq!(
            name(Some("{seq:536870888}"), "a", &[]),
            Err(FileNameError::StringTooLong)
        );
        assert_eq!(within_limit("a".repeat(10)), Ok("a".repeat(10)));
    }

    #[test]
    fn index_above_the_safe_range_is_refused() {
        let options = FileNameOptions {
            doc_index: u64::MAX,
            ..FileNameOptions::default()
        };
        assert_eq!(
            format_output_file_name(&options, date()),
            Err(FileNameError::IndexOutOfRange {
                doc_index: u64::MAX
            })
        );
    }

    #[test]
    fn sanitizing() {
        assert_eq!(
            name(Some(" _.a:b\t\n c?._ "), "x", &[]),
            Ok("a_b c.pdf".into())
        );
        assert_eq!(name(Some("..__"), "x", &[]), Ok("x_005.pdf".into()));
        assert_eq!(name(Some("A.PDF"), "x", &[]), Ok("A.PDF".into()));
    }

    #[test]
    fn extension_stripping() {
        assert_eq!(strip_extension("a.b/c"), "a.b/c");
        assert_eq!(strip_extension("a."), "a.");
        assert_eq!(strip_extension("a.tar.gz"), "a.tar");
        assert_eq!(strip_extension(".env"), "");
    }

    #[test]
    fn field_tokens_take_the_text_up_to_the_first_brace() {
        assert_eq!(
            name(Some("{a{b}c{}"), "x", &[("a{b", "v")]),
            Ok("vc{}.pdf".into())
        );
    }
}
