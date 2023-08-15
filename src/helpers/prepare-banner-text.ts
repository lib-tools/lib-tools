import * as path from 'path';

import * as fs from 'fs/promises';

import { BuildConfigInternal } from '../models/index.js';
import { findUp } from '../utils/index.js';

export async function prepareBannerText(buildConfig: BuildConfigInternal): Promise<void> {
    if (!buildConfig.banner) {
        return;
    }

    let bannerText = buildConfig.banner;

    if (/\.txt$/i.test(bannerText)) {
        const bannerFilePath = await findUp(bannerText, buildConfig._projectRoot, buildConfig._workspaceRoot);
        if (bannerFilePath) {
            bannerText = await fs.readFile(bannerFilePath, 'utf-8');
        } else {
            throw new Error(
                `The banner text file: ${path.resolve(
                    buildConfig._projectRoot,
                    bannerText
                )} doesn't exist. Correct value in 'projects[${buildConfig._projectName}].scriptBundle.banner'.`
            );
        }
    }

    if (!bannerText) {
        return;
    }

    bannerText = addCommentToBanner(bannerText);
    bannerText = bannerText.replace(/[$|[]CURRENT[_-]?YEAR[$|\]]/gim, new Date().getFullYear().toString());
    bannerText = bannerText.replace(/[$|[](PROJECT|PACKAGE)[_-]?NAME[$|\]]/gim, buildConfig._packageName);
    bannerText = bannerText.replace(/[$|[](PROJECT|PACKAGE)?[_-]?VERSION[$|\]]/gim, buildConfig._packageVersion);
    bannerText = bannerText.replace(/0\.0\.0-PLACEHOLDER/i, buildConfig._packageVersion);

    buildConfig._bannerText = bannerText;
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
