// The module table: every module under migration and the functions the
// characterization tests and the oracle may call. A reference copy of the
// module's TypeScript is added under parity/ when its characterization starts.

import type { ModuleTable } from '../shared/outcome'
import * as harness from '../selftest/harness'

export const MODULES: ModuleTable = {
    harness: {
        describe: harness.describe,
        measure: harness.measure,
    },
}
