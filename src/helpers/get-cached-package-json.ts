import { PackageJsonLike } from '../models';

import { readJson } from 'fs-extra';

const cache = new Map<string, PackageJsonLike>();

export async function getCachedPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
    const cachedPackageJson = cache.get(packageJsonPath);
    if (cachedPackageJson) {
        return cachedPackageJson;
    }

    const packageJson = (await readJson(packageJsonPath)) as PackageJsonLike;
    cache.set(packageJsonPath, packageJson);

    return packageJson;
}
