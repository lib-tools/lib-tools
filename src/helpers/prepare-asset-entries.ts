import * as path from 'path';

import { BuildActionInternal } from '../models/internals';
import { findUp } from '../utils';

export async function prepareAssetEntries(buildAction: BuildActionInternal): Promise<void> {
    if (buildAction.copy) {
        buildAction._assetEntries = buildAction.copy.map((assetEntry) =>
            typeof assetEntry === 'string' ? { from: assetEntry } : { ...assetEntry }
        );
    } else {
        const filesToCopy: string[] = [];
        const foundReadMeFile = await findUp(
            ['README.md', 'README'],
            buildAction._projectRoot,
            buildAction._workspaceRoot
        );
        if (foundReadMeFile) {
            filesToCopy.push(path.relative(buildAction._projectRoot, foundReadMeFile));
        }
        const foundLicenseFile = await findUp(
            ['LICENSE', 'LICENSE.txt', 'LICENCE'],
            buildAction._projectRoot,
            buildAction._workspaceRoot
        );
        if (foundLicenseFile) {
            filesToCopy.push(path.relative(buildAction._projectRoot, foundLicenseFile));
        }

        const foundChangeLogFile = await findUp(
            ['CHANGELOG.md', 'CHANGELOG', 'CHANGES.md', 'CHANGES', 'HISTORY.md', 'HISTORY'],
            buildAction._projectRoot,
            buildAction._workspaceRoot
        );
        if (foundChangeLogFile) {
            filesToCopy.push(path.relative(buildAction._projectRoot, foundChangeLogFile));
        }

        const foundNoticeFile = await findUp(
            ['NOTICE.md', 'NOTICE'],
            buildAction._projectRoot,
            buildAction._workspaceRoot
        );
        if (foundNoticeFile) {
            filesToCopy.push(path.relative(buildAction._projectRoot, foundNoticeFile));
        }

        buildAction._assetEntries = filesToCopy.map((assetEntry) => {
            return {
                from: assetEntry
            };
        });
    }
}
