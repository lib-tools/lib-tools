import * as path from 'path';

import { readFile } from 'fs-extra';
import { minify } from 'html-minifier';

import { MagicStringInstance, TemplateUrlInfo, findResourcePath } from './shared';

export async function inlineTemplateUrls(
    templateUrlInfoes: TemplateUrlInfo[],
    magicStringInstance: MagicStringInstance,
    srcDir: string,
    outDir: string,
    componentResources: Map<string, string>
): Promise<void> {
    for (const templateUrlInfo of templateUrlInfoes) {
        const resourceId = templateUrlInfo.resourceId;
        const templateSourceFilePath = await findResourcePath(templateUrlInfo.url, resourceId, srcDir, outDir);
        const templateDestFilePath = path.resolve(path.dirname(resourceId), templateUrlInfo.url);

        const componentKey = path
            .relative(outDir, templateDestFilePath)
            .replace(/\\/g, '/')
            .replace(/^(\.\/|\/)/, '')
            .replace(/\/$/, '');
        let templateContent = await readFile(templateSourceFilePath, 'utf-8');

        // templateContent = templateContent
        // .replace(/([\n\r]\s*)+/gm, ' ')
        // // .replace(/"/g, '\\"')
        // .trim();
        // Or

        templateContent = minify(templateContent, {
            caseSensitive: true,
            collapseWhitespace: true,
            removeComments: true,
            keepClosingSlash: true,
            removeAttributeQuotes: false
        });

        componentResources.set(componentKey, templateContent);

        const templateContentToReplace = `template: \`${templateContent}\``;
        magicStringInstance.overwrite(templateUrlInfo.start, templateUrlInfo.end, templateContentToReplace);
    }
}
