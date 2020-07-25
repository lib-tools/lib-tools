import { ScriptTarget } from 'typescript';

import { ScriptTargetString } from '../models';

const esDigitRegExp = /^es(2[0-9]{3})$/i;

export function toTsScriptTarget(target: ScriptTargetString): ScriptTarget {
    if (target === 'es5' || target === 'ES5') {
        return ScriptTarget.ES5;
    }

    if (target === 'esnext' || target === 'ESNext') {
        return ScriptTarget.ESNext;
    }

    if (target === 'latest' || target === 'Latest') {
        return ScriptTarget.Latest;
    }

    const m = esDigitRegExp.exec(target);
    if (m != null && m[1] != null) {
        const digitPart = Number(m[1]);
        if (digitPart >= 2015) {
            return digitPart - 2013;
        }
    }

    return ScriptTarget.ESNext;
}
