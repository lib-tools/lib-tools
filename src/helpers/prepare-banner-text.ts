import * as path from 'path';

import { readFile } from 'fs-extra';

import { BuildActionInternal } from '../models/internals';
import { findUp } from '../utils';

export async function prepareBannerText(buildAction: BuildActionInternal): Promise<void> {
    if (!buildAction.banner) {
        return;
    }

    let bannerText = buildAction.banner;

    if (/\.txt$/i.test(bannerText)) {
        const bannerFilePath = await findUp(bannerText, buildAction._projectRoot, buildAction._workspaceRoot);
        if (bannerFilePath) {
            bannerText = await readFile(bannerFilePath, 'utf-8');
        } else {
            throw new Error(
                `The banner text file: ${path.resolve(
                    buildAction._projectRoot,
                    bannerText
                )} doesn't exist. Correct value in 'projects[${buildAction._projectName}].scriptBundle.banner'.`
            );
        }
    }

    if (!bannerText) {
        return;
    }

    bannerText = addCommentToBanner(bannerText);
    bannerText = bannerText.replace(/[$|[]CURRENT[_-]?YEAR[$|\]]/gim, new Date().getFullYear().toString());
    bannerText = bannerText.replace(/[$|[](PROJECT|PACKAGE)[_-]?NAME[$|\]]/gim, buildAction._packageName);
    bannerText = bannerText.replace(/[$|[](PROJECT|PACKAGE)?[_-]?VERSION[$|\]]/gim, buildAction._packageVersion);
    bannerText = bannerText.replace(/0\.0\.0-PLACEHOLDER/i, buildAction._packageVersion);

    buildAction._bannerText = bannerText;
}

function addCommentToBanner(banner: string): string {
    if (banner.trim().startsWith('/')) {
        return banner;
    }

    const commentLines: string[] = [];
    const bannerLines = banner.split('\n');
    for (let i = 0; i < bannerLines.length; i++) {
        if (bannerLines[i] === '' || bannerLines[i] === '\r') {
            continue;
        }

        const bannerText = bannerLines[i].trim();
        if (i === 0) {
            commentLines.push('/**');
        }
        commentLines.push(` * ${bannerText}`);
    }
    commentLines.push(' */');
    banner = commentLines.join('\n');

    return banner;
}
