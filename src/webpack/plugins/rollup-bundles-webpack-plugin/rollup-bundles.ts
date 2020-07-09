/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as rollup from 'rollup';
import { ScriptTarget } from 'typescript';

import { BuildActionInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

import { getRollupConfig } from './get-rollup-config';
import { minifyJsFile } from './minify-js-file';

export async function performRollupBundles(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
    if (!buildAction._scriptBundleEntries || !buildAction._scriptBundleEntries.length) {
        return;
    }

    const bundles = buildAction._scriptBundleEntries;
    const bundleOptions = typeof buildAction.scriptBundle === 'object' ? buildAction.scriptBundle : {};

    const projectName = buildAction._projectName;
    for (const currentBundle of bundles) {
        const entryFilePath = currentBundle._entryFilePath;
        const entryFileExists = await pathExists(entryFilePath);

        if (!entryFileExists) {
            throw new Error(
                `The entry file path: ${entryFilePath} doesn't exist. Please correct value in 'projects[${projectName}].bundles[${currentBundle._index}].entry'.`
            );
        }

        // main bundling
        const rollupOptions = getRollupConfig(buildAction, currentBundle, logger);

        let scriptTargetText = '';
        if (currentBundle._destScriptTarget) {
            scriptTargetText = `-${ScriptTarget[currentBundle._destScriptTarget].toLocaleLowerCase()}`;
        }

        logger.info(`Bundling to ${currentBundle.libraryTarget}${scriptTargetText} format with rollup`);

        const bundle = await rollup.rollup(rollupOptions.inputOptions);
        await bundle.write(rollupOptions.outputOptions);

        // Remapping sourcemaps
        // const shouldReMapSourceMap = buildAction.sourceMap && !/\.tsx?$/i.test(entryFilePath);
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
                bundleOptions.sourceMap as boolean,
                // buildOptions.logLevel === 'debug',
                logger
            );

            // Remapping sourcemaps
            // if (buildAction.sourceMap) {
            //     const chain = await sorcery.load(currentBundle._outputFilePath);
            //     await chain.write();
            // }
        }
    }
}
