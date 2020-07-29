import * as path from 'path';
import { pathExists } from 'fs-extra';

import { findNodeModulesPath } from './find-node-modules-path';

export async function isAngularProject(workspaceRoot: string): Promise<boolean> {
    const nodeModulesPath = await findNodeModulesPath(workspaceRoot);
    if (!nodeModulesPath) {
        return false;
    }

    if (
        (await pathExists(path.join(nodeModulesPath, '.bin/ngc'))) &&
        (await pathExists(path.join(nodeModulesPath, '@angular/compiler-cli/package.json')))
    ) {
        return true;
    }

    return false;
}
