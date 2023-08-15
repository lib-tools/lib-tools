import * as path from 'path';

import * as fs from 'fs/promises';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as webpack from 'webpack';

import { BuildConfigInternal } from '../../..//models/index.js';
import { LogLevelString, Logger, isSamePaths, normalizePath, pathExists } from '../../../utils/index.js';

function excludeMatch(filePathRel: string, excludes: string[]): boolean {
    let il = excludes.length;
    while (il--) {
        const ignoreGlob = excludes[il];
        if (minimatch(filePathRel, ignoreGlob, { dot: true, matchBase: true })) {
            return true;
        }
    }

    return false;
}

export interface CopyWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
    logLevel?: LogLevelString;
}

export class CopyWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'copy-webpack-plugin';
    }

    constructor(private readonly options: CopyWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => this.processCopy());
    }

    private async processCopy(): Promise<void> {
        const buildConfig = this.options.buildConfig;

        if (!buildConfig._assetEntries.length) {
            return;
        }

        this.logger.debug('Processing assets to be copied');

        const assetEntries = buildConfig._assetEntries;
        const projectRoot = buildConfig._projectRoot;
        const outputPath = buildConfig._outputPath;
        const infoLoggedFiles: string[] = [];

        for (const assetEntry of assetEntries) {
            const excludes = assetEntry.exclude || ['**/.DS_Store', '**/Thumbs.db'];
            const toPath = path.resolve(outputPath, assetEntry.to || '');
            const hasMagic = glob.hasMagic(assetEntry.from);

            if (hasMagic) {
                let foundPaths = await glob(assetEntry.from, {
                    cwd: projectRoot,
                    nodir: true,
                    dot: true
                });

                foundPaths = foundPaths.filter((p) => !excludeMatch(normalizePath(p), excludes));

                if (!foundPaths.length) {
                    this.logger.warn(`There is no matched file to copy, pattern: ${assetEntry.from}`);
                    continue;
                }

                if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(assetEntry.from)) {
                    infoLoggedFiles.push(assetEntry.from);
                    this.logger.info(`Copying ${assetEntry.from}, total ${foundPaths.length} file(s)`);
                }

                let fromRoot = projectRoot;
                const parts = normalizePath(assetEntry.from).split('/');
                for (const p of parts) {
                    if (await pathExists(path.resolve(fromRoot, p))) {
                        fromRoot = path.resolve(fromRoot, p);
                    } else {
                        break;
                    }
                }

                await Promise.all(
                    foundPaths.map(async (foundFileRel) => {
                        const fromFilePath = path.resolve(projectRoot, foundFileRel);
                        const toFileRel = path.relative(fromRoot, fromFilePath);
                        const toFilePath = path.resolve(toPath, toFileRel);

                        this.logger.debug(`Copying ${normalizePath(foundFileRel)} file`);

                        if (!(await pathExists(path.dirname(toFilePath)))) {
                            await fs.mkdir(path.dirname(toFilePath));
                        }

                        await fs.copyFile(fromFilePath, toFilePath);
                    })
                );
            } else {
                const fromPath = path.isAbsolute(assetEntry.from)
                    ? path.resolve(assetEntry.from)
                    : path.resolve(projectRoot, assetEntry.from);
                if (!(await pathExists(fromPath))) {
                    this.logger.warn(`Path doesn't exist to copy, path: ${fromPath}`);
                    continue;
                }

                const stats = await fs.stat(fromPath);
                if (stats.isFile()) {
                    const fromPathRel = normalizePath(path.relative(projectRoot, fromPath));
                    if (excludeMatch(fromPathRel, excludes)) {
                        this.logger.warn(`Excluded from copy, path: ${fromPath}`);
                        continue;
                    }

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

                    if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(fromPath)) {
                        infoLoggedFiles.push(fromPath);
                        this.logger.info(`Copying ${fromPathRel} file`);
                    }

                    this.logger.debug(`Copying ${fromPathRel} file`);

                    await fs.copyFile(fromPath, toFilePath);
                } else {
                    let foundPaths = await glob('**/*', {
                        cwd: fromPath,
                        nodir: true,
                        dot: true
                    });

                    foundPaths = foundPaths.filter((p) => !excludeMatch(normalizePath(p), excludes));

                    if (!foundPaths.length) {
                        this.logger.warn(`There is no matched file to copy, path: ${fromPath}`);
                        continue;
                    }

                    if (this.options.logLevel !== 'debug' && !infoLoggedFiles.includes(fromPath)) {
                        infoLoggedFiles.push(fromPath);
                        this.logger.info(
                            `Copying ${normalizePath(path.relative(projectRoot, fromPath))} folder, total ${
                                foundPaths.length
                            } file(s)`
                        );
                    }

                    await Promise.all(
                        foundPaths.map(async (foundFileRel) => {
                            const toFilePath = path.resolve(toPath, foundFileRel);
                            const foundFromFilePath = path.resolve(fromPath, foundFileRel);

                            this.logger.debug(
                                `Copying ${normalizePath(path.relative(projectRoot, foundFromFilePath))} file`
                            );

                            await fs.copyFile(foundFromFilePath, toFilePath);
                        })
                    );
                }
            }
        }
    }
}
