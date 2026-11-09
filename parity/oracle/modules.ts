// The module table: every module under migration and the functions the
// characterization tests and the oracle may call. A reference copy of the
// module's TypeScript is added under parity/ when its characterization starts.

import type { ModuleTable } from '../shared/outcome'
import * as harness from '../selftest/harness'
import * as profiles from '../profiles/harness'
import { formatOutputFileNameAt } from '../text/fixed-clock'
import { flattenDictionary, sanitizePunctuation } from '../text/translation-text'
import { testRegexPattern } from '../text/validation-pattern'

export const MODULES: ModuleTable = {
    harness: {
        describe: harness.describe,
        measure: harness.measure,
    },
    text: {
        formatOutputFileName: formatOutputFileNameAt,
        testRegexPattern,
        flattenDictionary,
        sanitizePunctuation,
    },
    profiles: {
        createEmptyProfile: profiles.createEmptyProfile,
        getAllProfiles: profiles.getAllProfiles,
        getProfileById: profiles.getProfileById,
        saveProfile: profiles.saveProfile,
        deleteProfile: profiles.deleteProfile,
        duplicateProfile: profiles.duplicateProfile,
        exportProfileAsDocMapper: profiles.exportProfileAsDocMapper,
        importProfileFromDocMapper: profiles.importProfileFromDocMapper,
    },
}
