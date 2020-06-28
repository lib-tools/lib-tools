import * as path from 'path';

import { promisify } from 'util';

import { pathExists, readFile, readJson, writeFile } from 'fs-extra';
import * as glob from 'glob';

import * as autoprefixer from 'autoprefixer';
import { minify as minifyHtml } from 'html-minifier';
import * as sass from 'sass';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cssnano = require('cssnano');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MagicString = require('magic-string');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postcss = require('postcss');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postcssUrl = require('postcss-url');

import { LoggerBase } from '../utils';

const globPromise = promisify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

const moduleIdRegex = /moduleId:\s*module\.id\s*,?\s*/g;
const templateUrlRegex = /templateUrl:\s*['"`]([^'"`]+?\.[a-zA-Z]+)['"`]/g;
const styleUrlsRegex = /styleUrls:\s*(\[[^\]]*?\])/gm;

interface FoundTemplateUrlInfo {
    url: string;
    start: number;
    end: number;
    resourceId: string;
}

interface FoundStyleUrlInfo {
    urls: string[];
    start: number;
    end: number;
    resourceId: string;
}

interface MagicStringInstance {
    overwrite(start: number, end: number, content: string): void;
}

interface MetaDataByKey {
    decorators?: {
        arguments?: { templateUrl?: string; template?: string; styleUrls?: string[]; styles?: string[] }[];
    }[];
}

interface MetaDataJson {
    importAs?: string;
    origins?: { [key: string]: string };
    metadata?: { [key: string]: MetaDataByKey };
}

export async function inlineNgResources(
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

    if (searchPattern.indexOf('*') < 0) {
        // Argument is a directory target, add glob patterns to include every files.
        searchPattern = path.join(searchPattern, '**', '*');
    }

    let files = await globPromise(searchPattern, { cwd: searchRootDir, nodir: true, dot: true });
    files = files.filter((name) => /\.js$/i.test(name)); // Matches only javaScript/typescript files.

    for (const resourceId of files) {
        const content = await readFile(resourceId, 'utf-8');
        let hasReplacements: boolean;

        const foundTemplateUrls: FoundTemplateUrlInfo[] = [];
        const foundStyleUrls: FoundStyleUrlInfo[] = [];
        let templateUrlMatch: RegExpExecArray | null;
        let styleUrlsMatch: RegExpExecArray | null;
        let requireSass = false;

        while ((templateUrlMatch = templateUrlRegex.exec(content)) != null) {
            const start = templateUrlMatch.index;
            const end = start + templateUrlMatch[0].length;
            const url = templateUrlMatch[1];
            foundTemplateUrls.push({ start, end, url, resourceId });
        }

        while ((styleUrlsMatch = styleUrlsRegex.exec(content)) != null) {
            const start = styleUrlsMatch.index;
            const end = start + styleUrlsMatch[0].length;
            const rawStr = styleUrlsMatch[1];

            // eslint-disable-next-line no-eval
            const urls: string[] = eval(rawStr);
            foundStyleUrls.push({ start, end, urls, resourceId });
            if (!requireSass && urls.find((u) => /s[ca]ss$/i.test(u))) {
                requireSass = true;
            }
        }

        if (!foundTemplateUrls.length && !foundStyleUrls.length) {
            continue;
        }

        const magicString = new MagicString(content);

        const hasTemplateReplacement = await inlineTemplateUrls(
            foundTemplateUrls,
            magicString,
            srcDir,
            searchRootDir,
            componentResources
        );
        hasReplacements = hasTemplateReplacement;

        const hasStyleReplacement = await inlineStyleUrls(
            foundStyleUrls,
            magicString,
            srcDir,
            searchRootDir,
            stylePreprocessorIncludePaths,
            componentResources
        );
        hasReplacements = hasReplacements || hasStyleReplacement;

        const hasModuleIdMatched = await replaceModuleId(content, magicString);
        hasReplacements = hasReplacements || hasModuleIdMatched;

        if (hasReplacements) {
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
                    const metaJson = await readJson(metaDataFilePath);

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
    }

    if (replaced && metadataInline && flatModuleOutFile) {
        const metaDataFilePath = path.resolve(searchRootDir, flatModuleOutFile);
        const metaDataFileExists = await pathExists(metaDataFilePath);
        if (metaDataFileExists) {
            const metaDataJson = await readJson(metaDataFilePath);
            const inlinedMetaDataJson = inlineFlattenMetaDataResources(metaDataJson, componentResources);
            await writeFile(metaDataFilePath, JSON.stringify(inlinedMetaDataJson));
        }
    }

    return replaced;
}

async function inlineTemplateUrls(
    foundTemplateUrls: FoundTemplateUrlInfo[],
    magicString: MagicStringInstance,
    srcDir: string,
    outDir: string,
    componentResources: Map<string, string>
): Promise<boolean> {
    let hasReplacement = false;

    for (const foundUrlInfo of foundTemplateUrls) {
        const resourceId = foundUrlInfo.resourceId;
        const templateSourceFilePath = await findResourcePath(foundUrlInfo.url, resourceId, srcDir, outDir);
        const templateDestFilePath = path.resolve(path.dirname(resourceId), foundUrlInfo.url);

        const componentKey = path
            .relative(outDir, templateDestFilePath)
            .replace(/\\/g, '/')
            .replace(/^(\.\/|\/)/, '')
            .replace(/\/$/, '');
        let templateContent = await readFile(templateSourceFilePath, 'utf-8');

        // templateContent = templateContent
        //    .replace(/([\n\r]\s*)+/gm, ' ').trim();
        // Or
        templateContent = minifyHtml(templateContent, {
            caseSensitive: true,
            collapseWhitespace: true,
            removeComments: true,
            keepClosingSlash: true,
            removeAttributeQuotes: false
        });

        componentResources.set(componentKey, templateContent);

        const templateContentToReplace = `template: \`${templateContent}\``;
        magicString.overwrite(foundUrlInfo.start, foundUrlInfo.end, templateContentToReplace);

        hasReplacement = true;
    }

    return hasReplacement;
}

async function inlineStyleUrls(
    foundStyleUrls: FoundStyleUrlInfo[],
    magicString: MagicStringInstance,
    srcDir: string,
    outDir: string,
    includePaths: string[],
    componentResources: Map<string, string>
): Promise<boolean> {
    let hasReplacement = false;

    for (const foundUrlInfo of foundStyleUrls) {
        const styleUrls = foundUrlInfo.urls;
        const resourceId = foundUrlInfo.resourceId;

        const stylesContents = await Promise.all(
            styleUrls.map(async (styleUrl: string) => {
                const styleSourceFilePath = await findResourcePath(styleUrl, resourceId, srcDir, outDir);
                const styleDestFilePath = path.resolve(path.dirname(resourceId), styleUrl);

                let styleContent: string | Buffer;
                if (/\.s[ac]ss$$/i.test(styleSourceFilePath)) {
                    const result = await new Promise<{
                        css: Buffer;
                    }>((resolve, reject) => {
                        sass.render(
                            { file: styleSourceFilePath, includePaths },
                            (
                                err: Error,
                                sassResult: {
                                    css: Buffer;
                                }
                            ) => {
                                if (err) {
                                    reject(err);

                                    return;
                                }

                                resolve(sassResult);
                            }
                        );
                    });
                    styleContent = result.css;
                } else {
                    styleContent = await readFile(styleSourceFilePath, 'utf-8');
                }

                const componentKey = path
                    .relative(outDir, styleDestFilePath)
                    .replace(/\\/g, '/')
                    .replace(/^(\.\/|\/)/, '')
                    .replace(/\/$/, '');

                let minifiedStyleContent = styleContent.toString();
                // minifiedStyleContent = `${minifiedStyleContent}`
                //    .replace(/([\n\r]\s*)+/gm, ' ');
                // Or
                minifiedStyleContent = await processPostCss(minifiedStyleContent, styleSourceFilePath);
                componentResources.set(componentKey, minifiedStyleContent);

                hasReplacement = true;

                return styleContent;
            })
        );

        const stylesContentsToReplace = `styles: [${stylesContents.join(',')}]`;
        magicString.overwrite(foundUrlInfo.start, foundUrlInfo.end, stylesContentsToReplace);
    }

    return hasReplacement;
}

async function replaceModuleId(source: string, magicString: MagicStringInstance): Promise<boolean> {
    let hasReplacement = false;
    let moduleIdMatch: RegExpExecArray | null;

    while ((moduleIdMatch = moduleIdRegex.exec(source)) != null) {
        const start = moduleIdMatch.index;
        const end = start + moduleIdMatch[0].length;
        hasReplacement = true;
        magicString.overwrite(start, end, '');
    }

    return hasReplacement;
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

async function findResourcePath(url: string, resourceId: string, srcDir: string, rootOutDir: string): Promise<string> {
    const dir = path.parse(resourceId).dir;
    const relOutPath = path.relative(rootOutDir, dir);
    const filePath = path.resolve(srcDir, relOutPath, url);
    const filePathExists = await pathExists(filePath);
    if (filePathExists) {
        return filePath;
    } else if (/\.(css|scss|sass|less)$/i.test(filePath)) {
        const failbackExts = ['.css', '.scss', '.sass', '.less'];
        const curExt = path.parse(filePath).ext;
        for (const ext of failbackExts) {
            if (ext === curExt) {
                continue;
            }
            const tempNewFilePath = filePath.substr(0, filePath.length - curExt.length) + ext;
            const tempNewFilePathExists = await pathExists(tempNewFilePath);

            if (tempNewFilePathExists) {
                return tempNewFilePath;
            }
        }
    }

    return filePath;
}

async function processPostCss(css: string, from: string): Promise<string> {
    const result = await postcss([
        postcssUrl({
            url: 'inline'
        }),

        autoprefixer,
        cssnano({
            safe: true,
            mergeLonghand: false,
            discardComments: {
                removeAll: true
            }
        })
    ]).process(css, {
        from
    });

    return result.css;
}
