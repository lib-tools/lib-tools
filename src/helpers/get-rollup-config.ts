import * as rollup from 'rollup';
import { ScriptTarget } from 'typescript';

import { BuildConfigInternal, ScriptBundleOptionsInternal, ScriptOptionsInternal } from '../models';
import { LoggerBase } from '../utils';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { RollupCommonJSOptions } from '@rollup/plugin-commonjs';
import { RPT2Options } from 'rollup-plugin-typescript2';

import { getUmdGlobalVariable } from './umd-ids';

export function getRollupConfig(
    bundleOptions: ScriptBundleOptionsInternal,
    scriptOptions: ScriptOptionsInternal,
    buildConfig: BuildConfigInternal,
    logger: LoggerBase
): {
    inputOptions: rollup.InputOptions;
    outputOptions: rollup.OutputOptions;
} {
    // plugins
    const plugins: rollup.Plugin[] = [];

    if (bundleOptions.moduleFormat === 'umd' || bundleOptions.moduleFormat === 'cjs' || bundleOptions.commonjs) {
        // Must be before rollup-plugin-typescript2 in the plugin list, especially when browser: true option is used,
        // see https://github.com/ezolenko/rollup-plugin-typescript2/issues/66
        plugins.push(nodeResolve());
    }

    if (/\.ts$/i.test(bundleOptions._entryFilePath) && scriptOptions._tsConfigInfo) {
        const tsConfigInfo = scriptOptions._tsConfigInfo;
        const tsConfigPath = tsConfigInfo.tsConfigPath;
        const scriptTarget = tsConfigInfo.tsCompilerConfig.options.target;

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const typescriptPlugin = require('rollup-plugin-typescript2') as (options: RPT2Options) => rollup.Plugin;

        const typescriptModulePath = scriptOptions._projectTypescriptModulePath
            ? scriptOptions._projectTypescriptModulePath
            : 'typescript';

        const rptOptions: RPT2Options = {
            tsconfig: tsConfigPath,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            typescript: require(typescriptModulePath)
        };

        if (
            (bundleOptions.moduleFormat === 'umd' || bundleOptions.moduleFormat === 'cjs') &&
            (!scriptTarget || scriptTarget > ScriptTarget.ES5)
        ) {
            rptOptions.tsconfigOverride = {
                compilerOptions: {
                    target: 'ES5'
                }
            };
        }

        plugins.push(typescriptPlugin(rptOptions));
    }

    if (bundleOptions.commonjs) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const commonjsPlugin = require('@rollup/plugin-commonjs') as (options: RollupCommonJSOptions) => rollup.Plugin;

        const customOptions = typeof bundleOptions.commonjs === 'object' ? bundleOptions.commonjs : {};
        const commonjsOption: RollupCommonJSOptions = {
            extensions: ['.js', '.ts'],
            sourceMap: bundleOptions.sourceMap,
            ...customOptions
        };

        plugins.push(commonjsPlugin(commonjsOption));
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
        exports: scriptOptions.exports,
        name: bundleOptions._umdId,
        amd: { id: buildConfig._packageName },
        format: bundleOptions.moduleFormat,
        globals: (moduleid) => getUmdGlobalVariable(moduleid, globals),
        sourcemap: bundleOptions.sourceMap
    };

    if (buildConfig._bannerText) {
        outputOptions.banner = buildConfig._bannerText;
    }

    return {
        inputOptions,
        outputOptions
    };
}
