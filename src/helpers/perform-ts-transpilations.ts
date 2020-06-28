import * as path from 'path';

import * as spawn from 'cross-spawn';
import { pathExists, writeFile } from 'fs-extra';
import { ScriptTarget } from 'typescript';

import { TypescriptCompileError } from '../models/errors';
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

    let tsc = 'tsc';
    const nodeModulesPath = projectConfig._nodeModulesPath;
    if (nodeModulesPath) {
        if (await pathExists(path.join(nodeModulesPath, '.bin/ngc'))) {
            tsc = path.join(nodeModulesPath, '.bin/ngc');
        } else if (await pathExists(path.join(nodeModulesPath, '.bin/tsc'))) {
            tsc = path.join(nodeModulesPath, '.bin/tsc');
        }
    }

    for (const tsTranspilation of projectConfig._tsTranspilations) {
        const tsConfigPath = tsTranspilation._tsConfigPath;
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

        logger.info(`Compiling typescript files, target: ${scriptTargetText}`);

        await new Promise((resolve, reject) => {
            const errors: string[] = [];
            const child = spawn(tsc, commandArgs, {});
            if (child.stdout) {
                child.stdout.on('data', (data: string | Buffer) => {
                    logger.debug(`${data}`);
                });
            }

            if (child.stderr) {
                child.stderr.on('data', (data: string | Buffer) => errors.push(data.toString().trim()));
            }

            child.on('error', reject);
            child.on('exit', (exitCode: number) => {
                if (exitCode === 0) {
                    afterTsTranspileTask(tsTranspilation, projectConfig, tsc, logger)
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
    tsc: string,
    logger: LoggerBase
): Promise<void> {
    const outputRootDir = projectConfig._outputPath;

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

    // Angular inline assets
    if (
        /ngc$/.test(tsc) &&
        tsTranspilation._tsConfigJson.angularCompilerOptions &&
        tsTranspilation._tsConfigJson.angularCompilerOptions.enableResourceInlining
    ) {
        const stylePreprocessorOptions = projectConfig.stylePreprocessorOptions;
        let flatModuleOutFile = '';
        if (
            /ngc$/.test(tsc) &&
            tsTranspilation._tsConfigJson.angularCompilerOptions &&
            tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleOutFile
        ) {
            flatModuleOutFile = tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleOutFile;
        }

        let stylePreprocessorIncludePaths: string[] = [];
        if (stylePreprocessorOptions && stylePreprocessorOptions.includePaths) {
            stylePreprocessorIncludePaths = stylePreprocessorOptions.includePaths.map((p) =>
                path.resolve(projectConfig._projectRoot, p)
            );
        }

        logger.debug('Checking resources to be inlined');

        await processNgResources(
            projectConfig._projectRoot,
            tsTranspilation._tsOutDirRootResolved,
            `${path.join(tsTranspilation._tsOutDirRootResolved, '**/*.js')}`,
            stylePreprocessorIncludePaths,
            tsTranspilation._declaration,
            flatModuleOutFile ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json') : null,
            logger
        );
    }

    // Move typings and metadata files
    if (
        tsTranspilation._declaration &&
        tsTranspilation._typingsOutDir &&
        tsTranspilation._typingsOutDir !== tsTranspilation._tsOutDirRootResolved
    ) {
        // Angular
        if (/ngc$/.test(tsc)) {
            logger.debug('Moving typing and metadata files to output root');

            await globCopyFiles(
                tsTranspilation._tsOutDirRootResolved,
                '**/*.+(d.ts|metadata.json)',
                tsTranspilation._typingsOutDir,
                true
            );
        } else {
            logger.debug('Moving typing files to output root');

            await globCopyFiles(
                tsTranspilation._tsOutDirRootResolved,
                '**/*.+(d.ts)',
                tsTranspilation._typingsOutDir,
                true
            );
        }
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

        logger.debug('Re-exporting typing files to output root');

        const reExportTypingsContent = `${bannerContent}export * from './${relPath}/${tsTranspilation._detectedEntryName}';\n`;
        const reEportTypingsOutFileAbs = path.resolve(outputRootDir, `${reExportName}.d.ts`);
        await writeFile(reEportTypingsOutFileAbs, reExportTypingsContent);

        // Angular
        if (/ngc$/.test(tsc)) {
            logger.debug('Re-exporting Angular metadata files to output root');
            const flatModuleId =
                tsTranspilation._tsConfigJson.angularCompilerOptions &&
                tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleId
                    ? tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleId
                    : projectConfig._packageName;

            const metadataJson = {
                __symbolic: 'module',
                version: 3,
                metadata: {},
                exports: [{ from: `./${relPath}/${tsTranspilation._detectedEntryName}` }],
                flatModuleIndexRedirect: true,
                importAs: flatModuleId
            };

            const reEportMetaDataFileAbs = reEportTypingsOutFileAbs.replace(/\.d\.ts$/i, '.metadata.json');
            await writeFile(reEportMetaDataFileAbs, JSON.stringify(metadataJson, null, 2));
        }
    }
}
