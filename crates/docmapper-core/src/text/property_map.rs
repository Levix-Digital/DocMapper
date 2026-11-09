//! An ordered map that lists its keys in ECMAScript property order, as
//! `Object.keys` and `JSON.stringify` do for a plain object.

/// The largest array index plus one: indexes go from 0 to 2^32 - 2.
const ARRAY_INDEX_LIMIT: u64 = u32::MAX as u64;

/// The one key whose assignment on a plain object goes to its prototype.
const PROTO_KEY: &str = "__proto__";

/// Whether `key` is a canonical array index ("0", "7", "4294967294"), the
/// keys JavaScript lists first, in ascending numeric order.
pub fn array_index(key: &str) -> Option<u64> {
    let canonical = key == "0" || (!key.starts_with('0') && !key.is_empty());
    if !canonical || !key.bytes().all(|b| b.is_ascii_digit()) || key.len() > 10 {
        return None;
    }
    key.parse::<u64>()
        .ok()
        .filter(|index| *index < ARRAY_INDEX_LIMIT)
}

/// Keys and values of a plain JavaScript object, in property order:
/// array indexes first in ascending order, then the other keys in the order
/// they were first set. Setting a key again keeps its place.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PropertyMap<V> {
    entries: Vec<(String, V)>,
}

impl<V> Default for PropertyMap<V> {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
        }
    }
}

impl<V> PropertyMap<V> {
    /// An empty map.
    pub fn new() -> Self {
        Self::default()
    }

    /// The value of an own key.
    pub fn get(&self, key: &str) -> Option<&V> {
        self.entries.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }

    /// Defines or overwrites an own key (`CreateDataProperty`).
    pub fn insert(&mut self, key: String, value: V) {
        match self.entries.iter_mut().find(|(k, _)| *k == key) {
            Some(entry) => entry.1 = value,
            None => self.entries.push((key, value)),
        }
    }

    /// An ordinary assignment `object[key] = value` of a value that is not an
    /// object: on a plain object, `__proto__` is then ignored.
    pub fn assign_primitive(&mut self, key: String, value: V) {
        if key != PROTO_KEY {
            self.insert(key, value);
        }
    }

    /// Number of own keys.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the map has no keys.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Keys and values in ECMAScript property order.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &V)> {
        let mut indexes: Vec<(u64, &(String, V))> = self
            .entries
            .iter()
            .filter_map(|entry| array_index(&entry.0).map(|index| (index, entry)))
            .collect();
        indexes.sort_by_key(|(index, _)| *index);
        let others = self
            .entries
            .iter()
            .filter(|entry| array_index(&entry.0).is_none());
        indexes
            .into_iter()
            .map(|(_, entry)| entry)
            .chain(others)
            .map(|(k, v)| (k.as_str(), v))
    }

    /// Keys in ECMAScript property order (`Object.keys`).
    pub fn keys(&self) -> impl Iterator<Item = &str> {
        self.iter().map(|(k, _)| k)
    }
}

impl<V> FromIterator<(String, V)> for PropertyMap<V> {
    /// Builds the map as `JSON.parse` builds an object: a repeated key keeps
    /// its first place and its last value.
    fn from_iter<I: IntoIterator<Item = (String, V)>>(entries: I) -> Self {
        let mut map = Self::new();
        for (key, value) in entries {
            map.insert(key, value);
        }
        map
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys<V>(map: &PropertyMap<V>) -> Vec<&str> {
        map.keys().collect()
    }

    #[test]
    fn array_indexes_are_canonical_and_below_the_limit() {
        assert_eq!(array_index("0"), Some(0));
        assert_eq!(array_index("4294967294"), Some(4_294_967_294));
        assert_eq!(array_index("4294967295"), None);
        assert_eq!(array_index("02"), None);
        assert_eq!(array_index(""), None);
        assert_eq!(array_index("-1"), None);
        assert_eq!(array_index("1.5"), None);
        assert_eq!(array_index("99999999999"), None);
        assert_eq!(array_index("٣"), None);
    }

    #[test]
    fn indexes_come_first_in_numeric_order_then_insertion_order() {
        let map: PropertyMap<u8> = [("b", 1), ("10", 2), ("a", 3), ("2", 4), ("02", 5)]
            .into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect();
        assert_eq!(keys(&map), ["2", "10", "b", "a", "02"]);
    }

    #[test]
    fn overwriting_keeps_the_first_place() {
        let mut map = PropertyMap::new();
        map.insert("a".into(), 1);
        map.insert("b".into(), 2);
        map.insert("a".into(), 3);
        assert_eq!(keys(&map), ["a", "b"]);
        assert_eq!(map.get("a"), Some(&3));
        assert_eq!(map.len(), 2);
        assert!(!map.is_empty());
    }

    #[test]
    fn assigning_a_primitive_to_proto_is_ignored() {
        let mut map = PropertyMap::new();
        map.assign_primitive("__proto__".into(), 1);
        map.assign_primitive("x".into(), 2);
        assert_eq!(keys(&map), ["x"]);
        map.insert("__proto__".into(), 3);
        assert_eq!(map.get("__proto__"), Some(&3));
    }
}
