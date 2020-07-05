/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { PackageJsonLike } from '../models/internals';

import { readJson } from 'fs-extra';

const cache = new Map<string, PackageJsonLike>();

export async function readPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
    const cachedPackageJson = cache.get(packageJsonPath);
    if (cachedPackageJson) {
        return cachedPackageJson;
    }

    const packageJson = (await readJson(packageJsonPath)) as PackageJsonLike;
    cache.set(packageJsonPath, packageJson);

    return packageJson;
}
