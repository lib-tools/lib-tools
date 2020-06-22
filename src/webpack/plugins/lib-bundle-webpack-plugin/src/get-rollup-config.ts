import * as rollup from 'rollup';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

import { ExternalsEntry } from '../../../../models';
import { LibBundleOptionsInternal, LibProjectConfigInternal } from '../../../../models/internals';
import { LoggerBase } from '../../../../utils';

const dashCaseToCamelCase = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

export function getRollupConfig(
    libConfig: LibProjectConfigInternal,
    currentBundle: LibBundleOptionsInternal,
    logger: LoggerBase
): {
    inputOptions: rollup.InputOptions;
    outputOptions: rollup.OutputOptions;
} {
    // const isTsEntry = /\.tsx?$/i.test(currentBundle._entryFilePath);
    let moduleName = libConfig.libraryName;
    if (!moduleName && libConfig._packageName) {
        if (libConfig._packageName.startsWith('@')) {
            moduleName = libConfig._packageName.substring(1).split('/').join('.');
        } else {
            moduleName = libConfig._packageName.split('/').join('.');
        }
        moduleName = moduleName.replace(/-([a-z])/g, (_, g1) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return g1 ? g1.toUpperCase() : '';
        });
    }

    let amdId: { [key: string]: string } | undefined;
    if (libConfig._packageName) {
        amdId = { id: libConfig._packageName };
    }

    // library target
    if (!currentBundle.libraryTarget) {
        currentBundle.libraryTarget = 'esm';
    }

    // externals & globals
    const rollupExternalMap = {
        externals: [] as string[],
        globals: {}
    };

    const rawExternals: ExternalsEntry[] = [];
    if (currentBundle.externals) {
        if (Array.isArray(currentBundle.externals)) {
            rawExternals.push(...currentBundle.externals);
        } else {
            rawExternals.push(currentBundle.externals);
        }
    }

    if (rawExternals.length) {
        rawExternals.forEach((external) => {
            mapToRollupGlobalsAndExternals(external, rollupExternalMap);
        });
    }

    const externals = rollupExternalMap.externals || [];
    if (libConfig.platformTarget === 'node') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const getBuiltins = require('builtins');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const builtinExternals = getBuiltins() as string[];
        builtinExternals
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
            });
    }

    if (
        currentBundle.dependenciesAsExternals !== false &&
        libConfig._packageJson &&
        libConfig._packageJson.dependencies
    ) {
        Object.keys(libConfig._packageJson.dependencies)
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
            });
    }

    if (
        currentBundle.peerDependenciesAsExternals !== false &&
        libConfig._packageJson &&
        libConfig._packageJson.peerDependencies
    ) {
        Object.keys(libConfig._packageJson.peerDependencies)
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
            });
    }

    const globals: { [key: string]: string } = rollupExternalMap.globals || {};
    for (const key of externals) {
        if (globals[key] == null) {
            let normalizedValue = key
                .replace(/@angular\//, 'ng.')
                .replace(/@dagonmetric\//, '')
                .replace(/\//g, '.');
            normalizedValue = dashCaseToCamelCase(normalizedValue);
            globals[key] = normalizedValue;
            // const foundMap = getRollupPredefinedGlobalsMap(key);
            // if (foundMap) {
            //     globals = { ...globals, ...foundMap };
            // } else {
            //     let normalizedValue = key
            //         .replace(/@angular\//, 'ng.')
            //         .replace(/@dagonmetric\//, '')
            //         .replace(/\//g, '.');
            //     normalizedValue = dashCaseToCamelCase(normalizedValue);
            //     globals[key] = normalizedValue;
            // }
        }
    }

    // plugins
    const plugins: rollup.Plugin[] = [];

    if (
        currentBundle.libraryTarget === 'umd' ||
        currentBundle.libraryTarget === 'cjs' ||
        currentBundle.includeCommonJs
    ) {
        plugins.push(resolve());

        if (currentBundle.includeCommonJs) {
            let commonjsOption = {
                extensions: ['.js'],
                sourceMap: libConfig.sourceMap
            };

            if (typeof currentBundle.includeCommonJs === 'object') {
                commonjsOption = {
                    ...currentBundle.includeCommonJs,
                    ...commonjsOption
                };
            }

            plugins.push(commonjs(commonjsOption));
        }
    }

    const inputOptions: rollup.InputOptions = {
        input: currentBundle._entryFilePath,
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
        name: moduleName,
        amd: amdId,
        format: currentBundle.libraryTarget,
        globals,
        exports: 'named',
        banner: libConfig._bannerText,
        file: currentBundle._outputFilePath,
        sourcemap: libConfig.sourceMap
    };

    return {
        inputOptions,
        outputOptions
    };
}

function mapToRollupGlobalsAndExternals(
    external: ExternalsEntry,
    mapResult: { externals: string[]; globals: { [key: string]: string } }
): void {
    if (!external) {
        return;
    }

    if (typeof external === 'string') {
        if (!mapResult.externals.includes(external)) {
            mapResult.externals.push(external);
        }
    } else if (typeof external === 'object') {
        Object.keys(external).forEach((k: string) => {
            const tempValue = external[k];
            if (typeof tempValue === 'string') {
                mapResult.globals[k] = tempValue;
                if (!mapResult.externals.includes(k)) {
                    mapResult.externals.push(k);
                }
            } else if (typeof tempValue === 'object' && Object.keys(tempValue).length) {
                const selectedKey = tempValue.root ? tempValue.root : Object.keys(tempValue)[0];
                mapResult.globals[k] = tempValue[selectedKey];
                if (!mapResult.externals.includes(k)) {
                    mapResult.externals.push(k);
                }
            } else {
                if (!mapResult.externals.includes(k)) {
                    mapResult.externals.push(k);
                }
            }
        });
    }
}
