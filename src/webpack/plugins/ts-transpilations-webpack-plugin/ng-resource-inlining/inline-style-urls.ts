/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import * as CleanCSS from 'clean-css';
import { readFile } from 'fs-extra';
import * as sass from 'sass';

import { MagicStringInstance, StyleUrlsInfo, findResourcePath } from './shared';

export async function inlineStyleUrls(
    styleUrlsInfoes: StyleUrlsInfo[],
    magicStringInstance: MagicStringInstance,
    srcDir: string,
    outDir: string,
    includePaths: string[],
    componentResources: Map<string, string>
): Promise<void> {
    for (const styleUrlsInfo of styleUrlsInfoes) {
        const styleUrls = styleUrlsInfo.urls;
        const resourceId = styleUrlsInfo.resourceId;

        const styleContents = await Promise.all(
            styleUrls.map(async (styleUrl: string) => {
                const styleSourceFilePath = await findResourcePath(styleUrl, resourceId, srcDir, outDir);
                const styleDestFilePath = path.resolve(path.dirname(resourceId), styleUrl);
                const styleContentBuffer = await readStyleContent(styleSourceFilePath, includePaths);

                const componentKey = path
                    .relative(outDir, styleDestFilePath)
                    .replace(/\\/g, '/')
                    .replace(/^(\.\/|\/)/, '')
                    .replace(/\/$/, '');

                let styleContentStr = styleContentBuffer.toString();
                // styleContentStr = `${styleContentStr}`.replace(/([\n\r]\s*)+/gm, ' ').replace(/"/g, '\\"');
                // Or
                const result = new CleanCSS().minify(styleContentStr);
                if (result.errors && result.errors.length) {
                    throw new Error(result.errors.join('\n'));
                }
                styleContentStr = result.styles;

                componentResources.set(componentKey, styleContentStr);

                return styleContentStr;
            })
        );

        const styleContentsToReplace = `styles: ["${styleContents.join(' ')}"]`;
        magicStringInstance.overwrite(styleUrlsInfo.start, styleUrlsInfo.end, styleContentsToReplace);
    }
}

async function readStyleContent(styleSourceFilePath: string, includePaths: string[]): Promise<string | Buffer> {
    let styleContent: string | Buffer;

    if (/\.s[ac]ss$$/i.test(styleSourceFilePath)) {
        const result = await new Promise<sass.Result>((res, rej) => {
            sass.render({ file: styleSourceFilePath, includePaths }, (err: Error, sassResult: sass.Result) => {
                if (err) {
                    rej(err);

                    return;
                }

                res(sassResult);
            });
        });
        styleContent = result.css;
    } else {
        styleContent = await readFile(styleSourceFilePath, 'utf-8');
    }

    return styleContent;
}
