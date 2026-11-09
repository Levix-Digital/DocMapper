import { describe as group } from 'vitest'
import { MODULES } from '../oracle/modules'
import { parityModule } from '../writer/vitest-parity'

group('harness', () => {
    const parity = parityModule(MODULES, 'harness')
    parity.case('describe-integer', 'describe', [4, 'four'])
    parity.case('describe-fraction', 'describe', [0.3, 'tenths'])
    parity.case('describe-negative', 'describe', [-7.25, 'below'])
    parity.case('describe-large', 'describe', [1e21, 'exponent'])
    parity.case('measure-ascii', 'measure', ['cmr 42'])
    parity.case('measure-accented', 'measure', ['São Paulo'])
    parity.case('measure-empty', 'measure', [''])
})
