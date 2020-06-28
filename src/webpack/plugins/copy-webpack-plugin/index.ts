import * as path from 'path';

import { copy } from 'fs-extra';
import * as webpack from 'webpack';

import { AssetEntry } from '../../../models';
import { InternalError, InvalidConfigError } from '../../../models/errors';
import { LogLevelString, Logger, isInFolder } from '../../../utils';

import { preProcessAssets } from './pre-process-assets';
import { ProcessedAssetsResult, processAssets } from './process-assets';

export interface CopyWebpackPluginOptions {
    baseDir: string;
    outputPath?: string;
    assets: (string | AssetEntry)[];
    allowCopyOutsideOutputPath?: boolean;
    forceWriteToDisk?: boolean;
    logLevel?: LogLevelString;
}

export class CopyWebpackPlugin {
    private readonly _logger: Logger;
    private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private readonly _fileDependencies: string[] = [];
    private readonly _contextDependencies: string[] = [];
    private readonly _cachedFiles: { [key: string]: { [key: string]: boolean } } = {};
    private _newWrittenCount = 0;

    get name(): string {
        return 'copy-webpack-plugin';
    }

    constructor(private readonly _options: CopyWebpackPluginOptions) {
        if (!this._options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        if (!this._options.baseDir) {
            throw new InternalError("The 'baseDir' property is required.");
        }

        if (!path.isAbsolute(this._options.baseDir)) {
            throw new InternalError(`The 'baseDir' must be absolute path, passed value: ${this._options.baseDir}.`);
        }

        this._logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this._options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        let outputPath = this._options.outputPath;
        if (!outputPath && compiler.options.output && compiler.options.output.path) {
            outputPath = compiler.options.output.path;
        }

        const emitFn = (compilation: webpack.compilation.Compilation, cb: (err?: Error) => void) => {
            const startTime = Date.now();
            this._newWrittenCount = 0;

            this._logger.debug('Processing assets to be copied');

            if (!this._options.assets || !this._options.assets.length) {
                this._logger.debug('No asset entry is passed');

                cb();

                return;
            }

            preProcessAssets(this._options.baseDir, this._options.assets, compilation.inputFileSystem)
                .then(async (preProcessedEntries) =>
                    processAssets(preProcessedEntries, outputPath, compilation.inputFileSystem)
                )
                .then(async (processedAssets) =>
                    this.writeFile(processedAssets, compiler, compilation, outputPath || '')
                )
                .then(() => {
                    if (!this._newWrittenCount) {
                        this._logger.debug('No asset has been emitted');
                    }
                    this._newWrittenCount = 0;
                    const duration = Date.now() - startTime;
                    this._logger.debug(`Copy completed in [${duration}ms]`);

                    this._fileDependencies.forEach((file) => {
                        compilation.fileDependencies.add(file);
                    });

                    this._contextDependencies.forEach((context) => {
                        compilation.contextDependencies.add(context);
                    });

                    cb();

                    return;
                })
                .catch((err: Error) => {
                    this._newWrittenCount = 0;

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

                if (assetEntry.fromType === 'directory' && !this._contextDependencies.includes(assetEntry.context)) {
                    this._contextDependencies.push(assetEntry.context);
                }

                if (
                    !this._options.allowCopyOutsideOutputPath &&
                    outputPath &&
                    path.isAbsolute(outputPath) &&
                    (this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name) ||
                        this._options.forceWriteToDisk)
                ) {
                    const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);
                    if (!isInFolder(outputPath, absoluteTo)) {
                        throw new InvalidConfigError(
                            `Copying assets outside of output path is not permitted, path: ${absoluteTo}.`
                        );
                    }
                }

                if (
                    assetEntry.fromType !== 'directory' &&
                    !this._fileDependencies.includes(processedAsset.absoluteFrom)
                ) {
                    this._fileDependencies.push(processedAsset.absoluteFrom);
                }

                if (
                    this._cachedFiles[processedAsset.absoluteFrom] &&
                    this._cachedFiles[processedAsset.absoluteFrom][processedAsset.hash]
                ) {
                    this._logger.debug(
                        `Already in cached - ${path.relative(
                            processedAsset.assetEntry.context,
                            processedAsset.absoluteFrom
                        )}`
                    );

                    return;
                } else {
                    this._cachedFiles[processedAsset.absoluteFrom] = {
                        [processedAsset.hash]: true
                    };
                }

                if (
                    this._options.forceWriteToDisk &&
                    !this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)
                ) {
                    if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                        throw new InternalError('The absolute path must be specified in config -> output.path.');
                    }

                    const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);

                    this._logger.debug(`Emitting ${processedAsset.relativeTo} to disk`);
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

                    ++this._newWrittenCount;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                } else if (!compilation.assets[processedAsset.relativeTo]) {
                    this._logger.debug(
                        `Emitting ${processedAsset.relativeTo}${
                            compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' &&
                            !this._options.forceWriteToDisk
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

                    ++this._newWrittenCount;
                }
            })
        );
    }
}
