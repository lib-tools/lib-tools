import * as path from 'path';

import { pathExists } from 'fs-extra';

import { isInFolder, isSamePaths } from './path-helpers';

export async function findUp(fileName: string | string[], startDir: string, endDir: string): Promise<string | null> {
    let currentDir = startDir;
    const fileNames = Array.isArray(fileName) ? fileName : [fileName];
    const rootPath = path.parse(currentDir).root;

    do {
        for (const f of fileNames) {
            const tempPath = path.isAbsolute(f) ? f : path.resolve(currentDir, f);
            if (await pathExists(tempPath)) {
                return tempPath;
            }
        }

        currentDir = path.dirname(currentDir);
    } while (
        currentDir &&
        currentDir !== rootPath &&
        (isSamePaths(endDir, currentDir) || isInFolder(endDir, currentDir))
    );

    return null;
}
