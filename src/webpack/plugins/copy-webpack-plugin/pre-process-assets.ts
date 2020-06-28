/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import * as path from 'path';

import { InternalError } from '../../../models/errors';
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
    toIsTemplate?: boolean;
}

// https://www.debuggex.com/r/VH2yS2mvJOitiyr3
const isTemplateLike = /(\[ext\])|(\[name\])|(\[path\])|(\[folder\])|(\[emoji(:\d+)?\])|(\[(\w+:)?hash(:\w+)?(:\d+)?\])|(\[\d+\])/;

export async function preProcessAssets(
    baseDir: string,
    assetEntries: string | (string | { from: string; to?: string })[],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    inputFileSystem: any = require('fs')
): Promise<PreProcessedAssetEntry[]> {
    if (!assetEntries || !assetEntries.length) {
        return [];
    }

    const entries = Array.isArray(assetEntries) ? assetEntries : [assetEntries];
    const clonedEntries = entries.map((entry: unknown) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        typeof entry === 'object' ? JSON.parse(JSON.stringify(entry)) : entry
    );

    const isDirectory = async (p: string): Promise<boolean> => {
        if (typeof inputFileSystem.exists === 'function') {
            return new Promise<boolean>((resolve) => {
                inputFileSystem.exists(p, (exists: boolean) => {
                    if (!exists) {
                        resolve(false);

                        return;
                    }

                    inputFileSystem.stat(p, (statError: Error, statResult: any) => {
                        resolve(statError ? false : statResult.isDirectory());

                        return;
                    });
                });
            });
        }

        return new Promise<boolean>((resolve) => {
            inputFileSystem.stat(p, (statError: Error, statResult: any): void => {
                resolve(statError ? false : statResult.isDirectory());

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
                        fromType: fromType as any,
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
                    fromType: 'glob' as any
                };

                if (assetParsedEntry.to) {
                    if (isTemplateLike.test(assetParsedEntry.to)) {
                        assetParsedEntry.toIsTemplate = true;
                    }
                }

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
                throw new InternalError('Invalid assets entry.');
            }
        })
    );
}
