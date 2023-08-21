import * as path from 'path';
import { pathExists } from 'fs-extra';

import { PackageJsonLike } from '../models';

import { findNodeModulesPath } from './find-node-modules-path';

export async function isAngularProject(workspaceRoot: string, packageJson: PackageJsonLike | null): Promise<boolean> {
    const nodeModulesPath = await findNodeModulesPath(workspaceRoot);
    if (!nodeModulesPath || !packageJson) {
        return false;
    }

    if (
        ((packageJson.peerDependencies && packageJson.peerDependencies['@angular/core']) ||
            (packageJson.dependencies && packageJson.dependencies['@angular/core'])) &&
        (await pathExists(path.join(nodeModulesPath, '.bin/ngc'))) &&
        (await pathExists(path.join(nodeModulesPath, '@angular/compiler-cli/package.json')))
    ) {
        return true;
    }

    return false;
}
