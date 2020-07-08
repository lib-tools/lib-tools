/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import { promisify } from 'util';

import { copy, pathExists, stat } from 'fs-extra';
import * as glob from 'glob';
import * as webpack from 'webpack';

import { BuildActionInternal } from '../../..//models/internals';
import { LogLevelString, Logger, isSamePaths, normalizePath } from '../../../utils';

const globAsync = promisify(glob);

export interface CopyWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class CopyWebpackPlugin {
    private readonly logger: Logger;

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
        compiler.hooks.emit.tapPromise(this.name, async () => this.processCopy());
    }

    private async processCopy(): Promise<void> {
        const buildAction = this.options.buildAction;

        if (!buildAction._assetEntries.length) {
            return;
        }

        this.logger.debug('Processing assets to be copied');

        const assetEntries = buildAction._assetEntries;
        const projectRoot = buildAction._projectRoot;
        const outputPath = buildAction._outputPath;
        const infoLoggedFiles: string[] = [];

        for (const assetEntry of assetEntries) {
            const toPath = path.resolve(outputPath, assetEntry.to || '');
            const hasMagic = glob.hasMagic(assetEntry.from);

            if (hasMagic) {
                const foundPaths = await globAsync(assetEntry.from, {
                    cwd: projectRoot,
                    nodir: true,
                    dot: true
                });

                if (!foundPaths.length) {
                    this.logger.debug(`There is no matched file to copy, pattern: ${assetEntry.from}.`);
                    continue;
                }

                if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(assetEntry.from)) {
                    infoLoggedFiles.push(assetEntry.from);
                    this.logger.info(`Copying ${assetEntry.from}`);
                }

                await Promise.all(
                    foundPaths.map(async (foundFileRel) => {
                        const toFilePath = path.resolve(toPath, foundFileRel);
                        const foundFromFilePath = path.resolve(projectRoot, foundFileRel);

                        this.logger.debug(
                            `Copying ${normalizePath(path.relative(projectRoot, foundFromFilePath))} file`
                        );

                        await copy(foundFromFilePath, toFilePath);
                    })
                );
            } else {
                const fromPath = path.isAbsolute(assetEntry.from)
                    ? path.resolve(assetEntry.from)
                    : path.resolve(projectRoot, assetEntry.from);
                if (!(await pathExists(fromPath))) {
                    this.logger.debug(`There is no matched file to copy, path: ${fromPath}.`);
                    continue;
                }

                const stats = await stat(fromPath);
                if (stats.isFile()) {
                    const fromExt = path.extname(fromPath);
                    const toExt = path.extname(toPath);
                    let toFilePath = toPath;
                    if (
                        !assetEntry.to ||
                        assetEntry.to.endsWith('/') ||
                        isSamePaths(outputPath, toPath) ||
                        (fromExt && !toExt)
                    ) {
                        toFilePath = path.resolve(toPath, path.basename(fromPath));
                    }

                    const fromPathRel = normalizePath(path.relative(projectRoot, fromPath));
                    if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(fromPath)) {
                        infoLoggedFiles.push(fromPath);
                        this.logger.info(`Copying ${fromPathRel} file`);
                    }

                    this.logger.debug(`Copying ${fromPathRel} file`);

                    await copy(fromPath, toFilePath);
                } else {
                    const foundFilePaths = await globAsync('**/*', {
                        cwd: fromPath,
                        nodir: true,
                        dot: true
                    });

                    if (!foundFilePaths.length) {
                        this.logger.debug(`There is no matched file to copy, path: ${fromPath}.`);
                        continue;
                    }

                    if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(fromPath)) {
                        infoLoggedFiles.push(fromPath);
                        this.logger.info(`Copying ${normalizePath(path.relative(projectRoot, fromPath))} folder`);
                    }

                    await Promise.all(
                        foundFilePaths.map(async (foundFileRel) => {
                            const toFilePath = path.resolve(toPath, foundFileRel);
                            const foundFromFilePath = path.resolve(fromPath, foundFileRel);

                            this.logger.debug(
                                `Copying ${normalizePath(path.relative(projectRoot, foundFromFilePath))} file`
                            );

                            await copy(foundFromFilePath, toFilePath);
                        })
                    );
                }
            }
        }
    }
}
