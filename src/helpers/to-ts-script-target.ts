/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { ScriptTarget } from 'typescript';

import { ScriptTargetString } from '../models';

const esDigitRegExp = /^es(2[0-9]{3})$/i;

export function toTsScriptTarget(target: ScriptTargetString): ScriptTarget | null {
    if (target === 'es5' || target === 'ES5') {
        return ScriptTarget.ES5;
    }

    if (target === 'esnext' || target === 'ESNext') {
        return ScriptTarget.ESNext;
    }

    if (target === 'latest' || target === 'Latest') {
        return ScriptTarget.Latest;
    }

    // TODO: To test
    const m = esDigitRegExp.exec(target);
    if (m != null && m[1] != null) {
        const digitPart = Number(m[1]);
        if (digitPart >= 2015) {
            return digitPart - 2013;
        }
    }

    return null;
}
