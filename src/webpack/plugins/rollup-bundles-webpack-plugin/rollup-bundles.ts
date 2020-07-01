import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as rollup from 'rollup';
import { ScriptTarget } from 'typescript';

import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

import { getRollupConfig } from './get-rollup-config';
import { minifyJsFile } from './minify-js-file';

export async function performRollupBundles(
    projectBuildConfig: ProjectBuildConfigInternal,
    logger: LoggerBase
): Promise<void> {
    if (!projectBuildConfig._bundles || !projectBuildConfig._bundles.length) {
        return;
    }

    const bundles = projectBuildConfig._bundles;

    const projectName = projectBuildConfig._projectName;
    for (const currentBundle of bundles) {
        const entryFilePath = currentBundle._entryFilePath;
        const entryFileExists = await pathExists(entryFilePath);

        if (!entryFileExists) {
            throw new Error(
                `The entry file path: ${entryFilePath} doesn't exist. Please correct value in 'projects[${projectName}].bundles[${currentBundle._index}].entry'.`
            );
        }

        // main bundling
        const rollupOptions = getRollupConfig(projectBuildConfig, currentBundle, logger);

        let scriptTargetText = '';
        if (currentBundle._destScriptTarget) {
            scriptTargetText = `-${ScriptTarget[currentBundle._destScriptTarget].toLocaleLowerCase()}`;
        }

        logger.info(`Bundling to ${currentBundle.libraryTarget}${scriptTargetText} format with rollup`);

        const bundle = await rollup.rollup(rollupOptions.inputOptions);
        await bundle.write(rollupOptions.outputOptions);

        // Remapping sourcemaps
        // const shouldReMapSourceMap = projectBuildConfig.sourceMap && !/\.tsx?$/i.test(entryFilePath);
        // (path.dirname(entryFilePath) !== srcDir)
        // if (shouldReMapSourceMap) {
        //     const chain = await sorcery.load(currentBundle._outputFilePath);
        //     await chain.write();
        // }

        // minify umd files
        if (currentBundle.minify || (currentBundle.minify !== false && currentBundle.libraryTarget === 'umd')) {
            const minFilePath = currentBundle._outputFilePath.replace(/\.js$/i, '.min.js');
            logger.debug(`Minifying ${path.basename(currentBundle._outputFilePath)}`);

            await minifyJsFile(
                currentBundle._outputFilePath,
                minFilePath,
                projectBuildConfig.sourceMap as boolean,
                // buildOptions.logLevel === 'debug',
                logger
            );

            // Remapping sourcemaps
            // if (projectBuildConfig.sourceMap) {
            //     const chain = await sorcery.load(currentBundle._outputFilePath);
            //     await chain.write();
            // }
        }
    }
}
