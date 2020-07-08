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
import { LogLevelString, Logger, normalizeRelativePath } from '../../../utils';

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
        const startTime = Date.now();
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
            const toPathAbs = path.resolve(outputPath, assetEntry.to || '');
            const hasMagic = glob.hasMagic(assetEntry.from);

            if (hasMagic) {
                let globPattern = assetEntry.from;
                if (path.isAbsolute(globPattern)) {
                    globPattern = path.relative(projectRoot, globPattern);
                }

                const foundPaths = await globAsync(globPattern, {
                    cwd: projectRoot,
                    nodir: true,
                    dot: true
                });

                if (!foundPaths.length) {
                    this.logger.debug(`There is no matched file to copy, pattern: ${assetEntry.from}.`);
                    continue;
                }

                await Promise.all(
                    foundPaths.map(async (pathRel) => {
                        const fromFilePathAbs = path.resolve(projectRoot, pathRel);
                        this.logger.debug(`Copying ${normalizeRelativePath(pathRel)}`);
                        await copy(fromFilePathAbs, toPathAbs);
                    })
                );
            } else {
                const fromPathAbs = path.isAbsolute(assetEntry.from)
                    ? path.resolve(assetEntry.from)
                    : path.resolve(projectRoot, assetEntry.from);
                if (!(await pathExists(fromPathAbs))) {
                    this.logger.debug(`There is no matched file to copy, path: ${fromPathAbs}.`);
                    continue;
                }

                const stats = await stat(fromPathAbs);
                if (stats.isFile()) {
                    const fromPathRel = normalizeRelativePath(path.relative(projectRoot, fromPathAbs));

                    if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(fromPathAbs)) {
                        infoLoggedFiles.push(fromPathAbs);
                        this.logger.info(`Copying ${fromPathRel}`);
                    }

                    this.logger.debug(`Copying ${fromPathRel}`);
                    await copy(fromPathAbs, toPathAbs);
                } else {
                    const globPattern = path.join(fromPathAbs, '**/*');
                    const foundPaths = await globAsync(globPattern, {
                        cwd: fromPathAbs,
                        nodir: true,
                        dot: true
                    });

                    if (!foundPaths.length) {
                        this.logger.debug(`There is no matched file to copy, path: ${fromPathAbs}.`);
                        continue;
                    }

                    if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(fromPathAbs)) {
                        infoLoggedFiles.push(fromPathAbs);
                        const fromPathRel = normalizeRelativePath(path.relative(projectRoot, fromPathAbs));
                        this.logger.info(`Copying ${fromPathRel}`);
                    }

                    await Promise.all(
                        foundPaths.map(async (pathRel) => {
                            const fromFilePathAbs = path.resolve(fromPathAbs, pathRel);
                            this.logger.debug(`Copying ${normalizeRelativePath(pathRel)}`);
                            await copy(fromFilePathAbs, toPathAbs);
                        })
                    );
                }
            }
        }

        const duration = Date.now() - startTime;
        this.logger.debug(`Copy completed in [${duration}ms]`);
    }
}
