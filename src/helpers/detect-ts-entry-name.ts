import * as path from 'path';

import { pathExists } from 'fs-extra';

import { TsConfigInfo } from '../models/internals';

export async function detectTsEntryName(
    tsConfigInfo: TsConfigInfo,
    packageNameWithoutScope: string
): Promise<string | null> {
    const tsConfigJson = tsConfigInfo.tsConfigJson;
    const tsCompilerConfig = tsConfigInfo.tsCompilerConfig;
    const tsConfigPath = tsConfigInfo.tsConfigPath;

    const flatModuleOutFile =
        tsConfigJson.angularCompilerOptions && tsConfigJson.angularCompilerOptions.flatModuleOutFile
            ? tsConfigJson.angularCompilerOptions.flatModuleOutFile
            : null;
    if (flatModuleOutFile) {
        return flatModuleOutFile.replace(/\.js$/i, '');
    }

    if (tsCompilerConfig.fileNames.length > 0) {
        return path.basename(tsCompilerConfig.fileNames[0]).replace(/\.ts$/i, '');
    }

    const tsSrcRootDir = path.dirname(tsConfigPath);

    if (await pathExists(path.resolve(tsSrcRootDir, 'index.ts'))) {
        return 'index';
    }

    const packageName =
        packageNameWithoutScope.lastIndexOf('/') > -1
            ? packageNameWithoutScope.substr(packageNameWithoutScope.lastIndexOf('/') + 1)
            : packageNameWithoutScope;
    if (await pathExists(path.resolve(tsSrcRootDir, packageName + '.ts'))) {
        return packageName;
    }

    if (await pathExists(path.resolve(tsSrcRootDir, 'main.ts'))) {
        return 'main';
    }

    if (await pathExists(path.resolve(tsSrcRootDir, 'public_api.ts'))) {
        return 'public_api';
    }

    if (await pathExists(path.resolve(tsSrcRootDir, 'public-api.ts'))) {
        return 'public-api';
    }

    return null;
}
