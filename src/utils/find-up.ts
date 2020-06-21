import * as path from 'path';

import { pathExists } from 'fs-extra';

import { isInFolder, isSamePaths } from './path-helpers';

export async function findUp(
    fileName: string | string[],
    currentDir: string,
    workingDir: string
): Promise<string | null> {
    let currentDirLocal = currentDir;
    const fileNames = Array.isArray(fileName) ? fileName : [fileName];
    const rootPath = path.parse(currentDirLocal).root;

    do {
        for (const f of fileNames) {
            const tempPath = path.isAbsolute(f) ? f : path.resolve(currentDirLocal, f);
            const isExsists = await pathExists(tempPath);
            if (isExsists) {
                return tempPath;
            }
        }

        if (currentDirLocal === rootPath) {
            break;
        }

        currentDirLocal = path.dirname(currentDirLocal);
    } while (currentDirLocal && (isSamePaths(workingDir, currentDirLocal) || isInFolder(workingDir, currentDirLocal)));

    return null;
}
