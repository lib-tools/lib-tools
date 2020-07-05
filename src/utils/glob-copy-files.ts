/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import { promisify } from 'util';

import { copy, move } from 'fs-extra';
import * as glob from 'glob';

const globAsync = promisify(glob);

export async function globCopyFiles(
    fromPath: string,
    pattern: string,
    toPath: string,
    forMove?: boolean
): Promise<void> {
    const files = await globAsync(pattern, { cwd: fromPath });
    for (const relFileName of files) {
        const sourceFilePath = path.join(fromPath, relFileName);
        const destFilePath = path.join(toPath, relFileName);

        if (forMove) {
            await move(sourceFilePath, destFilePath);
        } else {
            await copy(sourceFilePath, destFilePath);
        }
    }
}
