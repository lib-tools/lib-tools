import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as rollup from 'rollup';
import { ScriptTarget } from 'typescript';

import { InvalidConfigError } from '../models/errors';
import { ProjectConfigBuildInternal } from '../models/internals';
import { LoggerBase } from '../utils';

import { getRollupConfig } from './get-rollup-config';
import { minifyJsFile } from './minify-js-file';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
const sorcery = require('sorcery');

export async function performBundles(projectConfig: ProjectConfigBuildInternal, logger: LoggerBase): Promise<void> {
    if (!projectConfig._bundles || !projectConfig._bundles.length) {
        return;
    }

    const bundles = projectConfig._bundles;

    for (const currentBundle of bundles) {
        const entryFilePath = currentBundle._entryFilePath;
        const entryFileExists = await pathExists(entryFilePath);

        if (!entryFileExists) {
            throw new InvalidConfigError(
                `The entry file path: ${entryFilePath} doesn't exist. Please correct value in 'projects[${projectConfig._index}].bundles[${currentBundle._index}].entry'.`
            );
        }

        // path.dirname(entryFilePath) !== srcDir
        const shouldReMapSourceMap = projectConfig.sourceMap && !/\.tsx?$/i.test(entryFilePath);

        // main bundling
        const rollupOptions = getRollupConfig(projectConfig, currentBundle, logger);

        let scriptTargetText = '';
        if (currentBundle._destScriptTarget) {
            scriptTargetText = `-${ScriptTarget[currentBundle._destScriptTarget].toLocaleLowerCase()}`;
        }

        logger.info(`Bundling to ${currentBundle.libraryTarget}${scriptTargetText} format with rollup`);

        const bundle = await rollup.rollup(rollupOptions.inputOptions);
        await bundle.write(rollupOptions.outputOptions);

        // Remapping sourcemaps
        if (shouldReMapSourceMap) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call,  @typescript-eslint/no-unsafe-member-access
            const chain = await sorcery.load(currentBundle._outputFilePath);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await chain.write();
        }

        // minify umd files
        if (currentBundle.minify || (currentBundle.minify !== false && currentBundle.libraryTarget === 'umd')) {
            const minFilePath = currentBundle._outputFilePath.replace(/\.js$/i, '.min.js');
            logger.debug(`Minifying ${path.basename(currentBundle._outputFilePath)}`);

            await minifyJsFile(
                currentBundle._outputFilePath,
                minFilePath,
                projectConfig.sourceMap as boolean,
                // buildOptions.logLevel === 'debug',
                logger
            );

            // Remapping sourcemaps
            if (projectConfig.sourceMap) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call,  @typescript-eslint/no-unsafe-member-access
                const chain = await sorcery.load(currentBundle._outputFilePath);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                await chain.write();
            }
        }
    }
}
