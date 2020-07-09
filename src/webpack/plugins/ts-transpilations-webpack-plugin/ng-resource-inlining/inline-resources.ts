/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { promisify } from 'util';

import { pathExists, readFile, readJson, writeFile } from 'fs-extra';
import * as glob from 'glob';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const MagicString = require('magic-string');

import { LoggerBase } from '../../../../utils';

import { inlineStyleUrls } from './inline-style-urls';
import { inlineTemplateUrls } from './inline-template-urls';
import { MagicStringInstance, MetaDataByKey, MetaDataJson, StyleUrlsInfo, TemplateUrlInfo } from './shared';

const globPromise = promisify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

const moduleIdRegex = /moduleId:\s*module\.id\s*,?\s*/g;
const templateUrlRegex = /templateUrl:\s*['"`]([^'"`]+?\.[a-zA-Z]+)['"`]/g;
const styleUrlsRegex = /styleUrls:\s*(\[[^\]]*?\])/gm;

export async function inlineResources(
    srcDir: string,
    searchRootDir: string,
    searchPattern: string,
    stylePreprocessorIncludePaths: string[],
    metadataInline: boolean,
    flatModuleOutFile: string | null,
    logger: LoggerBase
): Promise<boolean> {
    const componentResources = new Map<string, string>();
    let replaced = false;

    if (!searchPattern.includes('*')) {
        searchPattern = path.join(searchPattern, '**', '*');
    }

    let files = await globPromise(searchPattern, { cwd: searchRootDir, nodir: true, dot: true });
    files = files.filter((name) => /\.js$/i.test(name));

    for (const resourceId of files) {
        const content = await readFile(resourceId, 'utf-8');

        const foundTemplateUrlInfoes: TemplateUrlInfo[] = [];
        const foundStyleUrlsInfoes: StyleUrlsInfo[] = [];
        let templateUrlMatch: RegExpExecArray | null;
        let styleUrlsMatch: RegExpExecArray | null;
        let requireSass = false;

        while ((templateUrlMatch = templateUrlRegex.exec(content)) != null) {
            const start = templateUrlMatch.index;
            const end = start + templateUrlMatch[0].length;
            const url = templateUrlMatch[1];
            foundTemplateUrlInfoes.push({ start, end, url, resourceId });
        }

        while ((styleUrlsMatch = styleUrlsRegex.exec(content)) != null) {
            const start = styleUrlsMatch.index;
            const end = start + styleUrlsMatch[0].length;
            const rawStr = styleUrlsMatch[1];

            // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-assignment
            const urls: string[] = eval(rawStr);
            foundStyleUrlsInfoes.push({ start, end, urls, resourceId });
            if (!requireSass && urls.find((u) => /s[ca]ss$/i.test(u))) {
                requireSass = true;
            }
        }

        if (!foundTemplateUrlInfoes.length && !foundStyleUrlsInfoes.length) {
            continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const magicString = new MagicString(content) as MagicStringInstance;

        if (foundTemplateUrlInfoes.length) {
            await inlineTemplateUrls(foundTemplateUrlInfoes, magicString, srcDir, searchRootDir, componentResources);
        }

        if (foundStyleUrlsInfoes.length) {
            await inlineStyleUrls(
                foundStyleUrlsInfoes,
                magicString,
                srcDir,
                searchRootDir,
                stylePreprocessorIncludePaths,
                componentResources
            );
        }

        replaceModuleId(content, magicString);

        if (!replaced) {
            logger.debug('Inlining template and style resources');
        }

        replaced = true;

        await writeFile(resourceId, magicString.toString());

        if (metadataInline && !flatModuleOutFile) {
            // metadata inline
            const metaDataRelativeOutPath = path.relative(searchRootDir, path.dirname(resourceId));
            const metaDataFilePath = path.resolve(
                searchRootDir,
                metaDataRelativeOutPath,
                `${path.parse(resourceId).name}.metadata.json`
            );
            const metaDataFileExists = await pathExists(metaDataFilePath);
            if (metaDataFileExists) {
                const metaJson = (await readJson(metaDataFilePath)) as { metadata: { [key: string]: MetaDataByKey } }[];

                metaJson.forEach((obj: { metadata: { [key: string]: MetaDataByKey } }) => {
                    if (!obj.metadata) {
                        return;
                    }

                    Object.keys(obj.metadata).forEach((key: string) => {
                        const metaDataObj = obj.metadata[key];
                        processMetaDataResources(metaDataObj, metaDataRelativeOutPath, componentResources);
                    });
                });

                await writeFile(metaDataFilePath, JSON.stringify(metaJson));
            }
        }
    }

    if (replaced && metadataInline && flatModuleOutFile) {
        const metaDataFilePath = path.resolve(searchRootDir, flatModuleOutFile);
        const metaDataFileExists = await pathExists(metaDataFilePath);
        if (metaDataFileExists) {
            const metaDataJson = (await readJson(metaDataFilePath)) as MetaDataJson;
            const inlinedMetaDataJson = inlineFlattenMetaDataResources(metaDataJson, componentResources);
            await writeFile(metaDataFilePath, JSON.stringify(inlinedMetaDataJson));
        }
    }

    return replaced;
}

function replaceModuleId(source: string, magicString: MagicStringInstance): void {
    let moduleIdMatch: RegExpExecArray | null;

    while ((moduleIdMatch = moduleIdRegex.exec(source)) != null) {
        const start = moduleIdMatch.index;
        const end = start + moduleIdMatch[0].length;
        magicString.overwrite(start, end, '');
    }
}

function inlineFlattenMetaDataResources(json: MetaDataJson, componentResources: Map<string, string>): MetaDataJson {
    if (!json.importAs || !json.origins || !json.metadata) {
        return json;
    }

    const metadata = json.metadata;
    const origins = json.origins;

    Object.keys(json.origins).forEach((originKey: string) => {
        const metaDataByKey = metadata[originKey];
        if (metaDataByKey) {
            const basePath = path.dirname(origins[originKey]);
            processMetaDataResources(metaDataByKey, basePath, componentResources);
        }
    });

    return json;
}

function processMetaDataResources(
    metaDataByKey: MetaDataByKey,
    basePath: string,
    componentResources: Map<string, string>
): void {
    if (!metaDataByKey.decorators || !metaDataByKey.decorators.length) {
        return;
    }

    for (const dcObj of metaDataByKey.decorators) {
        if (!dcObj.arguments) {
            continue;
        }

        for (const argObj of dcObj.arguments) {
            if (argObj.templateUrl) {
                const templateFullUrl = path
                    .join(basePath, argObj.templateUrl)
                    .replace(/\\/g, '/')
                    .replace(/^(\.\/|\/)/, '')
                    .replace(/\/$/, '');
                const template = componentResources.get(templateFullUrl);
                if (template !== null) {
                    argObj.template = template || '';
                    delete argObj.templateUrl;
                }
            }
            if (argObj.styleUrls) {
                let styleInlined = false;
                const styles = argObj.styleUrls.map((styleUrl: string) => {
                    const styleFullUrl = path
                        .join(basePath, styleUrl)
                        .replace(/\\/g, '/')
                        .replace(/^(\.\/|\/)/, '')
                        .replace(/\/$/, '');
                    const content = componentResources.get(styleFullUrl);
                    if (content !== null) {
                        styleInlined = true;
                    }

                    return content || '';
                });

                if (styleInlined) {
                    argObj.styles = styles;
                    delete argObj.styleUrls;
                }
            }
        }
    }
}
