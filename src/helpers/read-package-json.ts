import * as fs from 'fs/promises';

import { PackageJsonLike } from '../models/index.js';

const cache = new Map<string, PackageJsonLike>();

export async function readPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
    const cachedPackageJson = cache.get(packageJsonPath);
    if (cachedPackageJson) {
        return cachedPackageJson;
    }

    const content = await fs.readFile(packageJsonPath, { encoding: 'utf8' });

    const packageJson = JSON.parse(content) as PackageJsonLike;
    cache.set(packageJsonPath, packageJson);

    return packageJson;
}
