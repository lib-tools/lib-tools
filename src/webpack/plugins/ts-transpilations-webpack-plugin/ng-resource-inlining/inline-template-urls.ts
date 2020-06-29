import * as path from 'path';

import { readFile } from 'fs-extra';
import * as resolve from 'resolve';

import { Options as HtmlMinifyOptions } from 'html-minifier';

import { MagicStringInstance, TemplateUrlInfo, findResourcePath } from './shared';

const resolveAsync = (id: string, opts: resolve.AsyncOpts): Promise<string | null> => {
    return new Promise((res) => {
        resolve(id, opts, (err, resolvedPath) => {
            if (err || !resolvedPath) {
                res(null);
            } else {
                res(resolvedPath);
            }
        });
    });
};

let htmlMinifierModulePath: string | null = null;
let minify: (text: string, options?: HtmlMinifyOptions) => string;

export async function inlineTemplateUrls(
    workspaceRoot: string,
    templateUrlInfoes: TemplateUrlInfo[],
    magicStringInstance: MagicStringInstance,
    srcDir: string,
    outDir: string,
    componentResources: Map<string, string>
): Promise<void> {
    if (htmlMinifierModulePath == null) {
        const p = await resolveAsync('html-minifier', {
            basedir: workspaceRoot
        });

        htmlMinifierModulePath = p ? path.dirname(p) : '';
    }

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

        if (htmlMinifierModulePath) {
            if (!minify) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                minify = require(htmlMinifierModulePath).minify;
            }

            templateContent = minify(templateContent, {
                caseSensitive: true,
                collapseWhitespace: true,
                removeComments: true,
                keepClosingSlash: true,
                removeAttributeQuotes: false
            });
        } else {
            templateContent = templateContent
                .replace(/([\n\r]\s*)+/gm, ' ')
                // .replace(/"/g, '\\"')
                .trim();
        }

        componentResources.set(componentKey, templateContent);

        const templateContentToReplace = `template: \`${templateContent}\``;
        magicStringInstance.overwrite(templateUrlInfo.start, templateUrlInfo.end, templateContentToReplace);
    }
}
