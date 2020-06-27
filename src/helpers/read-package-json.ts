import { PackageJsonLike } from '../models/internals';
import { readJson } from '../utils';

const packageJsonMap = new Map<string, PackageJsonLike>();

export async function readPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
    const cachedPackageJson = packageJsonMap.get(packageJsonPath);
    if (cachedPackageJson) {
        return cachedPackageJson;
    }

    const packageJson = (await readJson(packageJsonPath)) as PackageJsonLike;
    packageJsonMap.set(packageJsonPath, packageJson);

    return packageJson;
}
