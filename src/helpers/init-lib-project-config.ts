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

export async function initLibProjectConfig(projectConfig: LibProjectConfigInternal): Promise<void> {
    if (!projectConfig._workspaceRoot) {
        throw new InternalError("The 'projectConfig._workspaceRoot' is not set.");
    }

    if (!projectConfig._projectRoot) {
        throw new InternalError("The 'projectConfig._projectRoot' is not set.");
    }

    if (!projectConfig._outputPath) {
        throw new InternalError("The 'projectConfig._outputPath' is not set.");
    }

    const workspaceRoot = projectConfig._workspaceRoot;
    const nodeModulesPath = projectConfig._nodeModulesPath;
    const projectRoot = projectConfig._projectRoot;
    const outputPath = projectConfig._outputPath;

    if (
        projectConfig._packageName &&
        (projectConfig._packageName.split('/').length > 2 ||
            (!projectConfig._packageName.startsWith('@') && projectConfig._packageName.split('/').length >= 2))
    ) {
        projectConfig._isNestedPackage = true;
    }

    // package.json
    if (projectConfig.packageJsonOutDir) {
        projectConfig._packageJsonOutDir = path.resolve(outputPath, projectConfig.packageJsonOutDir);
    } else if (outputPath) {
        if (projectConfig._isNestedPackage) {
            if (!projectConfig._packageNameWithoutScope) {
                throw new InternalError("The 'projectConfig._packageNameWithoutScope' is not set.");
            }
            const nestedPath = projectConfig._packageNameWithoutScope.substr(
                projectConfig._packageNameWithoutScope.indexOf('/') + 1
            );

            projectConfig._packageJsonOutDir = path.resolve(outputPath, nestedPath);
        } else {
            projectConfig._packageJsonOutDir = outputPath;
        }
    }

    // tsConfig
    if (projectConfig.tsConfig) {
        const tsConfigPath = path.resolve(projectRoot, projectConfig.tsConfig);
        loadTsConfig(tsConfigPath, projectConfig, projectConfig);
    }

    await initTsTranspilationsInternal(projectConfig);

    // bundles
    initBundleOptionsInternal(projectConfig);

    // parsed result
    if (projectConfig.styles && Array.isArray(projectConfig.styles) && projectConfig.styles.length > 0) {
        projectConfig._styleParsedEntries = await parseScriptStyleEntries(
            projectConfig.styles,
            'styles',
            workspaceRoot,
            nodeModulesPath,
            projectRoot
        );
    }
}

async function initTsTranspilationsInternal(projectConfig: LibProjectConfigInternal): Promise<void> {
    if (!projectConfig._workspaceRoot) {
        throw new InternalError("The 'projectConfig._workspaceRoot' is not set.");
    }

    if (!projectConfig._projectRoot) {
        throw new InternalError("The 'projectConfig._projectRoot' is not set.");
    }

    const workspaceRoot = projectConfig._workspaceRoot;
    const projectRoot = projectConfig._projectRoot;

    const tsTranspilationInternals: TsTranspilationOptionsInternal[] = [];
    if (projectConfig.tsTranspilations && Array.isArray(projectConfig.tsTranspilations)) {
        const tsTranspilations = projectConfig.tsTranspilations;
        for (let i = 0; i < tsTranspilations.length; i++) {
            const tsTranspilationPartial = tsTranspilations[i] as Partial<TsTranspilationOptionsInternal>;
            let tsConfigPath = '';
            if (tsTranspilationPartial.tsConfig) {
                tsConfigPath = path.resolve(projectRoot, tsTranspilationPartial.tsConfig);
            } else {
                if (projectConfig.tsConfig && projectConfig._tsConfigPath) {
                    tsConfigPath = projectConfig._tsConfigPath;
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
                        projectConfig.name || projectConfig._index
                    }].ngcTranspilations[${i}].tsConfig' value is required.`
                );
            }

            if (i > 0 && tsConfigPath === tsTranspilationInternals[i - 1]._tsConfigPath) {
                tsTranspilationPartial._tsConfigPath = tsTranspilationInternals[i - 1]._tsConfigPath;
                tsTranspilationPartial._tsConfigJson = tsTranspilationInternals[i - 1]._tsConfigJson;
                tsTranspilationPartial._tsCompilerConfig = tsTranspilationInternals[i - 1]._tsCompilerConfig;
                // tsTranspilationPartial._angularCompilerOptions =
                //     tsTranspilationInternals[i - 1]._angularCompilerOptions;
            }

            const tsTranspilation = await initTsTranspilationOptions(
                tsConfigPath,
                tsTranspilationPartial,
                1,
                projectConfig
            );
            tsTranspilationInternals.push(tsTranspilation);
        }
    } else if (projectConfig.tsTranspilations) {
        let tsConfigPath: string | null = null;
        if (projectConfig.tsConfig && projectConfig._tsConfigPath) {
            tsConfigPath = projectConfig._tsConfigPath;
        } else {
            tsConfigPath = await detectTsConfigPathForLib(workspaceRoot, projectRoot);
        }

        if (!tsConfigPath) {
            throw new InvalidConfigError(
                `Could not detect tsconfig file for 'projects[${projectConfig.name || projectConfig._index}].`
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
            projectConfig
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
            projectConfig
        );
        tsTranspilationInternals.push(esm5Transpilation);
    }
    projectConfig._tsTranspilations = tsTranspilationInternals;
}

function initBundleOptionsInternal(projectConfig: LibProjectConfigInternal): void {
    const bundleInternals: LibBundleOptionsInternal[] = [];
    if (projectConfig.bundles && Array.isArray(projectConfig.bundles)) {
        const bundles = projectConfig.bundles;
        for (let i = 0; i < bundles.length; i++) {
            const bundlePartial = bundles[i] as Partial<LibBundleOptionsInternal>;
            bundleInternals.push(initLibBundleTarget(bundleInternals, bundlePartial, i, projectConfig));
        }
    } else if (projectConfig.bundles) {
        let shouldBundlesDefault = projectConfig.tsTranspilations === true;
        if (
            !shouldBundlesDefault &&
            projectConfig._tsTranspilations &&
            projectConfig._tsTranspilations.length >= 2 &&
            projectConfig._tsTranspilations[0].target === 'es2015' &&
            projectConfig._tsTranspilations[1].target === 'es5'
        ) {
            shouldBundlesDefault = true;
        }

        if (shouldBundlesDefault) {
            const es2015BundlePartial: Partial<LibBundleOptionsInternal> = {
                libraryTarget: 'esm',
                entryRoot: 'tsTranspilationOutput',
                tsTranspilationIndex: 0
            };

            const es2015BundleInternal = initLibBundleTarget(bundleInternals, es2015BundlePartial, 0, projectConfig);
            bundleInternals.push(es2015BundleInternal);

            const es5BundlePartial: Partial<LibBundleOptionsInternal> = {
                libraryTarget: 'esm',
                entryRoot: 'tsTranspilationOutput',
                tsTranspilationIndex: 1
            };

            const es5BundleInternal = initLibBundleTarget(bundleInternals, es5BundlePartial, 1, projectConfig);
            bundleInternals.push(es5BundleInternal);

            const umdBundlePartial: Partial<LibBundleOptionsInternal> = {
                libraryTarget: 'umd',
                entryRoot: 'prevBundleOutput'
            };
            const umdBundleInternal = initLibBundleTarget(bundleInternals, umdBundlePartial, 2, projectConfig);
            bundleInternals.push(umdBundleInternal);
        } else {
            throw new InvalidConfigError(
                `Counld not detect to bunlde automatically, please correct option in 'projects[${
                    projectConfig.name || projectConfig._index
                }].bundles'.`
            );
        }
    }
    projectConfig._bundles = bundleInternals;
}

async function detectTsConfigPathForLib(workspaceRoot: string, projectRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig-build.json', 'tsconfig.build.json', 'tsconfig.lib.json', 'tsconfig-lib.json', 'tsconfig.json'],
        projectRoot,
        workspaceRoot
    );
}
