import * as path from 'path';

import * as rollup from 'rollup';

import { getRollupConfig, minifyESBundle } from '../../../helpers';
import { BuildActionInternal } from '../../..//models/internals';
import { LoggerBase } from '../../../utils';

export async function performScriptBundles(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
    if (!buildAction._script || !buildAction._script._bundles.length) {
        return;
    }

    for (const bundleOptions of buildAction._script._bundles) {
        const rollupOptions = getRollupConfig(bundleOptions, buildAction._script, buildAction, logger);

        logger.info(`Bundling with rollup, format: ${rollupOptions.outputOptions.format}`);

        const rollupBuild = await rollup.rollup(rollupOptions.inputOptions);
        await rollupBuild.write(rollupOptions.outputOptions);

        if (bundleOptions.minify) {
            const minFilePath = bundleOptions._outputFilePath.replace(/\.js$/i, '.min.js');

            logger.info(`Writing minify file ${path.basename(minFilePath)}`);

            await minifyESBundle(
                bundleOptions._outputFilePath,
                minFilePath,
                bundleOptions.sourceMap,
                bundleOptions._ecma,
                logger
            );
        }
    }
}
