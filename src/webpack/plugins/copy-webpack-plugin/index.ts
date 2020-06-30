import * as path from 'path';

import { copy } from 'fs-extra';
import * as webpack from 'webpack';

import { AssetEntry } from '../../../models';
import { LogLevelString, Logger, isInFolder } from '../../../utils';

import { preProcessAssets } from './pre-process-assets';
import { ProcessedAssetsResult, processAssets } from './process-assets';

export interface CopyWebpackPluginOptions {
    projectRoot: string;
    outputPath: string;
    assets: (string | AssetEntry)[];
    allowCopyOutsideOutputPath?: boolean;
    forceWriteToDisk?: boolean;
    logLevel?: LogLevelString;
}

export class CopyWebpackPlugin {
    private readonly logger: Logger;
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private readonly fileDependencies: string[] = [];
    private readonly contextDependencies: string[] = [];
    private readonly cachedFiles: { [key: string]: { [key: string]: boolean } } = {};
    private newWrittenCount = 0;

    get name(): string {
        return 'copy-webpack-plugin';
    }

    constructor(private readonly options: CopyWebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        let outputPath = this.options.outputPath;
        if (!outputPath && compiler.options.output && compiler.options.output.path) {
            outputPath = compiler.options.output.path;
        }

        const emitFn = (compilation: webpack.compilation.Compilation, cb: (err?: Error) => void) => {
            const startTime = Date.now();
            this.newWrittenCount = 0;

            this.logger.debug('Processing assets to be copied');

            if (!this.options.assets || !this.options.assets.length) {
                this.logger.debug('No asset entry is passed');

                cb();

                return;
            }

            preProcessAssets(this.options.projectRoot, this.options.assets, compilation.inputFileSystem)
                .then(async (preProcessedEntries) =>
                    processAssets(preProcessedEntries, outputPath, compilation.inputFileSystem)
                )
                .then(async (processedAssets) =>
                    this.writeFile(processedAssets, compiler, compilation, outputPath || '')
                )
                .then(() => {
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

                    cb();

                    return;
                })
                .catch((err: Error) => {
                    this.newWrittenCount = 0;

                    cb(err);

                    return;
                });
        };

        compiler.hooks.emit.tapAsync(this.name, emitFn);
    }

    private async writeFile(
        processedAssets: ProcessedAssetsResult[],
        compiler: webpack.Compiler,
        compilation: webpack.compilation.Compilation,
        outputPath: string
    ): Promise<void> {
        await Promise.all(
            processedAssets.map(async (processedAsset) => {
                const assetEntry = processedAsset.assetEntry;

                if (assetEntry.fromType === 'directory' && !this.contextDependencies.includes(assetEntry.context)) {
                    this.contextDependencies.push(assetEntry.context);
                }

                if (
                    !this.options.allowCopyOutsideOutputPath &&
                    outputPath &&
                    path.isAbsolute(outputPath) &&
                    (this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name) ||
                        this.options.forceWriteToDisk)
                ) {
                    const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);
                    if (!isInFolder(outputPath, absoluteTo)) {
                        throw new Error(`Copying assets outside of output path is not permitted, path: ${absoluteTo}.`);
                    }
                }

                if (
                    assetEntry.fromType !== 'directory' &&
                    !this.fileDependencies.includes(processedAsset.absoluteFrom)
                ) {
                    this.fileDependencies.push(processedAsset.absoluteFrom);
                }

                if (
                    this.cachedFiles[processedAsset.absoluteFrom] &&
                    this.cachedFiles[processedAsset.absoluteFrom][processedAsset.hash]
                ) {
                    this.logger.debug(
                        `Already in cached - ${path.relative(
                            processedAsset.assetEntry.context,
                            processedAsset.absoluteFrom
                        )}`
                    );

                    return;
                } else {
                    this.cachedFiles[processedAsset.absoluteFrom] = {
                        [processedAsset.hash]: true
                    };
                }

                if (
                    this.options.forceWriteToDisk &&
                    !this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)
                ) {
                    if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                        throw new Error('The absolute path must be specified in config -> output.path.');
                    }

                    const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);

                    this.logger.debug(`Emitting ${processedAsset.relativeTo} to disk`);
                    await copy(processedAsset.absoluteFrom, absoluteTo);

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (!compilation.assets[processedAsset.relativeTo]) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        compilation.assets[processedAsset.relativeTo] = {
                            size(): number {
                                return processedAsset.content.length;
                            },
                            source(): Buffer {
                                return processedAsset.content;
                            }
                        };
                    }

                    ++this.newWrittenCount;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                } else if (!compilation.assets[processedAsset.relativeTo]) {
                    this.logger.debug(
                        `Emitting ${processedAsset.relativeTo}${
                            compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' &&
                            !this.options.forceWriteToDisk
                                ? ' to memory'
                                : ''
                        }`
                    );

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    compilation.assets[processedAsset.relativeTo] = {
                        size(): number {
                            return processedAsset.content.length;
                        },
                        source(): Buffer {
                            return processedAsset.content;
                        }
                    };

                    ++this.newWrittenCount;
                }
            })
        );
    }
}
