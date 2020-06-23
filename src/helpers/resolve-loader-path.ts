import * as path from 'path';

import { pathExists } from 'fs-extra';

export async function resolveLoaderPath(loaderName: string): Promise<string> {
    let resolvedPath = loaderName;
    let resolved = false;

    const nodeModulesPath = await AngularBuildContext.getNodeModulesPath();
    if (nodeModulesPath) {
        if (await pathExists(path.resolve(nodeModulesPath, loaderName))) {
            resolvedPath = path.resolve(nodeModulesPath, loaderName);
            resolved = true;
        }
    }

    if (!resolved && AngularBuildContext.fromBuiltInCli) {
        if (AngularBuildContext.cliRootPath) {
            const tempPath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules', loaderName);
            if (await pathExists(tempPath)) {
                resolvedPath = tempPath;
                resolved = true;
            }
        }

        if (!resolved && nodeModulesPath) {
            const tempPath = path.resolve(nodeModulesPath, '@dagonmetric/angular-build/node_modules', loaderName);
            if (await pathExists(tempPath)) {
                resolvedPath = tempPath;
                resolved = true;
            }
        }

        if (!resolved) {
            const tempPath = require.resolve(loaderName);
            if (await pathExists(tempPath)) {
                resolvedPath = tempPath;
            }
        }
    }

    return resolvedPath;
}
