import * as path from 'path';

import { pathExists } from 'fs-extra';

import { isInFolder, isSamePaths } from './path-helpers';

export async function findUp(
    pathName: string | string[],
    startDirs: string | string[],
    endDir: string
): Promise<string | null> {
    const startDirsArray = Array.isArray(startDirs) ? startDirs : [startDirs];
    for (const startDir of startDirsArray) {
        let currentDir = startDir;
        const pathNames = Array.isArray(pathName) ? pathName : [pathName];
        const rootPath = path.parse(currentDir).root;

        do {
            for (const p of pathNames) {
                const tempPath = path.isAbsolute(p) ? p : path.resolve(currentDir, p);
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
    }

    return null;
}
