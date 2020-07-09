/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import * as spawn from 'cross-spawn';
import { pathExists, writeFile } from 'fs-extra';
import { ScriptTarget } from 'typescript';

import { BuildActionInternal, ScriptTranspilationEntryInternal } from '../../../models/internals';
import { LoggerBase, globCopyFiles, normalizePath } from '../../../utils';

import { replaceVersion } from './replace-version';

let prevTsTranspilationVersionReplaced = false;

export async function preformTsTranspilations(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
    if (!buildAction._scriptTranspilationEntries.length) {
        return;
    }

    let tscCommand = 'tsc';
    const nodeModulesPath = buildAction._nodeModulesPath;
    if (nodeModulesPath) {
        if (await pathExists(path.join(nodeModulesPath, '.bin/ngc'))) {
            tscCommand = path.join(nodeModulesPath, '.bin/ngc');
        } else if (await pathExists(path.join(nodeModulesPath, '.bin/tsc'))) {
            tscCommand = path.join(nodeModulesPath, '.bin/tsc');
        }
    }

    for (const tsTranspilation of buildAction._scriptTranspilationEntries) {
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
            const child = spawn(tscCommand, commandArgs, {});
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
                    afterTsTranspileTask(tsTranspilation, buildAction, tscCommand, logger)
                        .then(() => {
                            resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                } else {
                    reject(new Error(errors.join('\n')));
                }
            });
        });
    }
}

async function afterTsTranspileTask(
    tsTranspilation: ScriptTranspilationEntryInternal,
    buildAction: BuildActionInternal,
    tscCommand: string,
    logger: LoggerBase
): Promise<void> {
    const outputRootDir = buildAction._outputPath;

    // Replace version
    if (
        buildAction._packageVersion &&
        (tsTranspilation._index === 0 || (tsTranspilation._index > 0 && prevTsTranspilationVersionReplaced))
    ) {
        logger.debug('Checking version placeholder');

        const hasVersionReplaced = await replaceVersion(
            tsTranspilation._tsOutDirRootResolved,
            buildAction._packageVersion,
            `${path.join(tsTranspilation._tsOutDirRootResolved, '**/version.js')}`,
            logger
        );
        if (hasVersionReplaced && !prevTsTranspilationVersionReplaced) {
            prevTsTranspilationVersionReplaced = true;
        }
    }

    // Angular inline assets
    if (
        /ngc$/.test(tscCommand) &&
        tsTranspilation._tsConfigJson.angularCompilerOptions &&
        tsTranspilation._tsConfigJson.angularCompilerOptions.enableResourceInlining == null
    ) {
        let flatModuleOutFile = '';
        if (
            tsTranspilation._tsConfigJson.angularCompilerOptions &&
            tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleOutFile
        ) {
            flatModuleOutFile = tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleOutFile;
        }

        let stylePreprocessorIncludePaths: string[] = [];
        if (buildAction.style && buildAction.style.includePaths) {
            stylePreprocessorIncludePaths = buildAction.style.includePaths.map((p) =>
                path.resolve(buildAction._projectRoot, p)
            );
        }

        logger.debug('Processing Angular resources to be inlined');

        const inlineResourcesModule = await import('./ng-resource-inlining/inline-resources');

        await inlineResourcesModule.inlineResources(
            buildAction._projectRoot,
            tsTranspilation._tsOutDirRootResolved,
            `${path.join(tsTranspilation._tsOutDirRootResolved, '**/*.js')}`,
            stylePreprocessorIncludePaths,
            tsTranspilation._declaration,
            flatModuleOutFile ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json') : null,
            logger
        );
    }

    // Move typings and metadata files
    if (tsTranspilation._declaration && buildAction._packageJsonOutDir !== tsTranspilation._tsOutDirRootResolved) {
        // Angular
        if (/ngc$/.test(tscCommand)) {
            logger.debug('Moving typing and metadata files to output root');

            await globCopyFiles(
                tsTranspilation._tsOutDirRootResolved,
                '**/*.+(d.ts|metadata.json)',
                buildAction._packageJsonOutDir,
                true
            );
        } else {
            logger.debug('Moving typing files to output root');

            await globCopyFiles(
                tsTranspilation._tsOutDirRootResolved,
                '**/*.+(d.ts)',
                buildAction._packageJsonOutDir,
                true
            );
        }
    }

    // Re-export
    if (buildAction._nestedPackage && tsTranspilation._declaration && tsTranspilation._detectedEntryName) {
        let reExportName = tsTranspilation._detectedEntryName;
        if (buildAction._nestedPackage && buildAction._packageNameWithoutScope) {
            reExportName = buildAction._packageNameWithoutScope.substr(
                buildAction._packageNameWithoutScope.lastIndexOf('/') + 1
            );
        }

        const relPath = normalizePath(path.relative(outputRootDir, buildAction._packageJsonOutDir));

        // add banner to index
        const bannerContent = buildAction._bannerText ? `${buildAction._bannerText}\n` : '';

        logger.debug('Re-exporting typing files to output root');

        const reExportTypingsContent = `${bannerContent}export * from './${relPath}/${tsTranspilation._detectedEntryName}';\n`;
        const reEportTypingsOutFileAbs = path.resolve(outputRootDir, `${reExportName}.d.ts`);
        await writeFile(reEportTypingsOutFileAbs, reExportTypingsContent);

        // Angular
        if (/ngc$/.test(tscCommand)) {
            logger.debug('Re-exporting Angular metadata files to output root');
            const flatModuleId =
                tsTranspilation._tsConfigJson.angularCompilerOptions &&
                tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleId
                    ? tsTranspilation._tsConfigJson.angularCompilerOptions.flatModuleId
                    : buildAction._packageName;

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
