import * as rollup from 'rollup';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

import { BuildActionInternal, ScriptBundleEntryInternal } from '../models/internals';
import { LoggerBase } from '../utils';

const dashCaseToCamelCase = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

export function getRollupConfig(
    bundle: ScriptBundleEntryInternal,
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

    const globals = scriptOptions.externals
        ? (JSON.parse(JSON.stringify(scriptOptions.externals)) as { [key: string]: string })
        : {};
    const externals = Object.keys(globals);

    if (bundle.moduleFormat === 'cjs') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
        const builtins = require('builtins')() as string[];
        builtins
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
            });
    }

    if (
        scriptOptions.dependenciesAsExternals !== false &&
        buildAction._packageJson &&
        buildAction._packageJson.dependencies
    ) {
        Object.keys(buildAction._packageJson.dependencies)
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
                if (!globals[e]) {
                    const globalVar = getGlobalVariable(e);
                    if (globalVar) {
                        globals[e] = globalVar;
                    }
                }
            });
    }

    if (
        scriptOptions.peerDependenciesAsExternals !== false &&
        buildAction._packageJson &&
        buildAction._packageJson.peerDependencies
    ) {
        Object.keys(buildAction._packageJson.peerDependencies)
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
                if (!globals[e]) {
                    const globalVar = getGlobalVariable(e);
                    if (globalVar) {
                        globals[e] = globalVar;
                    }
                }
            });
    }

    // plugins
    const plugins: rollup.Plugin[] = [];
    if (bundle.moduleFormat === 'umd' || bundle.moduleFormat === 'cjs' || bundle.includeCommonJs) {
        plugins.push(resolve());
    }

    if (bundle.includeCommonJs) {
        let commonjsOption = {
            extensions: ['.js'],
            sourceMap: scriptOptions.sourceMap
        };

        if (typeof bundle.includeCommonJs === 'object') {
            commonjsOption = {
                ...bundle.includeCommonJs,
                ...commonjsOption
            };
        }

        plugins.push(commonjs(commonjsOption));
    }

    const inputOptions: rollup.InputOptions = {
        input: bundle._entryFilePath,
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
        file: bundle._outputFilePath,
        exports: 'named',
        name: moduleName,
        amd: { id: buildAction._packageName },
        format: bundle.moduleFormat,
        globals,
        sourcemap: scriptOptions.sourceMap
    };

    if (buildAction._bannerText) {
        outputOptions.banner = buildAction._bannerText;
    }

    return {
        inputOptions,
        outputOptions
    };
}

function getGlobalVariable(externalKey: string): string | null {
    if (/@angular\//.test(externalKey)) {
        const normalizedValue = externalKey.replace(/@angular\//, 'ng.').replace(/\//g, '.');
        return dashCaseToCamelCase(normalizedValue);
    }

    return null;
}
