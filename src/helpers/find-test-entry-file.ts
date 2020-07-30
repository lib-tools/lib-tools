import * as path from 'path';

import { pathExists } from 'fs-extra';

import { findUp } from '../utils';

import { getCachedTsconfigJson } from './get-cached-tsconfig-json';

export async function findTestEntryFile(
    projectRoot: string,
    workspaceRoot: string,
    tsConfigPath?: string | null
): Promise<string | null> {
    let entryFilePath: string | null = null;

    if (tsConfigPath) {
        const tsConfigJson = getCachedTsconfigJson(tsConfigPath);
        if (tsConfigJson.files && tsConfigJson.files.length) {
            let testFile = tsConfigJson.files.find((f) => /test([-_]index)?\.tsx?$/i.test(f));
            if (!testFile) {
                testFile = tsConfigJson.files[0];
            }

            if (testFile) {
                const testFileAbs = path.resolve(path.dirname(tsConfigPath), testFile);
                if (await pathExists(testFileAbs)) {
                    entryFilePath = testFileAbs;
                }
            }
        }
    }

    if (!entryFilePath) {
        entryFilePath = await findUp(
            ['test.ts', 'test_index.ts', 'test.js', 'test_index.js'],
            [path.resolve(projectRoot, 'test'), path.resolve(projectRoot, 'src')],
            workspaceRoot
        );
    }

    return entryFilePath;
}
