/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { pathExists } from 'fs-extra';

import { findUp } from '../utils';

const packageJsonPathMap = new Map<string, string>();

export async function findPackageJsonPath(workspaceRoot: string, projectRoot?: string): Promise<string | null> {
    if (projectRoot) {
        const cachedPath = packageJsonPathMap.get(projectRoot);
        if (cachedPath) {
            return cachedPath;
        }

        const foundPackageJsonPath = await findUp('package.json', projectRoot, workspaceRoot);
        if (foundPackageJsonPath) {
            packageJsonPathMap.set(projectRoot, foundPackageJsonPath);
        }

        return foundPackageJsonPath;
    } else {
        const cachedPath = packageJsonPathMap.get(workspaceRoot);
        if (cachedPath) {
            return cachedPath;
        }

        const rootPackageJsonPath = path.resolve(workspaceRoot, 'package.json');
        if (await pathExists(rootPackageJsonPath)) {
            packageJsonPathMap.set(workspaceRoot, rootPackageJsonPath);
        }

        return rootPackageJsonPath;
    }
}
