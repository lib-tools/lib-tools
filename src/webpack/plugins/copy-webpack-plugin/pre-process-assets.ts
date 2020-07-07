/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { isGlob } from '../../../utils';

export interface PreProcessedAssetEntry {
    context: string;
    from:
        | {
              glob: string;
              dot?: boolean;
          }
        | string;
    fromType: 'file' | 'directory' | 'glob';
    to?: string;
    fromDir?: string;
    exclude?: string[];
    // toIsTemplate?: boolean;
}

// https://www.debuggex.com/r/VH2yS2mvJOitiyr3
// const isTemplateLike = /(\[ext\])|(\[name\])|(\[path\])|(\[folder\])|(\[emoji(:\d+)?\])|(\[(\w+:)?hash(:\w+)?(:\d+)?\])|(\[\d+\])/;

interface Stats {
    isDirectory(): boolean;
    isFile(): boolean;
}

export async function preProcessAssets(
    baseDir: string,
    assetEntries: string | (string | { from: string; to?: string })[],
    inputFileSystem: {
        constructor: {
            name: string;
        };
        readFile(filePath: string, callback: (err: Error | null, data: Buffer) => void): void;
        stat(filePath: string, cb: (err: Error | null, stats: Stats) => void): void;
        exists(filePath: string, cb: (isExists: boolean) => void): void;
        existsSync(itemPath: string): boolean;
        readdirSync(itemPath: string): string[];
        statSync(itemPath: string): Stats | null;
    }
): Promise<PreProcessedAssetEntry[]> {
    if (!assetEntries || !assetEntries.length) {
        return [];
    }

    const entries = Array.isArray(assetEntries) ? assetEntries : [assetEntries];
    const clonedEntries = entries.map((entry) => (typeof entry === 'string' ? entry : { ...entry }));

    const isDirectory = async (p: string): Promise<boolean> => {
        if (typeof inputFileSystem.exists === 'function') {
            return new Promise<boolean>((res) => {
                inputFileSystem.exists(p, (isExists: boolean) => {
                    if (!isExists) {
                        res(false);

                        return;
                    }

                    inputFileSystem.stat(p, (err: Error | null, stats: Stats) => {
                        res(err ? false : stats.isDirectory());

                        return;
                    });
                });
            });
        }

        return new Promise<boolean>((resolve) => {
            inputFileSystem.stat(p, (statError: Error | null, stats: Stats): void => {
                resolve(statError ? false : stats.isDirectory());

                return;
            });
        });
    };

    return Promise.all(
        clonedEntries.map(async (asset: string | { from: string; to?: string }) => {
            if (typeof asset === 'string') {
                const isGlobPattern = asset.lastIndexOf('*') > -1 || isGlob(asset);
                let fromIsDir = false;

                let fromPath = '';
                if (!isGlobPattern) {
                    fromPath = path.isAbsolute(asset) ? path.resolve(asset) : path.resolve(baseDir, asset);
                    fromIsDir = /(\\|\/)$/.test(asset) || (await isDirectory(fromPath));
                } else if (asset.endsWith('*')) {
                    let tempDir = asset.substr(0, asset.length - 1);
                    while (tempDir && tempDir.length > 1 && (tempDir.endsWith('*') || tempDir.endsWith('/'))) {
                        tempDir = tempDir.substr(0, tempDir.length - 1);
                    }

                    if (tempDir) {
                        tempDir = path.isAbsolute(tempDir) ? path.resolve(tempDir) : path.resolve(baseDir, tempDir);
                        if (await isDirectory(tempDir)) {
                            fromPath = tempDir;
                        }
                    }
                }

                if (!isGlobPattern && !fromIsDir) {
                    const ret: PreProcessedAssetEntry = {
                        from: fromPath,
                        fromType: 'file',
                        context: baseDir
                    };

                    return ret;
                } else {
                    const fromGlob = fromIsDir ? path.join(asset, '**/*') : asset;
                    const fromType = fromIsDir ? 'directory' : 'glob';
                    const ret: PreProcessedAssetEntry = {
                        from: {
                            glob: fromGlob,
                            dot: true
                        },
                        fromType,
                        context: baseDir,
                        fromDir: fromPath
                    };

                    return ret;
                }
            } else if (
                typeof asset === 'object' &&
                (asset as {
                    from:
                        | string
                        | {
                              glob: string;
                              dot?: boolean;
                          };
                    to?: string;
                }).from
            ) {
                const assetParsedEntry: PreProcessedAssetEntry = {
                    ...asset,
                    context: baseDir,
                    fromType: 'glob'
                };

                // if (assetParsedEntry.to) {
                //     if (isTemplateLike.test(assetParsedEntry.to)) {
                //         assetParsedEntry.toIsTemplate = true;
                //     }
                // }

                const from = (asset as { from: string; to?: string }).from;
                const isGlobPattern = from.lastIndexOf('*') > -1 || isGlob(from);
                let fromIsDir = false;

                let fromPath = '';
                if (!isGlobPattern) {
                    fromPath = path.isAbsolute(from) ? path.resolve(from) : path.resolve(baseDir, from);
                    fromIsDir = /(\\|\/)$/.test(from) || (await isDirectory(fromPath));
                } else if (from.endsWith('*')) {
                    let tempDir = from.substr(0, from.length - 1);
                    while (tempDir && tempDir.length > 1 && (tempDir.endsWith('*') || tempDir.endsWith('/'))) {
                        tempDir = tempDir.substr(0, tempDir.length - 1);
                    }

                    if (tempDir) {
                        tempDir = path.isAbsolute(tempDir) ? path.resolve(tempDir) : path.resolve(baseDir, tempDir);
                        if (await isDirectory(tempDir)) {
                            fromPath = tempDir;
                        }
                    }
                }

                if (!isGlobPattern && !fromIsDir) {
                    assetParsedEntry.from = fromPath;
                    assetParsedEntry.fromType = 'file';
                } else {
                    const fromGlob = fromIsDir ? path.join(from, '**/*') : from;
                    assetParsedEntry.from = {
                        glob: fromGlob,
                        dot: true
                    };

                    if (fromIsDir) {
                        assetParsedEntry.fromType = 'directory';
                    }
                    assetParsedEntry.fromDir = fromPath;
                }

                return assetParsedEntry;
            } else {
                throw new Error('Invalid assets entry.');
            }
        })
    );
}
