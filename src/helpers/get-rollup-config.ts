import * as rollup from 'rollup';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

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
    let moduleName: string | undefined;
    if (buildAction._script && buildAction._script.moduleName) {
        moduleName = buildAction._script.moduleName;
    } else {
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

    if (/\.ts$/i.test(bundleOptions._entryFilePath) && buildAction._script && buildAction._script._tsConfigInfo) {
        const tsConfigInfo = buildAction._script._tsConfigInfo;

        const typescriptModulePath = buildAction._script._projectTypescriptModulePath
            ? buildAction._script._projectTypescriptModulePath
            : 'typescript';

        plugins.push(
            typescript({
                tsconfig: tsConfigInfo.tsConfigPath,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                typescript: require(typescriptModulePath)
            })
        );
    }

    if (bundleOptions.commonjs) {
        const commonjsOption = {
            ...bundleOptions.commonjs,
            extensions: ['.js', '.ts'],
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
