import * as path from 'path';
import { findUp } from '../utils';

const cache: { nodeModulesPath: string | null } = {
    nodeModulesPath: null
};

export async function findNodeModulesPath(workspaceRoot: string): Promise<string | null> {
    if (cache.nodeModulesPath != null) {
        return cache.nodeModulesPath ? cache.nodeModulesPath : null;
    }

    const foundNodeModulesPath = await findUp('node_modules', workspaceRoot, path.parse(workspaceRoot).root);

    if (foundNodeModulesPath) {
        cache.nodeModulesPath = foundNodeModulesPath;
    } else {
        cache.nodeModulesPath = '';
    }

    return foundNodeModulesPath;
}
