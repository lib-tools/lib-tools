/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { copy } from 'fs-extra';
import * as webpack from 'webpack';

import { AssetEntry } from '../../../models';
import { LogLevelString, Logger, isInFolder, isSamePaths, normalizeRelativePath } from '../../../utils';

import { preProcessAssets } from './pre-process-assets';
import { ProcessedAssetsResult, processAssets } from './process-assets';

// const persistedOutputFileSystemName = 'NodeOutputFileSystem';

export interface CopyWebpackPluginOptions {
    projectRoot: string;
    outputPath: string;
    assets: (string | AssetEntry)[];
    allowCopyOutsideOutputPath?: boolean;
    // forceWriteToDisk?: boolean;
    logLevel?: LogLevelString;
}

export class CopyWebpackPlugin {
    private readonly logger: Logger;
    private readonly fileDependencies: string[] = [];
    private readonly contextDependencies: string[] = [];
    // private readonly cachedFiles: { [key: string]: { [key: string]: boolean } } = {};
    private newWrittenCount = 0;

    get name(): string {
        return 'copy-webpack-plugin';
    }

    constructor(private readonly options: CopyWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            debugPrefix: `[${this.name}]`,
            infoPrefix: ''
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async (compilation: webpack.compilation.Compilation) =>
            this.processCopy(compilation)
        );
    }

    private async processCopy(compilation: webpack.compilation.Compilation): Promise<void> {
        const startTime = Date.now();
        this.newWrittenCount = 0;

        this.logger.debug('Processing assets to be copied');

        if (!this.options.assets || !this.options.assets.length) {
            this.logger.debug('No asset entry is passed');

            return;
        }

        const preProcessedEntries = await preProcessAssets(
            this.options.projectRoot,
            this.options.assets,
            compilation.inputFileSystem
        );

        const outputPath = this.options.outputPath;
        const processedAssets = await processAssets(preProcessedEntries, outputPath, compilation.inputFileSystem);
        await this.writeFile(processedAssets, outputPath);

        if (!this.newWrittenCount) {
            this.logger.debug('No asset has been emitted');
        }

        this.newWrittenCount = 0;
        const duration = Date.now() - startTime;
        this.logger.debug(`Copy completed in [${duration}ms]`);

        this.fileDependencies.forEach((file) => {
            compilation.fileDependencies.add(file);
        });

        this.contextDependencies.forEach((context) => {
            compilation.contextDependencies.add(context);
        });
    }

    private async writeFile(
        processedAssets: ProcessedAssetsResult[],
        // compiler: webpack.Compiler,
        // compilation: webpack.compilation.Compilation,
        outputPath: string
    ): Promise<void> {
        const logInfoFiles: string[] = [];

        await Promise.all(
            processedAssets.map(async (processedAsset) => {
                const assetEntry = processedAsset.assetEntry;

                this.logger.debug(`Copying to ${processedAsset.relativeTo}`);

                if (assetEntry.fromType === 'directory' && !this.contextDependencies.includes(assetEntry.context)) {
                    this.contextDependencies.push(assetEntry.context);
                }

                // if (
                //     !this.options.allowCopyOutsideOutputPath &&
                //     (persistedOutputFileSystemName === compiler.outputFileSystem.constructor.name ||
                //         this.options.forceWriteToDisk)
                // ) {
                if (!this.options.allowCopyOutsideOutputPath) {
                    const outputToAbs = path.resolve(outputPath, processedAsset.relativeTo);
                    if (!isInFolder(outputPath, outputToAbs)) {
                        throw new Error(
                            `Copying assets outside of output path is not permitted, path: ${outputToAbs}.`
                        );
                    }
                }

                if (
                    assetEntry.fromType !== 'directory' &&
                    !this.fileDependencies.includes(processedAsset.absoluteFrom)
                ) {
                    this.fileDependencies.push(processedAsset.absoluteFrom);
                }

                // if (
                //     this.cachedFiles[processedAsset.absoluteFrom] &&
                //     this.cachedFiles[processedAsset.absoluteFrom][processedAsset.hash]
                // ) {
                //     this.logger.debug(
                //         `Already in cached - ${path.relative(
                //             processedAsset.assetEntry.context,
                //             processedAsset.absoluteFrom
                //         )}`
                //     );

                //     return;
                // } else {
                //     this.cachedFiles[processedAsset.absoluteFrom] = {
                //         [processedAsset.hash]: true
                //     };
                // }

                // const compilationAssets = compilation.assets as {
                //     [key: string]: {
                //         size(): number;
                //         source(): Buffer;
                //     };
                // };

                const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);

                if (this.options.logLevel !== 'debug') {
                    if (assetEntry.fromType === 'file') {
                        if (!logInfoFiles.includes(absoluteTo)) {
                            logInfoFiles.push(absoluteTo);
                            this.logger.info(`Copying ${processedAsset.relativeTo} file`);
                        }
                    } else if (assetEntry.fromDir && !isSamePaths(assetEntry.fromDir, assetEntry.context)) {
                        if (!logInfoFiles.includes(assetEntry.fromDir) && !logInfoFiles.includes(absoluteTo)) {
                            logInfoFiles.push(absoluteTo);
                            logInfoFiles.push(assetEntry.fromDir);
                            const fromDirRel = normalizeRelativePath(
                                path.relative(assetEntry.context, assetEntry.fromDir)
                            );
                            this.logger.info(`Copying ${fromDirRel} folder`);
                        }
                    } else if (
                        assetEntry.fromType === 'glob' &&
                        typeof assetEntry.from === 'object' &&
                        !logInfoFiles.includes(assetEntry.from.glob) &&
                        !logInfoFiles.includes(absoluteTo)
                    ) {
                        logInfoFiles.push(absoluteTo);
                        logInfoFiles.push(assetEntry.from.glob);
                        this.logger.info(`Copying ${normalizeRelativePath(assetEntry.from.glob)}`);
                    }
                }

                await copy(processedAsset.absoluteFrom, absoluteTo);

                // if (
                //     this.options.forceWriteToDisk &&
                //     persistedOutputFileSystemName !== compiler.outputFileSystem.constructor.name
                // ) {
                //     const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);

                //     if (this.options.logLevel === 'debug') {
                //         this.logger.debug(`Emitting ${processedAsset.relativeTo} to disk`);
                //     } else {
                //         this.logger.info(`Copying ${processedAsset.relativeTo}`);
                //     }

                //     await copy(processedAsset.absoluteFrom, absoluteTo);

                //     if (!compilationAssets[processedAsset.relativeTo]) {
                //         compilationAssets[processedAsset.relativeTo] = {
                //             size(): number {
                //                 return processedAsset.content.length;
                //             },
                //             source(): Buffer {
                //                 return processedAsset.content;
                //             }
                //         };
                //     }

                //     ++this.newWrittenCount;
                // } else if (!compilationAssets[processedAsset.relativeTo]) {
                //     if (this.options.logLevel === 'debug') {
                //         const msg = `Emitting ${processedAsset.relativeTo}${
                //             compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' &&
                //             !this.options.forceWriteToDisk
                //                 ? ' to memory'
                //                 : ''
                //         }`;
                //         this.logger.debug(msg);
                //     } else {
                //         this.logger.info(`Copying ${processedAsset.relativeTo}`);
                //     }

                //     compilationAssets[processedAsset.relativeTo] = {
                //         size(): number {
                //             return processedAsset.content.length;
                //         },
                //         source(): Buffer {
                //             return processedAsset.content;
                //         }
                //     };

                //     ++this.newWrittenCount;
                // }
            })
        );
    }
}
