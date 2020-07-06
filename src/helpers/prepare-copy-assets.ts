/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { BuildActionInternal } from '../models/internals';
import { findUp } from '../utils';

export async function prepareCopyAssets(buildAction: BuildActionInternal): Promise<void> {
    if (buildAction.copy && Array.isArray(buildAction.copy)) {
        buildAction._copyAssets = buildAction.copy;
    } else if (buildAction.copy !== false) {
        const filesToCopy: string[] = [];
        const foundReadMeFile = await findUp(
            ['README.md', 'README'],
            buildAction._projectRoot,
            buildAction._workspaceRoot
        );
        if (foundReadMeFile) {
            filesToCopy.push(path.relative(buildAction._projectRoot, foundReadMeFile));
        }
        const foundLicenseFile = await findUp(
            ['LICENSE', 'LICENSE.txt'],
            buildAction._projectRoot,
            buildAction._workspaceRoot
        );
        if (foundLicenseFile) {
            filesToCopy.push(path.relative(buildAction._projectRoot, foundLicenseFile));
        }

        buildAction._copyAssets = filesToCopy;
    }
}
