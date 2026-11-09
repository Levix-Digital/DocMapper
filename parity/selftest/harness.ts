// Self-test module of the parity harness: two small pure functions that
// exercise ordered keys, floating point results and thrown errors. Their Rust
// twins live in crates/docmapper-parity/tests.

export function describe(value: number, label: string) {
    return {
        label,
        half: value / 2,
        shifted: value + 0.1,
        sign: value < 0 ? 'negative' : 'non-negative',
    }
}

export function measure(text: string) {
    if (text.length === 0) throw new RangeError('text is empty')
    return { length: text.length, upper: text.toUpperCase() }
}
