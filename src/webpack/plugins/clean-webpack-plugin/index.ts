import * as path from 'path';
import { promisify } from 'util';

import { pathExists, remove, stat } from 'fs-extra';
import * as glob from 'glob';
import * as minimatch from 'minimatch';
import { Compiler } from 'webpack';

import { AfterEmitCleanOptions, BeforeBuildCleanOptions, CleanOptions } from '../../../models';
import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger, isGlob, isInFolder, isSamePaths, normalizeRelativePath } from '../../../utils';

const globPromise = promisify(glob);

export interface CleanWebpackPluginOptions {
    projectBuildConfig: ProjectBuildConfigInternal;
    logLevel?: LogLevelString;
}

interface CleanOptionsInternal extends CleanOptions {
    workspaceRoot: string;
    outputPath: string;
    forceCleanToDisk?: boolean;
    logLevel?: LogLevelString;
}

export class CleanWebpackPlugin {
    private readonly options: CleanOptionsInternal;
    private readonly logger: Logger;
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private beforeRunCleaned = false;
    private afterEmitCleaned = false;
    private isPersistedOutputFileSystem = true;

    get name(): string {
        return 'clean-webpack-plugin';
    }

    constructor(options: CleanWebpackPluginOptions) {
        this.options = this.prepareCleanOptions(options);

        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            debugPrefix: `[${this.name}]`,
            infoPrefix: ''
        });
    }

    apply(compiler: Compiler): void {
        let outputPath = this.options.outputPath;
        if (!outputPath && compiler.options.output && compiler.options.output.path) {
            outputPath = compiler.options.output.path;
        }

        const workspaceRoot = this.options.workspaceRoot;

        if (!this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
            this.isPersistedOutputFileSystem = false;
        }

        compiler.hooks.beforeRun.tapAsync(this.name, (_, cb: (err?: Error) => void) => {
            const startTime = Date.now();

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

            if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                throw new Error(
                    `[${this.name}] Absolute output path must be specified at webpack config -> output -> path.`
                );
            }

            this.logger.debug('The before build cleaning started');

            if (!this.isPersistedOutputFileSystem && !this.options.forceCleanToDisk) {
                this.logger.debug(
                    `No persisted output file system: '${compiler.outputFileSystem.constructor.name}', skipping`
                );

                this.beforeRunCleaned = true;

                cb();

                return;
            }

            this.cleanTask(beforeBuildOptions, true, outputPath, workspaceRoot)
                .then(() => {
                    this.beforeRunCleaned = true;
                    const duration = Date.now() - startTime;

                    this.logger.debug(`The before build cleaning completed in [${duration}ms]`);

                    cb();

                    return;
                })
                .catch(cb);
        });

        compiler.hooks.afterEmit.tapAsync(this.name, (_, cb: (err?: Error) => void) => {
            const startTime = Date.now();

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

            if (!this.isPersistedOutputFileSystem && !this.options.forceCleanToDisk) {
                this.logger.debug(
                    `No persisted output file system: '${compiler.outputFileSystem.constructor.name}', skipping`
                );

                this.afterEmitCleaned = true;

                cb();

                return;
            }

            if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                throw new Error(
                    `[${this.name}] Absolute output path must be specified at webpack config -> output -> path.`
                );
            }

            this.logger.debug('The after emit cleaning started');

            this.cleanTask(afterEmitOptions, false, outputPath, workspaceRoot)
                .then(() => {
                    const duration = Date.now() - startTime;

                    this.logger.debug(`The after emit cleaning completed in [${duration}ms]`);
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

        if (!outputPath) {
            throw new Error("The 'outputPath' options is required.");
        }

        if (!path.isAbsolute(outputPath) || outputPath === '/' || isGlob(outputPath)) {
            throw new Error("The absolute path is required for 'outputPath' options.");
        }

        if (isSamePaths(path.parse(outputPath).root, outputPath)) {
            throw new Error(`The output path must not be the root directory, outputPath: ${outputPath}.`);
        }

        if (isSamePaths(workspaceRoot, outputPath)) {
            throw new Error(`The output path must not be the workspace root directory, outputPath: ${outputPath}.`);
        }

        if (isInFolder(outputPath, workspaceRoot)) {
            throw new Error(
                `The workspace root directory must not be inside the output path, outputPath: ${outputPath}.`
            );
        }

        if (isBeforeBuildClean && (cleanOptions as BeforeBuildCleanOptions).cleanOutDir) {
            if (!isInFolder(workspaceRoot, outputPath) && this.options.allowOutsideWorkspaceRoot === false) {
                throw new Error(
                    `Cleaning outside of the workspace root directory is disabled, outputPath: ${outputPath}.` +
                        " To enable cleaning, please set 'allowOutsideWorkspaceRoot = true' in clean option."
                );
            }

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

        if (cleanOptions.excludes) {
            cleanOptions.excludes.forEach((excludePath) => {
                if (isGlob(excludePath)) {
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
        } else {
            pathsToExclude.push(path.resolve(outputPath, '.gitkeep'));
        }

        if (pathsToExclude.length > 0) {
            await Promise.all(
                pathsToExclude.map(async (excludePath: string) => {
                    if (this.isPersistedOutputFileSystem || this.options.forceCleanToDisk) {
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
                    }
                })
            );
        }

        if (patternsToExclude.length > 0) {
            if (this.isPersistedOutputFileSystem || this.options.forceCleanToDisk) {
                await Promise.all(
                    patternsToExclude.map(async (excludePattern: string) => {
                        const foundExcludePaths = await globPromise(excludePattern, {
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
        }

        const pathsToClean: string[] = [];

        await Promise.all(
            rawPathsToClean.map(async (cleanPattern: string) => {
                if (!isGlob(cleanPattern)) {
                    const absolutePath = path.isAbsolute(cleanPattern)
                        ? path.resolve(cleanPattern)
                        : path.resolve(outputPath, cleanPattern);

                    if (!pathsToClean.includes(absolutePath)) {
                        pathsToClean.push(absolutePath);
                    }
                } else {
                    if (this.isPersistedOutputFileSystem || this.options.forceCleanToDisk) {
                        const foundPaths = await globPromise(cleanPattern, { cwd: outputPath, dot: true });
                        foundPaths.forEach((p) => {
                            const absolutePath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(outputPath, p);
                            if (!pathsToClean.includes(absolutePath)) {
                                pathsToClean.push(absolutePath);
                            }
                        });
                    }
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

            const relToOutDir = normalizeRelativePath(path.relative(outputPath, pathToClean));
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

                if (workspaceRoot && isInFolder(pathToClean, workspaceRoot)) {
                    throw new Error(
                        `The workspace root path must not be inside the path to be deleted, path: ${pathToClean}, context: ${workspaceRoot}.`
                    );
                }

                if (workspaceRoot && isSamePaths(pathToClean, workspaceRoot)) {
                    throw new Error(
                        `The path to be deleted must not be the same as workspace root path, path: ${outputPath}, context: ${workspaceRoot}.`
                    );
                }

                if (!isInFolder(workspaceRoot, pathToClean) && this.options.allowOutsideWorkspaceRoot === false) {
                    throw new Error(
                        `Cleaning outside of the workspace root directory is disabled, outputPath: ${pathToClean}.` +
                            " To enable cleaning, please set 'allowOutsideWorkspaceRoot = true' in clean option."
                    );
                }

                if (
                    (!isInFolder(outputPath, pathToClean) || isSamePaths(outputPath, pathToClean)) &&
                    !this.options.allowOutsideOutDir
                ) {
                    throw new Error(
                        `Cleaning outside of output directory is disabled, path to clean: ${pathToClean}.` +
                            " To enable cleaning, please set 'allowOutsideOutDir = true' in clean option."
                    );
                }
            }

            const relToWorkspace = normalizeRelativePath(path.relative(workspaceRoot, pathToClean));

            if (this.isPersistedOutputFileSystem || this.options.forceCleanToDisk) {
                const exists = await pathExists(pathToClean);
                if (exists) {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug(`Deleting ${relToWorkspace}`);
                    } else {
                        if (cleanOutDir) {
                            this.logger.info(`Deleting output directory ${relToWorkspace}`);
                        } else {
                            this.logger.debug(`Deleting ${relToWorkspace}`);
                        }
                    }

                    let retryDeleteCount = 0;
                    let retryDelete = false;

                    do {
                        try {
                            await remove(pathToClean);
                            retryDelete = false;
                        } catch (deleteError) {
                            retryDelete = true;
                            ++retryDeleteCount;
                            if (retryDeleteCount >= 3) {
                                throw deleteError;
                            }
                        }
                    } while (retryDelete && retryDeleteCount < 3);
                }
            }
        }
    }

    private prepareCleanOptions(options: CleanWebpackPluginOptions): CleanOptionsInternal {
        const projectBuildConfig = options.projectBuildConfig;
        const workspaceRoot = projectBuildConfig._workspaceRoot;
        let outputPath = projectBuildConfig._outputPath;
        if (projectBuildConfig._nestedPackage) {
            const nestedPackageStartIndex = projectBuildConfig._packageNameWithoutScope.indexOf('/') + 1;
            const nestedPackageSuffix = projectBuildConfig._packageNameWithoutScope.substr(nestedPackageStartIndex);
            outputPath = path.resolve(outputPath, nestedPackageSuffix);
        }

        const cleanConfigOptions = typeof projectBuildConfig.clean === 'object' ? projectBuildConfig.clean : {};

        const cleanOptions: CleanOptionsInternal = {
            ...cleanConfigOptions,
            workspaceRoot,
            outputPath,
            logLevel: options.logLevel
        };

        cleanOptions.beforeBuild = cleanOptions.beforeBuild || {};
        const beforeBuildOption = cleanOptions.beforeBuild;

        let skipCleanOutDir = false;

        if (projectBuildConfig._nestedPackage && beforeBuildOption.cleanOutDir) {
            skipCleanOutDir = true;
        }

        if (skipCleanOutDir) {
            beforeBuildOption.cleanOutDir = false;
        } else if (beforeBuildOption.cleanOutDir == null) {
            beforeBuildOption.cleanOutDir = true;
        }

        cleanOptions.beforeBuild = beforeBuildOption;

        return cleanOptions;
    }
}
