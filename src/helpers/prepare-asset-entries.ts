import * as path from 'path';

import { BuildConfigInternal } from '../models/index.js';
import { findUp } from '../utils/index.js';

export async function prepareAssetEntries(buildConfig: BuildConfigInternal): Promise<void> {
    if (buildConfig.copy) {
        buildConfig._assetEntries = buildConfig.copy.map((assetEntry) =>
            typeof assetEntry === 'string' ? { from: assetEntry } : { ...assetEntry }
        );
    } else {
        const filesToCopy: string[] = [];
        const foundReadMeFile = await findUp(
            ['README.md', 'README'],
            buildConfig._projectRoot,
            buildConfig._workspaceRoot
        );
        if (foundReadMeFile) {
            filesToCopy.push(path.relative(buildConfig._projectRoot, foundReadMeFile));
        }
        const foundLicenseFile = await findUp(
            ['LICENSE', 'LICENSE.txt', 'LICENCE'],
            buildConfig._projectRoot,
            buildConfig._workspaceRoot
        );
        if (foundLicenseFile) {
            filesToCopy.push(path.relative(buildConfig._projectRoot, foundLicenseFile));
        }

        const foundChangeLogFile = await findUp(
            ['CHANGELOG.md', 'CHANGELOG', 'CHANGES.md', 'CHANGES', 'HISTORY.md', 'HISTORY'],
            buildConfig._projectRoot,
            buildConfig._workspaceRoot
        );
        if (foundChangeLogFile) {
            filesToCopy.push(path.relative(buildConfig._projectRoot, foundChangeLogFile));
        }

        const foundNoticeFile = await findUp(
            ['NOTICE.md', 'NOTICE'],
            buildConfig._projectRoot,
            buildConfig._workspaceRoot
        );
        if (foundNoticeFile) {
            filesToCopy.push(path.relative(buildConfig._projectRoot, foundNoticeFile));
        }

        buildConfig._assetEntries = filesToCopy.map((assetEntry) => {
            return {
                from: assetEntry
            };
        });
    }
}
