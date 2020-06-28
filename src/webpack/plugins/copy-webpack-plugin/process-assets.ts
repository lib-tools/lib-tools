/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as path from 'path';
import { promisify } from 'util';

import * as glob from 'glob';
import * as loaderUtils from 'loader-utils';
import * as minimatch from 'minimatch';

import { InternalError } from '../../../models/errors';
import { isInFolder, isSamePaths, normalizeRelativePath } from '../../../utils';

import { PreProcessedAssetEntry } from './pre-process-assets';

const globAsync = promisify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

export interface ProcessedAssetsResult {
    assetEntry: PreProcessedAssetEntry;
    relativeFrom: string;
    absoluteFrom: string;
    relativeTo: string;
    content: Buffer;
    hash: string;
}

export async function processAssets(
    preProcessedEntries: PreProcessedAssetEntry[],
    outputPath?: string,
    inputFileSystem: any = require('fs')
): Promise<ProcessedAssetsResult[]> {
    const results: ProcessedAssetsResult[] = [];
    await Promise.all(
        preProcessedEntries.map(async (assetEntry: PreProcessedAssetEntry) => {
            const relativeFromPaths: string[] = [];
            if (typeof assetEntry.from === 'string') {
                // for absolute file path
                const relativeFromPath = path.isAbsolute(assetEntry.from)
                    ? path.relative(assetEntry.context, assetEntry.from)
                    : assetEntry.from;
                relativeFromPaths.push(relativeFromPath);
            } else {
                let fromGlobPattern = (assetEntry.from as any).glob as string;
                if (path.isAbsolute(fromGlobPattern)) {
                    fromGlobPattern = path.relative(assetEntry.context, fromGlobPattern);
                }
                if (inputFileSystem.constructor.name === 'MemoryFileSystem') {
                    const memItems = inputFileSystem.readdirSync(assetEntry.context);
                    const memFiles = getAllMemoryFiles(
                        inputFileSystem,
                        memItems,
                        assetEntry.context,
                        assetEntry.context
                    );

                    memFiles.forEach((mf) => {
                        if (minimatch(mf, fromGlobPattern, { dot: true, matchBase: true })) {
                            relativeFromPaths.push(mf);
                        }
                    });
                } else {
                    const foundPaths = await globAsync(fromGlobPattern, {
                        cwd: assetEntry.context,
                        nodir: true,
                        dot: true
                    });
                    relativeFromPaths.push(...foundPaths);
                }
            }

            await Promise.all(
                relativeFromPaths.map(async (relativeFrom) => {
                    const absoluteFrom = path.resolve(assetEntry.context, relativeFrom);

                    const isExists = await new Promise<boolean>((resolve) => {
                        inputFileSystem.stat(absoluteFrom, (statError: Error) => {
                            resolve(statError ? false : true);

                            return;
                        });
                    });

                    if (!isExists) {
                        return;
                    }

                    const content = await new Promise<Buffer>((resolve, reject) => {
                        inputFileSystem.readFile(absoluteFrom, (err: Error, data: Buffer) => {
                            if (err) {
                                reject(err);

                                return;
                            }
                            resolve(data);
                        });
                    });
                    const hash = loaderUtils.getHashDigest(content, 'md5', 'hex', 9999);

                    // check the ignore list
                    let shouldIgnore = false;
                    const ignores = assetEntry.exclude || ['.gitkeep', '**/.DS_Store', '**/Thumbs.db'];
                    let il = ignores.length;
                    while (il--) {
                        const ignoreGlob = ignores[il];
                        if (minimatch(relativeFrom, ignoreGlob, { dot: true, matchBase: true })) {
                            shouldIgnore = true;
                            break;
                        }
                    }

                    if (shouldIgnore) {
                        return;
                    }

                    if (assetEntry.to) {
                        assetEntry.to = normalizeRelativePath(assetEntry.to);
                    }

                    const assetToEmit: ProcessedAssetsResult = {
                        assetEntry,
                        content,
                        hash,
                        relativeFrom,
                        absoluteFrom,
                        relativeTo: assetEntry.to || ''
                    };

                    if (assetEntry.fromDir) {
                        assetToEmit.relativeFrom = path.relative(assetEntry.fromDir, absoluteFrom);
                    }

                    let shouldFlattern = assetEntry.fromType === 'file';
                    if (!shouldFlattern) {
                        for (const relfromPath of relativeFromPaths) {
                            const absFromPath = path.resolve(assetEntry.context, relfromPath);
                            if (
                                (assetEntry.fromType !== 'directory' && !isInFolder(assetEntry.context, absFromPath)) ||
                                isSamePaths(path.dirname(absFromPath), path.parse(absFromPath).root)
                            ) {
                                shouldFlattern = true;
                                break;
                            }
                        }
                    }

                    if (assetEntry.to) {
                        if (shouldFlattern) {
                            assetToEmit.relativeFrom = path.basename(assetToEmit.absoluteFrom);
                        }

                        if (assetEntry.toIsTemplate && assetToEmit.relativeTo) {
                            // a hack so .dotted files don't get parsed as extensions
                            const basename = path.basename(assetToEmit.relativeFrom);
                            let dotRemoved = false;

                            if (basename[0] === '.') {
                                dotRemoved = true;
                                assetToEmit.relativeFrom = path.join(
                                    path.dirname(assetToEmit.relativeFrom),
                                    basename.slice(1)
                                );
                            }

                            // if it doesn't have an extension, remove it from the pattern
                            // ie. [name].[ext] or [name][ext] both become [name]
                            if (!path.extname(assetToEmit.relativeFrom)) {
                                assetToEmit.relativeTo = assetToEmit.relativeTo.replace(/\.?\[ext\]/g, '');
                            }

                            // a hack because loaderUtils.interpolateName doesn't
                            // find the right path if no directory is defined
                            // i.e. [path] applied to 'file.txt' would return 'file'
                            if (assetToEmit.relativeFrom.indexOf(path.sep) < 0) {
                                assetToEmit.relativeFrom = path.sep + assetToEmit.relativeFrom;
                            }

                            assetToEmit.relativeTo = loaderUtils.interpolateName(
                                { resourcePath: assetToEmit.relativeFrom } as any,
                                assetToEmit.relativeTo,
                                { content }
                            );

                            // Add back removed dots
                            if (dotRemoved) {
                                const newBasename = path.basename(assetToEmit.relativeTo);
                                assetToEmit.relativeTo = `${path.dirname(assetToEmit.relativeTo)}/.${newBasename}`;
                            }
                        } else if (assetEntry.fromType === 'directory' || assetEntry.fromType === 'glob') {
                            assetToEmit.relativeTo = path.join(assetEntry.to, assetToEmit.relativeFrom);
                        } else {
                            assetToEmit.relativeTo = assetEntry.to;
                        }
                    } else {
                        if (
                            (assetEntry.fromType === 'directory' || assetEntry.fromType === 'glob') &&
                            !shouldFlattern
                        ) {
                            assetToEmit.relativeTo = assetToEmit.relativeFrom;
                        } else {
                            assetToEmit.relativeTo = path.basename(assetToEmit.absoluteFrom);
                        }
                    }

                    if (path.isAbsolute(assetToEmit.relativeTo)) {
                        if (!outputPath || outputPath === '/') {
                            throw new InternalError("The absolute path is required for 'outputPath'.");
                        }

                        assetToEmit.relativeTo = path.relative(outputPath, assetToEmit.relativeTo);
                    }

                    // ensure forward slashes
                    assetToEmit.relativeTo = normalizeRelativePath(assetToEmit.relativeTo);

                    results.push(assetToEmit);
                })
            );
        })
    );

    return results;
}

export function getAllMemoryFiles(
    memoryFileSystem: any,
    items: string[],
    baseContext: string,
    currentContext: string
): string[] {
    const results: string[] = [];
    if (!items || !items.length) {
        return results;
    }

    for (const item of items) {
        const itemPath = path.join(currentContext, item);
        if (typeof memoryFileSystem.existsSync === 'function') {
            if (!memoryFileSystem.existsSync(itemPath)) {
                continue;
            }
        } else {
            try {
                const statResult = memoryFileSystem.statSync(itemPath);
                if (!statResult) {
                    continue;
                }
            } catch (ee) {
                continue;
            }
        }

        if (memoryFileSystem.statSync(itemPath).isDirectory()) {
            const subItems = memoryFileSystem.readdirSync(itemPath);
            const subResults = getAllMemoryFiles(memoryFileSystem, subItems, baseContext, itemPath);
            results.push(...subResults);
        } else if (memoryFileSystem.statSync(itemPath).isFile()) {
            results.push(path.relative(baseContext, itemPath));
        }
    }

    return results;
}
