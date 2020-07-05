/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as ts from 'typescript';

export function formatTsDiagnostics(diagnostic: ts.Diagnostic | ts.Diagnostic[]): string {
    if (!diagnostic) {
        return '';
    }

    const diags = Array.isArray(diagnostic) ? diagnostic : [diagnostic];
    if (!diags || !diags.length || !diags[0].length) {
        return '';
    }

    return diags
        .map((d) => {
            let res = ts.DiagnosticCategory[d.category];
            if (d.file) {
                res += ` at ${d.file.fileName}:`;
                const { line, character } = d.file.getLineAndCharacterOfPosition(d.start as number);
                res += `${line + 1}:${character + 1}:`;
            }
            res += ` ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;

            return res;
        })
        .join('\n');
}
