import * as fs from 'fs-extra';

import { PackageJsonLike } from '../models/index.js';

const cache = new Map<string, PackageJsonLike>();

export async function readPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
    const cachedPackageJson = cache.get(packageJsonPath);
    if (cachedPackageJson) {
        return cachedPackageJson;
    }

    const packageJson = (await fs.readJSON(packageJsonPath)) as PackageJsonLike;
    cache.set(packageJsonPath, packageJson);

    return packageJson;
}
