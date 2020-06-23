import * as path from 'path';

import { InternalError, InvalidConfigError } from '../models/errors';
import {
    LibBundleOptionsInternal,
    LibProjectConfigInternal,
    TsTranspilationOptionsInternal
} from '../models/internals';

import { findUp } from '../utils';

import { initLibBundleTarget } from './init-lib-bundle-target';
import { initTsTranspilationOptions } from './init-ts-transpilation-options';
import { loadTsConfig } from './load-ts-config';
import { parseScriptStyleEntries } from './parse-script-style-entries';

export async function initLibProjectConfig(libConfig: LibProjectConfigInternal): Promise<void> {
    if (!libConfig._workspaceRoot) {
        throw new InternalError("The 'libConfig._workspaceRoot' is not set.");
    }

    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    if (!libConfig._outputPath) {
        throw new InternalError("The 'libConfig._outputPath' is not set.");
    }

    const workspaceRoot = libConfig._workspaceRoot;
    const nodeModulesPath = libConfig._nodeModulesPath;
    const projectRoot = libConfig._projectRoot;
    const outputPath = libConfig._outputPath;

    if (
        libConfig._projectName &&
        (libConfig._projectName.split('/').length > 2 ||
            (!libConfig._projectName.startsWith('@') && libConfig._projectName.split('/').length >= 2))
    ) {
        libConfig._isNestedPackage = true;
    }

    // package.json
    if (libConfig.packageJsonOutDir) {
        libConfig._packageJsonOutDir = path.resolve(outputPath, libConfig.packageJsonOutDir);
    } else if (outputPath) {
        if (libConfig._isNestedPackage) {
            if (!libConfig._packageNameWithoutScope) {
                throw new InternalError("The 'libConfig._packageNameWithoutScope' is not set.");
            }
            const nestedPath = libConfig._packageNameWithoutScope.substr(
                libConfig._packageNameWithoutScope.indexOf('/') + 1
            );

            libConfig._packageJsonOutDir = path.resolve(outputPath, nestedPath);
        } else {
            libConfig._packageJsonOutDir = outputPath;
        }
    }

    // tsConfig
    if (libConfig.tsConfig) {
        const tsConfigPath = path.resolve(projectRoot, libConfig.tsConfig);
        loadTsConfig(tsConfigPath, libConfig, libConfig);
    }

    await initTsTranspilationsInternal(libConfig);

    // bundles
    initBundleOptionsInternal(libConfig);

    // parsed result
    if (libConfig.styles && Array.isArray(libConfig.styles) && libConfig.styles.length > 0) {
        libConfig._styleParsedEntries = await parseScriptStyleEntries(
            libConfig.styles,
            'styles',
            workspaceRoot,
            nodeModulesPath,
            projectRoot
        );
    }
}

async function initTsTranspilationsInternal(libConfig: LibProjectConfigInternal): Promise<void> {
    if (!libConfig._workspaceRoot) {
        throw new InternalError("The 'libConfig._workspaceRoot' is not set.");
    }

    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    const workspaceRoot = libConfig._workspaceRoot;
    const projectRoot = libConfig._projectRoot;

    const tsTranspilationInternals: TsTranspilationOptionsInternal[] = [];
    if (libConfig.tsTranspilations && Array.isArray(libConfig.tsTranspilations)) {
        const tsTranspilations = libConfig.tsTranspilations;
        for (let i = 0; i < tsTranspilations.length; i++) {
            const tsTranspilationPartial = tsTranspilations[i] as Partial<TsTranspilationOptionsInternal>;
            let tsConfigPath = '';
            if (tsTranspilationPartial.tsConfig) {
                tsConfigPath = path.resolve(projectRoot, tsTranspilationPartial.tsConfig);
            } else {
                if (libConfig.tsConfig && libConfig._tsConfigPath) {
                    tsConfigPath = libConfig._tsConfigPath;
                } else if (i > 0 && tsTranspilationInternals[i - 1]._tsConfigPath) {
                    tsConfigPath = tsTranspilationInternals[i - 1]._tsConfigPath;
                } else if (i === 0) {
                    const foundTsConfigPath = await detectTsConfigPathForLib(workspaceRoot, projectRoot);
                    if (foundTsConfigPath) {
                        tsConfigPath = foundTsConfigPath;
                    }
                }
            }

            if (!tsConfigPath) {
                throw new InvalidConfigError(
                    `The 'projects[${
                        libConfig.name || libConfig._index
                    }].ngcTranspilations[${i}].tsConfig' value is required.`
                );
            }

            if (i > 0 && tsConfigPath === tsTranspilationInternals[i - 1]._tsConfigPath) {
                tsTranspilationPartial._tsConfigPath = tsTranspilationInternals[i - 1]._tsConfigPath;
                tsTranspilationPartial._tsConfigJson = tsTranspilationInternals[i - 1]._tsConfigJson;
                tsTranspilationPartial._tsCompilerConfig = tsTranspilationInternals[i - 1]._tsCompilerConfig;
                tsTranspilationPartial._angularCompilerOptions =
                    tsTranspilationInternals[i - 1]._angularCompilerOptions;
            }

            const tsTranspilation = await initTsTranspilationOptions(
                tsConfigPath,
                tsTranspilationPartial,
                1,
                libConfig
            );
            tsTranspilationInternals.push(tsTranspilation);
        }
    } else if (libConfig.tsTranspilations) {
        let tsConfigPath: string | null = null;
        if (libConfig.tsConfig && libConfig._tsConfigPath) {
            tsConfigPath = libConfig._tsConfigPath;
        } else {
            tsConfigPath = await detectTsConfigPathForLib(workspaceRoot, projectRoot);
        }

        if (!tsConfigPath) {
            throw new InvalidConfigError(
                `Could not detect tsconfig file for 'projects[${libConfig.name || libConfig._index}].`
            );
        }

        const esm2015TranspilationPartial: Partial<TsTranspilationOptionsInternal> = {
            target: 'es2015',
            outDir: 'esm2015'
        };
        const esm2015Transpilation = await initTsTranspilationOptions(
            tsConfigPath,
            esm2015TranspilationPartial,
            0,
            libConfig
        );
        tsTranspilationInternals.push(esm2015Transpilation);

        const esm5TranspilationPartial: Partial<TsTranspilationOptionsInternal> = {
            target: 'es5',
            outDir: 'esm5',
            declaration: false
        };
        const esm5Transpilation = await initTsTranspilationOptions(
            tsConfigPath,
            esm5TranspilationPartial,
            1,
            libConfig
        );
        tsTranspilationInternals.push(esm5Transpilation);
    }
    libConfig._tsTranspilations = tsTranspilationInternals;
}

function initBundleOptionsInternal(libConfig: LibProjectConfigInternal): void {
    const bundleInternals: LibBundleOptionsInternal[] = [];
    if (libConfig.bundles && Array.isArray(libConfig.bundles)) {
        const bundles = libConfig.bundles;
        for (let i = 0; i < bundles.length; i++) {
            const bundlePartial = bundles[i] as Partial<LibBundleOptionsInternal>;
            bundleInternals.push(initLibBundleTarget(bundleInternals, bundlePartial, i, libConfig));
        }
    } else if (libConfig.bundles) {
        let shouldBundlesDefault = libConfig.tsTranspilations === true;
        if (
            !shouldBundlesDefault &&
            libConfig._tsTranspilations &&
            libConfig._tsTranspilations.length >= 2 &&
            libConfig._tsTranspilations[0].target === 'es2015' &&
            libConfig._tsTranspilations[1].target === 'es5'
        ) {
            shouldBundlesDefault = true;
        }

        if (shouldBundlesDefault) {
            const es2015BundlePartial: Partial<LibBundleOptionsInternal> = {
                libraryTarget: 'esm',
                entryRoot: 'tsTranspilationOutput',
                tsTranspilationIndex: 0
            };

            const es2015BundleInternal = initLibBundleTarget(bundleInternals, es2015BundlePartial, 0, libConfig);
            bundleInternals.push(es2015BundleInternal);

            const es5BundlePartial: Partial<LibBundleOptionsInternal> = {
                libraryTarget: 'esm',
                entryRoot: 'tsTranspilationOutput',
                tsTranspilationIndex: 1
            };

            const es5BundleInternal = initLibBundleTarget(bundleInternals, es5BundlePartial, 1, libConfig);
            bundleInternals.push(es5BundleInternal);

            const umdBundlePartial: Partial<LibBundleOptionsInternal> = {
                libraryTarget: 'umd',
                entryRoot: 'prevBundleOutput'
            };
            const umdBundleInternal = initLibBundleTarget(bundleInternals, umdBundlePartial, 2, libConfig);
            bundleInternals.push(umdBundleInternal);
        } else {
            throw new InvalidConfigError(
                `Counld not detect to bunlde automatically, please correct option in 'projects[${
                    libConfig.name || libConfig._index
                }].bundles'.`
            );
        }
    }
    libConfig._bundles = bundleInternals;
}

async function detectTsConfigPathForLib(workspaceRoot: string, projectRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig-build.json', 'tsconfig.build.json', 'tsconfig.lib.json', 'tsconfig-lib.json', 'tsconfig.json'],
        projectRoot,
        workspaceRoot
    );
}
