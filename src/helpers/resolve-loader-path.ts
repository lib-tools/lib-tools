import * as path from 'path';

import { pathExists } from 'fs-extra';

export async function resolveLoaderPath(
    loaderName: string,
    nodeModulesPath?: string,
    fromBuiltInCli?: boolean,
    cliRootPath?: string
): Promise<string> {
    let resolvedPath = loaderName;
    let resolved = false;

    if (nodeModulesPath) {
        if (await pathExists(path.resolve(nodeModulesPath, loaderName))) {
            resolvedPath = path.resolve(nodeModulesPath, loaderName);
            resolved = true;
        }
    }

    if (!fromBuiltInCli) {
        if (cliRootPath) {
            const tempPath = path.resolve(cliRootPath, 'node_modules', loaderName);
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
