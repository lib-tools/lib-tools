import * as path from 'path';

import * as spawn from 'cross-spawn';
import { writeFile } from 'fs-extra';
import { ScriptTarget } from 'typescript';

import { InternalError, TypescriptCompileError } from '../models/errors';
import { ProjectConfigBuildInternal, TsTranspilationOptionsInternal } from '../models/internals';
import { LoggerBase, globCopyFiles, normalizeRelativePath } from '../utils';

import { replaceVersion } from './replace-version';

export async function preformTsTranspilations(
    projectConfig: ProjectConfigBuildInternal,
    logger: LoggerBase
): Promise<void> {
    if (!projectConfig._tsTranspilations || !projectConfig._tsTranspilations.length) {
        return;
    }

    for (const tsTranspilation of projectConfig._tsTranspilations) {
        const tsConfigPath = tsTranspilation._tsConfigPath;
        if (!tsTranspilation._tsCompilerConfig) {
            throw new InternalError("The 'tsTranspilation._tsCompilerConfig' is not set.");
        }
        const compilerOptions = tsTranspilation._tsCompilerConfig.options;

        const commandArgs: string[] = ['-p', tsConfigPath];

        if (tsTranspilation._customTsOutDir) {
            commandArgs.push('--outDir');
            commandArgs.push(tsTranspilation._customTsOutDir);
        }

        if (tsTranspilation.target) {
            commandArgs.push('--target');
            commandArgs.push(tsTranspilation.target);
        } else if (tsTranspilation._scriptTarget && !compilerOptions.target) {
            commandArgs.push('--target');
            commandArgs.push(ScriptTarget[tsTranspilation._scriptTarget]);
        }

        if (tsTranspilation._declaration !== compilerOptions.declaration) {
            commandArgs.push('--declaration');

            if (tsTranspilation._declaration === false) {
                commandArgs.push('false');
            }
        }

        let scriptTargetText: string;
        if (tsTranspilation.target) {
            scriptTargetText = tsTranspilation.target.toUpperCase();
        } else {
            scriptTargetText = ScriptTarget[tsTranspilation._scriptTarget];
        }

        logger.info(`Compiling typescript with ngc, target: ${scriptTargetText}`);

        const nodeModulesPath = projectConfig._nodeModulesPath;
        await new Promise((resolve, reject) => {
            const errors: string[] = [];
            const commandPath = nodeModulesPath ? path.join(nodeModulesPath, '.bin/ngc') : 'ngc';
            const child = spawn(commandPath, commandArgs, {});
            if (child.stdout) {
                child.stdout.on('data', (data: string | Buffer) => {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    logger.debug(`${data}`);
                });
            }

            if (child.stderr) {
                child.stderr.on('data', (data: string | Buffer) => errors.push(data.toString().trim()));
            }

            child.on('error', reject);
            child.on('exit', (exitCode: number) => {
                if (exitCode === 0) {
                    afterTsTranspileTask(tsTranspilation, projectConfig, logger)
                        .then(() => {
                            resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                } else {
                    reject(new TypescriptCompileError(errors.join('\n')));
                }
            });
        });
    }
}

async function afterTsTranspileTask(
    tsTranspilation: TsTranspilationOptionsInternal,
    projectConfig: ProjectConfigBuildInternal,
    logger: LoggerBase
): Promise<void> {
    if (!projectConfig._projectRoot) {
        throw new InternalError("The 'projectConfig._projectRoot' is not set.");
    }
    if (!projectConfig._outputPath) {
        throw new InternalError("The 'projectConfig._outputPath' is not set.");
    }

    // const projectRoot = projectConfig._projectRoot;
    const outputRootDir = projectConfig._outputPath;

    // const stylePreprocessorOptions = projectConfig.stylePreprocessorOptions;
    // const flatModuleOutFile =
    //     tsTranspilation._angularCompilerOptions && tsTranspilation._angularCompilerOptions.flatModuleOutFile
    //         ? (tsTranspilation._angularCompilerOptions.flatModuleOutFile as string)
    //         : '';

    // Replace version
    if (
        projectConfig.replaceVersionPlaceholder !== false &&
        projectConfig._packageVersion &&
        (tsTranspilation._index === 0 ||
            (tsTranspilation._index > 0 && projectConfig._prevTsTranspilationVersionReplaced))
    ) {
        logger.debug('Checking version placeholder');

        const hasVersionReplaced = await replaceVersion(
            tsTranspilation._tsOutDirRootResolved,
            projectConfig._packageVersion,
            `${path.join(tsTranspilation._tsOutDirRootResolved, '**/version.js')}`,
            logger
        );
        if (hasVersionReplaced && !projectConfig._prevTsTranspilationVersionReplaced) {
            projectConfig._prevTsTranspilationVersionReplaced = true;
        }
    }

    // Inline assets
    // let inlineAssets = true;
    // if (
    //     tsTranspilation._angularCompilerOptions &&
    //     tsTranspilation._angularCompilerOptions.enableResourceInlining != null
    // ) {
    //     inlineAssets = false;
    // }

    // if (
    //     inlineAssets &&
    //     tsTranspilation.enableResourceInlining !== false &&
    //     (tsTranspilation._index === 0 || (tsTranspilation._index > 0 && projectConfig._prevTsTranspilationResourcesInlined))
    // ) {
    //     logger.debug('Checking resources to be inlined');

    //     let stylePreprocessorIncludePaths: string[] = [];
    //     if (stylePreprocessorOptions && stylePreprocessorOptions.includePaths) {
    //         stylePreprocessorIncludePaths = stylePreprocessorOptions.includePaths.map((p) =>
    //             path.resolve(projectRoot, p)
    //         );
    //     }

    //     const resourcesInlined = await processNgResources(
    //         projectRoot,
    //         tsTranspilation._tsOutDirRootResolved,
    //         `${path.join(tsTranspilation._tsOutDirRootResolved, '**/*.js')}`,
    //         stylePreprocessorIncludePaths,
    //         tsTranspilation._declaration,
    //         flatModuleOutFile ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json') : null,
    //         logger
    //     );

    //     if (tsTranspilation._index === 0) {
    //         projectConfig._prevTsTranspilationResourcesInlined = resourcesInlined;
    //     }
    // }

    // Move typings and metadata files
    if (
        tsTranspilation._declaration &&
        tsTranspilation._typingsOutDir &&
        tsTranspilation._typingsOutDir !== tsTranspilation._tsOutDirRootResolved
    ) {
        logger.debug('Moving typing and metadata files to output root');

        await globCopyFiles(
            tsTranspilation._tsOutDirRootResolved,
            '**/*.+(d.ts|metadata.json)',
            tsTranspilation._typingsOutDir,
            true
        );
    }

    // Re-export
    if (
        projectConfig._nestedPackage &&
        tsTranspilation._declaration &&
        tsTranspilation._typingsOutDir &&
        tsTranspilation._detectedEntryName
    ) {
        let reExportName = tsTranspilation._detectedEntryName;
        if (projectConfig._nestedPackage && projectConfig._packageNameWithoutScope) {
            reExportName = projectConfig._packageNameWithoutScope.substr(
                projectConfig._packageNameWithoutScope.lastIndexOf('/') + 1
            );
        }

        const relPath = normalizeRelativePath(path.relative(outputRootDir, tsTranspilation._typingsOutDir));

        // add banner to index
        const bannerContent = projectConfig._bannerText ? `${projectConfig._bannerText}\n` : '';

        logger.debug('Re-exporting typing and metadata entry files to output root');

        const reExportTypingsContent = `${bannerContent}export * from './${relPath}/${tsTranspilation._detectedEntryName}';\n`;
        const reEportTypingsOutFileAbs = path.resolve(outputRootDir, `${reExportName}.d.ts`);
        await writeFile(reEportTypingsOutFileAbs, reExportTypingsContent);

        // const flatModuleId =
        //     tsTranspilation._angularCompilerOptions && tsTranspilation._angularCompilerOptions.flatModuleId
        //         ? tsTranspilation._angularCompilerOptions.flatModuleId
        //         : projectConfig._packageName;

        // const metadataJson = {
        //     __symbolic: 'module',
        //     version: 3,
        //     metadata: {},
        //     exports: [{ from: `./${relPath}/${tsTranspilation._detectedEntryName}` }],
        //     flatModuleIndexRedirect: true,
        //     importAs: flatModuleId
        // };

        // const reEportMetaDataFileAbs = reEportTypingsOutFileAbs.replace(/\.d\.ts$/i, '.metadata.json');
        // await writeFile(reEportMetaDataFileAbs, JSON.stringify(metadataJson, null, 2));
    }
}
