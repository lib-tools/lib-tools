import * as path from 'path';

import * as rollup from 'rollup';

import { getRollupConfig, minifyJsBundle } from '../../../helpers';
import { BuildActionInternal } from '../../..//models/internals';
import { LoggerBase } from '../../../utils';

export async function performScriptBundles(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
    if (!buildAction._script || !buildAction._script._bundles.length) {
        return;
    }

    const scriptOptions = buildAction.script || {};
    const sourceMap = scriptOptions.sourceMap !== false ? true : false;

    for (const bundleOptions of buildAction._script._bundles) {
        const rollupOptions = getRollupConfig(bundleOptions, buildAction, logger);

        logger.info(`Bundling to ${rollupOptions.outputOptions.format} format with rollup`);

        const rollupBuild = await rollup.rollup(rollupOptions.inputOptions);
        await rollupBuild.write(rollupOptions.outputOptions);

        if (bundleOptions.minify) {
            const minFilePath = bundleOptions._outputFilePath.replace(/\.js$/i, '.min.js');

            logger.debug(`Minifying ${path.basename(bundleOptions._outputFilePath)}`);

            await minifyJsBundle(bundleOptions._outputFilePath, minFilePath, sourceMap, logger);
        }
    }
}