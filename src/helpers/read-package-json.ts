import { PackageJsonLike } from '../models/internals';

import { readJSON } from 'fs-extra';

const packageJsonMap = new Map<string, PackageJsonLike>();

export async function readPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
    const cachedPackageJson = packageJsonMap.get(packageJsonPath);
    if (cachedPackageJson) {
        return cachedPackageJson;
    }

    const packageJson = (await readJSON(packageJsonPath)) as PackageJsonLike;
    packageJsonMap.set(packageJsonPath, packageJson);

    return packageJson;
}
