import * as path from 'path';
import { pathExists, remove, stat } from 'fs-extra';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import { Compiler } from 'webpack';

import { AfterEmitCleanOptions, BeforeBuildCleanOptions, CleanOptions } from '../../../models/index.js';
import { LogLevelString, Logger, isInFolder, isSamePaths, normalizePath } from '../../../utils/index.js';

export interface CleanWebpackPluginOptions extends CleanOptions {
    workspaceRoot: string;
    outputPath: string;
    logLevel?: LogLevelString;
}

export class CleanWebpackPlugin {
    private readonly logger: Logger;
    private beforeRunCleaned = false;
    private afterEmitCleaned = false;

    get name(): string {
        return 'clean-webpack-plugin';
    }

    constructor(private readonly options: CleanWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: Compiler): void {
        const workspaceRoot = this.options.workspaceRoot;
        const outputPath = this.options.outputPath;

        compiler.hooks.beforeRun.tapAsync(this.name, (_, cb: (err?: Error) => void) => {
            if (this.beforeRunCleaned || !this.options.beforeBuild) {
                cb();

                return;
            }

            const beforeBuildOptions = this.options.beforeBuild;

            if (
                !beforeBuildOptions.cleanOutDir &&
                (!beforeBuildOptions.paths || (beforeBuildOptions.paths && !beforeBuildOptions.paths.length))
            ) {
                this.beforeRunCleaned = true;

                cb();

                return;
            }

            this.cleanTask(beforeBuildOptions, true, outputPath, workspaceRoot)
                .then(() => {
                    this.beforeRunCleaned = true;
                    cb();

                    return;
                })
                .catch(cb);
        });

        compiler.hooks.afterEmit.tapAsync(this.name, (_, cb: (err?: Error) => void) => {
            if (this.afterEmitCleaned || !this.options.afterEmit) {
                cb();

                return;
            }

            const afterEmitOptions = this.options.afterEmit;

            if (!afterEmitOptions.paths || (afterEmitOptions.paths && !afterEmitOptions.paths.length)) {
                this.afterEmitCleaned = true;

                cb();

                return;
            }

            this.cleanTask(afterEmitOptions, false, outputPath, workspaceRoot)
                .then(() => {
                    this.afterEmitCleaned = true;

                    cb();

                    return;
                })
                .catch((err: Error) => {
                    cb(err);

                    return;
                });
        });
    }

    private async cleanTask(
        cleanOptions: BeforeBuildCleanOptions | AfterEmitCleanOptions,
        isBeforeBuildClean: boolean,
        outputPath: string,
        workspaceRoot: string
    ): Promise<void> {
        const rawPathsToClean: string[] = [];

        if (isBeforeBuildClean && (cleanOptions as BeforeBuildCleanOptions).cleanOutDir) {
            rawPathsToClean.push(outputPath);
            rawPathsToClean.push('**/*');
        }

        if (cleanOptions.paths && cleanOptions.paths.length) {
            cleanOptions.paths.forEach((p) => {
                rawPathsToClean.push(p);
            });
        }

        // calculate excludes
        const patternsToExclude: string[] = [];
        const pathsToExclude: string[] = [];
        const existedFilesToExclude: string[] = [];
        const existedDirsToExclude: string[] = [];

        if (cleanOptions.exclude) {
            cleanOptions.exclude.forEach((excludePath) => {
                if (glob.hasMagic(excludePath)) {
                    if (!patternsToExclude.includes(excludePath)) {
                        patternsToExclude.push(excludePath);
                    }
                } else {
                    const absPath = path.isAbsolute(excludePath)
                        ? path.resolve(excludePath)
                        : path.resolve(outputPath, excludePath);
                    if (!pathsToExclude.includes(absPath)) {
                        pathsToExclude.push(absPath);
                    }
                }
            });
        }

        if (pathsToExclude.length > 0) {
            await Promise.all(
                pathsToExclude.map(async (excludePath: string) => {
                    const isExists = await pathExists(excludePath);
                    if (isExists) {
                        const statInfo = await stat(excludePath);
                        if (statInfo.isDirectory()) {
                            if (!existedDirsToExclude.includes(excludePath)) {
                                existedDirsToExclude.push(excludePath);
                            }
                        } else {
                            if (!existedFilesToExclude.includes(excludePath)) {
                                existedFilesToExclude.push(excludePath);
                            }
                        }
                    }
                })
            );
        }

        if (patternsToExclude.length > 0) {
            await Promise.all(
                patternsToExclude.map(async (excludePattern: string) => {
                    const foundExcludePaths = await glob(excludePattern, {
                        cwd: outputPath,
                        dot: true,
                        absolute: true
                    });
                    for (const p of foundExcludePaths) {
                        const absPath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(outputPath, p);
                        const statInfo = await stat(absPath);
                        if (statInfo.isDirectory()) {
                            if (!existedDirsToExclude.includes(absPath)) {
                                existedDirsToExclude.push(absPath);
                            }
                        } else {
                            if (!existedFilesToExclude.includes(absPath)) {
                                existedFilesToExclude.push(absPath);
                            }
                        }
                    }
                })
            );
        }

        const pathsToClean: string[] = [];

        await Promise.all(
            rawPathsToClean.map(async (cleanPattern: string) => {
                if (!glob.hasMagic(cleanPattern)) {
                    const absolutePath = path.isAbsolute(cleanPattern)
                        ? path.resolve(cleanPattern)
                        : path.resolve(outputPath, cleanPattern);

                    if (!pathsToClean.includes(absolutePath)) {
                        pathsToClean.push(absolutePath);
                    }
                } else {
                    const foundPaths = await glob(cleanPattern, { cwd: outputPath, dot: true });
                    foundPaths.forEach((p) => {
                        const absolutePath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(outputPath, p);
                        if (!pathsToClean.includes(absolutePath)) {
                            pathsToClean.push(absolutePath);
                        }
                    });
                }
            })
        );

        for (const pathToClean of pathsToClean) {
            if (
                existedFilesToExclude.includes(pathToClean) ||
                existedDirsToExclude.includes(pathToClean) ||
                pathsToExclude.includes(pathToClean) ||
                existedDirsToExclude.find((e) => isInFolder(e, pathToClean))
            ) {
                continue;
            }

            const relToOutDir = normalizePath(path.relative(outputPath, pathToClean));
            if (relToOutDir) {
                let il = patternsToExclude.length;
                let foundExclude = false;
                while (il--) {
                    const ignoreGlob = patternsToExclude[il];
                    if (minimatch(relToOutDir, ignoreGlob, { dot: true, matchBase: true })) {
                        foundExclude = true;
                        break;
                    }
                }

                if (foundExclude) {
                    continue;
                }
            }

            if (
                path.extname(pathToClean) === '' &&
                (existedFilesToExclude.find((e) => isInFolder(pathToClean, e)) ||
                    existedDirsToExclude.find((e) => isInFolder(pathToClean, e)))
            ) {
                continue;
            }

            let cleanOutDir = true;

            // validation
            if (!isSamePaths(pathToClean, outputPath)) {
                cleanOutDir = false;

                if (isSamePaths(path.parse(pathToClean).root, pathToClean)) {
                    throw new Error(`Cleaning the root directory is not permitted, path: ${pathToClean}.`);
                }

                if (isInFolder(pathToClean, workspaceRoot) || isSamePaths(pathToClean, workspaceRoot)) {
                    throw new Error(`Cleaning the workspace directory is not permitted, path: ${pathToClean}.`);
                }

                if (!isInFolder(workspaceRoot, pathToClean) && this.options.allowOutsideWorkspaceRoot === false) {
                    throw new Error(
                        `Cleaning outside of the workspace root directory is disabled. To enable cleaning, set 'allowOutsideWorkspaceRoot' to 'true' in clean option.`
                    );
                }

                if (
                    (!isInFolder(outputPath, pathToClean) || isSamePaths(outputPath, pathToClean)) &&
                    !this.options.allowOutsideOutDir
                ) {
                    throw new Error(
                        `Cleaning outside of the output directory is disabled. To enable cleaning, set 'allowOutsideWorkspaceRoot' to 'true' in clean option.`
                    );
                }
            }

            const exists = await pathExists(pathToClean);
            if (exists) {
                const relToWorkspace = normalizePath(path.relative(workspaceRoot, pathToClean));

                this.logger.debug(`Deleting ${relToWorkspace}`);
                if (this.options.logLevel !== 'debug') {
                    const msgPrefix = cleanOutDir ? 'Deleting output directory' : 'Deleting';
                    this.logger.info(`${msgPrefix} ${relToWorkspace}`);
                }

                await remove(pathToClean);
            }
        }
    }
}
