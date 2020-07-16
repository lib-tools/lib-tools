import * as path from 'path';

import * as spawn from 'cross-spawn';
import { pathExists, writeFile } from 'fs-extra';
import * as rollup from 'rollup';
import { ScriptTarget } from 'typescript';

import { getRollupConfig, minifyJsBundle } from '../../../helpers';
import { BuildActionInternal, ScriptCompilationOptionsInternal } from '../../../models/internals';
import { LoggerBase, globCopyFiles, normalizePath } from '../../../utils';

import { replaceVersion } from './replace-version';

let prevTsTranspilationVersionReplaced = false;

export async function performScriptCompilations(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
    if (!buildAction._script || !buildAction._script._compilations.length) {
        return;
    }

    const compilations = buildAction._script._compilations;

    let tscCommand = 'tsc';
    const nodeModulesPath = buildAction._nodeModulesPath;
    if (nodeModulesPath) {
        if (await pathExists(path.join(nodeModulesPath, '.bin/ngc'))) {
            tscCommand = path.join(nodeModulesPath, '.bin/ngc');
        } else if (await pathExists(path.join(nodeModulesPath, '.bin/tsc'))) {
            tscCommand = path.join(nodeModulesPath, '.bin/tsc');
        }
    }

    for (const compilation of compilations) {
        const tsConfigPath = compilation._tsConfigInfo.tsConfigPath;
        const compilerOptions = compilation._tsConfigInfo.tsCompilerConfig.options;

        const commandArgs: string[] = ['-p', tsConfigPath];
        const scriptTargetText = ScriptTarget[compilation._scriptTarget];

        if (compilation._customTsOutDir) {
            commandArgs.push('--outDir');
            commandArgs.push(compilation._customTsOutDir);
        }

        if (compilation._scriptTarget !== compilerOptions.target) {
            commandArgs.push('--target');
            commandArgs.push(scriptTargetText);
        }

        if (compilation._declaration !== compilerOptions.declaration) {
            commandArgs.push('--declaration');

            if (compilation._declaration === false) {
                commandArgs.push('false');
            }
        }

        logger.info(`Compiling with ${path.basename(tscCommand)}, target: ${scriptTargetText}`);

        await new Promise((res, rej) => {
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

            child.on('error', rej);
            child.on('exit', (exitCode: number) => {
                if (exitCode === 0) {
                    afterTsTranspileTask(compilation, buildAction, tscCommand, logger)
                        .then(() => {
                            res();
                        })
                        .catch((err) => {
                            rej(err);
                        });
                } else {
                    rej(new Error(errors.join('\n')));
                }
            });
        });
    }
}

async function afterTsTranspileTask(
    compilation: ScriptCompilationOptionsInternal,
    buildAction: BuildActionInternal,
    tscCommand: string,
    logger: LoggerBase
): Promise<void> {
    const outputRootDir = buildAction._outputPath;
    const tsConfigInfo = compilation._tsConfigInfo;

    // Replace version
    // TODO: To review
    logger.debug('Checking version placeholder');
    const hasVersionReplaced = await replaceVersion(
        compilation._tsOutDirRootResolved,
        buildAction._packageVersion,
        `${path.join(compilation._tsOutDirRootResolved, '**/version.js')}`,
        logger
    );
    if (hasVersionReplaced && !prevTsTranspilationVersionReplaced) {
        prevTsTranspilationVersionReplaced = true;
    }

    // Angular inline assets
    if (
        /ngc$/.test(tscCommand) &&
        tsConfigInfo.tsConfigJson.angularCompilerOptions &&
        tsConfigInfo.tsConfigJson.angularCompilerOptions.enableResourceInlining == null
    ) {
        let flatModuleOutFile = '';
        if (
            tsConfigInfo.tsConfigJson.angularCompilerOptions &&
            tsConfigInfo.tsConfigJson.angularCompilerOptions.flatModuleOutFile
        ) {
            flatModuleOutFile = tsConfigInfo.tsConfigJson.angularCompilerOptions.flatModuleOutFile;
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
            compilation._tsOutDirRootResolved,
            `${path.join(compilation._tsOutDirRootResolved, '**/*.js')}`,
            stylePreprocessorIncludePaths,
            compilation._declaration,
            flatModuleOutFile ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json') : null,
            logger
        );
    }

    // Move typings and metadata files
    if (compilation._declaration && buildAction._packageJsonOutDir !== compilation._tsOutDirRootResolved) {
        // Angular
        if (/ngc$/.test(tscCommand)) {
            logger.debug('Moving typing and metadata files to output root');

            await globCopyFiles(
                compilation._tsOutDirRootResolved,
                '**/*.+(d.ts|metadata.json)',
                buildAction._packageJsonOutDir,
                true
            );
        } else {
            logger.debug('Moving typing files to output root');

            await globCopyFiles(
                compilation._tsOutDirRootResolved,
                '**/*.+(d.ts)',
                buildAction._packageJsonOutDir,
                true
            );
        }
    }

    // Re-export
    // TODO: To review
    if (buildAction._nestedPackage && compilation._declaration) {
        let reExportName = compilation._entryName;
        if (buildAction._nestedPackage && buildAction._packageNameWithoutScope) {
            reExportName = buildAction._packageNameWithoutScope.substr(
                buildAction._packageNameWithoutScope.lastIndexOf('/') + 1
            );
        }

        const relPath = normalizePath(path.relative(outputRootDir, buildAction._packageJsonOutDir));

        // add banner to index
        const bannerContent = buildAction._bannerText ? `${buildAction._bannerText}\n` : '';

        logger.debug('Re-exporting typing files to output root');

        const reExportTypingsContent = `${bannerContent}export * from './${relPath}/${compilation._entryName}';\n`;
        const reEportTypingsOutFileAbs = path.resolve(outputRootDir, `${reExportName}.d.ts`);
        await writeFile(reEportTypingsOutFileAbs, reExportTypingsContent);

        // Angular
        if (/ngc$/.test(tscCommand)) {
            logger.debug('Re-exporting Angular metadata files to output root');
            const flatModuleId =
                tsConfigInfo.tsConfigJson.angularCompilerOptions &&
                tsConfigInfo.tsConfigJson.angularCompilerOptions.flatModuleId
                    ? tsConfigInfo.tsConfigJson.angularCompilerOptions.flatModuleId
                    : buildAction._packageName;

            const metadataJson = {
                __symbolic: 'module',
                version: 3,
                metadata: {},
                exports: [{ from: `./${relPath}/${compilation._entryName}` }],
                flatModuleIndexRedirect: true,
                importAs: flatModuleId
            };

            const reEportMetaDataFileAbs = reEportTypingsOutFileAbs.replace(/\.d\.ts$/i, '.metadata.json');
            await writeFile(reEportMetaDataFileAbs, JSON.stringify(metadataJson, null, 2));
        }
    }

    // Bundle
    if (compilation._bundles.length > 0) {
        for (const bundleOptions of compilation._bundles) {
            const scriptTargetText = ScriptTarget[compilation._scriptTarget];
            const rollupOptions = getRollupConfig(bundleOptions, buildAction, logger);

            logger.info(
                `Bundling with rollup, format: ${rollupOptions.outputOptions.format} and script target: ${scriptTargetText}`
            );

            const rollupBuild = await rollup.rollup(rollupOptions.inputOptions);
            await rollupBuild.write(rollupOptions.outputOptions);

            if (bundleOptions.minify) {
                const minFilePath = bundleOptions._outputFilePath.replace(/\.js$/i, '.min.js');

                logger.info(`Writing minify file ${path.basename(minFilePath)}`);

                await minifyJsBundle(bundleOptions._outputFilePath, minFilePath, bundleOptions.sourceMap, logger);
            }
        }
    }
}
