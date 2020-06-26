import * as path from 'path';

import { findUp } from '../utils';

export class CacheManager {
    private static _nodeModulesPath: string | null = null;

    static async getNodeModulesPath(workspaceRoot: string): Promise<string | null> {
        if (CacheManager._nodeModulesPath != null) {
            return CacheManager._nodeModulesPath;
        }

        const foundNodeModulesPath = await findUp('node_modules', workspaceRoot, path.parse(workspaceRoot).root);

        if (foundNodeModulesPath) {
            CacheManager._nodeModulesPath = foundNodeModulesPath;
        } else {
            CacheManager._nodeModulesPath = '';
        }

        return CacheManager._nodeModulesPath;
    }
}
