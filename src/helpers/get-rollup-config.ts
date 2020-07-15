import * as rollup from 'rollup';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

import { BuildActionInternal, ScriptBundleOptionsInternal } from '../models/internals';
import { LoggerBase } from '../utils';

export function getRollupConfig(
    bundleOptions: ScriptBundleOptionsInternal,
    buildAction: BuildActionInternal,
    logger: LoggerBase
): {
    inputOptions: rollup.InputOptions;
    outputOptions: rollup.OutputOptions;
} {
    const scriptOptions = buildAction.script || {};
    let moduleName = scriptOptions.moduleName;
    if (!moduleName && buildAction._packageName) {
        if (buildAction._packageName.startsWith('@')) {
            moduleName = buildAction._packageName.substring(1).split('/').join('.');
        } else {
            moduleName = buildAction._packageName.split('/').join('.');
        }
        moduleName = moduleName.replace(/-([a-z])/g, (_, g1) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return g1 ? g1.toUpperCase() : '';
        });
    }

    // plugins
    const plugins: rollup.Plugin[] = [];
    if (bundleOptions.moduleFormat === 'umd' || bundleOptions.moduleFormat === 'cjs' || bundleOptions.commonjs) {
        plugins.push(resolve());
    }

    if (bundleOptions.commonjs) {
        const commonjsOption = {
            ...bundleOptions.commonjs,
            extensions: ['.js'],
            sourceMap: bundleOptions.sourceMap
        };

        plugins.push(commonjs(commonjsOption));
    }

    const externals = bundleOptions._externals;
    const globals = bundleOptions._globals;

    const inputOptions: rollup.InputOptions = {
        input: bundleOptions._entryFilePath,
        // preserveSymlinks: preserveSymlinks,
        external: (id: string): boolean => {
            return externals.some((dep) => id === dep || id.startsWith(`${dep}/`));
        },
        plugins,
        onwarn(warning: string | rollup.RollupWarning): void {
            if (typeof warning === 'string') {
                logger.warn(warning);

                return;
            }

            // Skip certain warnings
            // should intercept ... but doesn't in some rollup versions
            if (!warning.message || warning.code === 'THIS_IS_UNDEFINED') {
                return;
            }

            logger.warn(warning.message);
        }
    };

    const outputOptions: rollup.OutputOptions = {
        file: bundleOptions._outputFilePath,
        exports: 'named',
        name: moduleName,
        amd: { id: buildAction._packageName },
        format: bundleOptions.moduleFormat,
        globals,
        sourcemap: bundleOptions.sourceMap
    };

    if (buildAction._bannerText) {
        outputOptions.banner = buildAction._bannerText;
    }

    return {
        inputOptions,
        outputOptions
    };
}
