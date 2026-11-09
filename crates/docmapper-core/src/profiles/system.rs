//! The clock and random source of the running application.

use super::ports::{Clock, RandomSource};
use std::hash::{BuildHasher, Hasher, RandomState};
use std::time::{SystemTime, UNIX_EPOCH};

/// The system clock, in whole milliseconds as `Date.now()` gives them.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_millis(&self) -> f64 {
        match SystemTime::now().duration_since(UNIX_EPOCH) {
            // Milliseconds since 1970 stay far below 2^53.
            Ok(elapsed) => elapsed.as_millis() as f64,
            Err(before) => -(before.duration().as_millis() as f64),
        }
    }
}

/// Random numbers in `[0, 1)` from the standard library's randomly seeded
/// hasher (ids only need to differ, not to be secret).
#[derive(Debug, Clone, Default)]
pub struct StdRandom {
    state: RandomState,
    counter: u64,
}

impl RandomSource for StdRandom {
    fn next_f64(&mut self) -> f64 {
        self.counter = self.counter.wrapping_add(1);
        let mut hasher = self.state.build_hasher();
        hasher.write_u64(self.counter);
        // The top 53 bits as a fraction of 2^53: exactly representable, below 1.
        (hasher.finish() >> 11) as f64 / (1u64 << 53) as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clock_reads_a_time_after_2025() {
        assert!(SystemClock.now_millis() > 1_735_689_600_000.0);
    }

    #[test]
    fn random_numbers_are_in_the_unit_interval_and_vary() {
        let mut random = StdRandom::default();
        let values: Vec<f64> = (0..100).map(|_| random.next_f64()).collect();
        assert!(values.iter().all(|v| (0.0..1.0).contains(v)));
        assert!(values.windows(2).any(|w| w[0] != w[1]));
    }
}
