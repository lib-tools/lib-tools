import * as path from 'path';

import { pathExists } from 'fs-extra';
import { ModuleKind, ScriptTarget } from 'typescript';

import { ScriptBundleOptions, ScriptCompilationOptions, ScriptOptions, ScriptTargetString } from '../models';
import {
    BuildActionInternal,
    PackageJsonLike,
    ScriptBundleOptionsInternal,
    ScriptCompilationOptionsInternal,
    TsConfigInfo
} from '../models/internals';
import { findUp, isInFolder, isSamePaths, normalizePath } from '../utils';

import { getCachedTsConfigFile } from './get-cached-ts-config-file';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
import { toTsScriptTarget } from './to-ts-script-target';

const dashCaseToCamelCase = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
let buildInsExternals: string[] | null = null;

export async function prepareScripts(buildAction: BuildActionInternal): Promise<void> {
    const workspaceRoot = buildAction._workspaceRoot;
    const projectRoot = buildAction._projectRoot;
    const projectName = buildAction._projectName;

    const scriptCompilations: ScriptCompilationOptionsInternal[] = [];
    const scriptBundles: ScriptBundleOptionsInternal[] = [];
    let tsConfigPath: string | null = null;
    let tsConfigInfo: TsConfigInfo | null = null;

    if (buildAction.script && buildAction.script.tsConfig) {
        tsConfigPath = path.resolve(projectRoot, buildAction.script.tsConfig);
        if (!tsConfigPath) {
            throw new Error(
                `The tsConfig file ${tsConfigPath} doesn't exist. Please correct value in 'projects[${projectName}].actions.build.script.tsConfig'.`
            );
        }
    } else if (buildAction.script || buildAction._config === 'auto') {
        tsConfigPath = await detectTsConfigPath(workspaceRoot, projectRoot);
    }

    if (tsConfigPath) {
        const tsConfigJson = getCachedTsConfigFile(tsConfigPath);
        const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
        tsConfigInfo = {
            tsConfigPath,
            tsConfigJson,
            tsCompilerConfig
        };
    }

    const entryNameRel = await detectEntryName(buildAction, tsConfigInfo);

    if (buildAction.script && buildAction.script.compilations) {
        if (!tsConfigPath || !tsConfigInfo) {
            throw new Error(
                `Typescript configuration file could not be detected automatically. Please set it manually in 'projects[${projectName}].actions.build.script.tsConfig'.`
            );
        }

        if (!entryNameRel) {
            throw new Error(
                `The entry file could not be detected automatically. Please set it manually in 'projects[${projectName}].actions.build.script.entry'.`
            );
        }

        if (Array.isArray(buildAction.script.compilations)) {
            for (const compilation of buildAction.script.compilations) {
                const scriptCompilationEntryInternal = toScriptCompilationEntryInternal(
                    compilation,
                    entryNameRel,
                    tsConfigInfo,
                    buildAction
                );
                scriptCompilations.push(scriptCompilationEntryInternal);
            }
        } else if (buildAction.script.compilations === 'auto') {
            if (
                tsConfigInfo.tsCompilerConfig.options.target &&
                tsConfigInfo.tsCompilerConfig.options.target > ScriptTarget.ES2015
            ) {
                const esSuffix =
                    tsConfigInfo.tsCompilerConfig.options.target >= ScriptTarget.ESNext
                        ? 'Next'
                        : `${2013 + tsConfigInfo.tsCompilerConfig.options.target}`;

                const esmScriptCompilationEntry = toScriptCompilationEntryInternal(
                    {
                        target: `es${esSuffix}` as ScriptTargetString,
                        outDir: `esm${esSuffix}`,
                        declaration: true,
                        esBundle: true
                    },
                    entryNameRel,
                    tsConfigInfo,
                    buildAction
                );
                scriptCompilations.push(esmScriptCompilationEntry);
            } else {
                const esmScriptCompilationEntry = toScriptCompilationEntryInternal(
                    {
                        target: 'es2015',
                        outDir: 'esm2015',
                        declaration: true,
                        esBundle: true
                    },
                    entryNameRel,
                    tsConfigInfo,
                    buildAction
                );
                scriptCompilations.push(esmScriptCompilationEntry);
            }

            const esm5ScriptCompilationEntry = toScriptCompilationEntryInternal(
                {
                    target: 'es5',
                    outDir: 'esm5',
                    declaration: false,
                    esBundle: true,
                    umdBundle: true
                },
                entryNameRel,
                tsConfigInfo,
                buildAction
            );
            scriptCompilations.push(esm5ScriptCompilationEntry);
        }
    }

    if (buildAction.script && buildAction.script.bundles) {
        const scriptOptions = buildAction.script;
        for (const bundleOptions of buildAction.script.bundles) {
            const bundleOptionsInternal = toBundleEntryInternal(
                bundleOptions,
                scriptOptions,
                tsConfigInfo,
                buildAction
            );
            scriptBundles.push(bundleOptionsInternal);
        }
    }

    buildAction._script = {
        ...buildAction.script,
        _tsConfigInfo: tsConfigInfo,
        _entryNameRel: entryNameRel,
        _compilations: scriptCompilations,
        _bundles: scriptBundles
    };
}

function toScriptCompilationEntryInternal(
    compilationOptions: ScriptCompilationOptions,
    entryNameRel: string,
    tsConfigInfo: TsConfigInfo,
    buildAction: BuildActionInternal
): ScriptCompilationOptionsInternal {
    const tsConfigPath = tsConfigInfo.tsConfigPath;
    const tsCompilerConfig = tsConfigInfo.tsCompilerConfig;
    const compilerOptions = tsCompilerConfig.options;

    // scriptTarget
    let scriptTarget: ScriptTarget = ScriptTarget.ES2015;
    if (compilationOptions.target) {
        scriptTarget = toTsScriptTarget(compilationOptions.target);
    } else if (compilerOptions.target) {
        scriptTarget = compilerOptions.target;
    }

    // declaration
    let declaration = true;
    if (compilationOptions.declaration != null) {
        declaration = compilationOptions.declaration;
    }

    // tsOutDir
    let tsOutDir: string;
    let customTsOutDir: string | null = null;
    if (compilationOptions.outDir) {
        tsOutDir = path.resolve(buildAction._outputPath, compilationOptions.outDir);
        customTsOutDir = tsOutDir;
    } else {
        if (compilerOptions.outDir) {
            tsOutDir = path.isAbsolute(compilerOptions.outDir)
                ? path.resolve(compilerOptions.outDir)
                : path.resolve(path.dirname(tsConfigPath), compilerOptions.outDir);
        } else {
            tsOutDir = buildAction._outputPath;
            customTsOutDir = tsOutDir;
        }
    }

    if (compilerOptions.rootDir && !isSamePaths(compilerOptions.rootDir, path.dirname(tsConfigPath))) {
        const relSubDir = isInFolder(compilerOptions.rootDir, path.dirname(tsConfigPath))
            ? normalizePath(path.relative(compilerOptions.rootDir, path.dirname(tsConfigPath)))
            : normalizePath(path.relative(path.dirname(tsConfigPath), compilerOptions.rootDir));
        tsOutDir = path.resolve(tsOutDir, relSubDir);
    }

    const bundles: ScriptBundleOptionsInternal[] = [];
    const sourceMap = compilerOptions.sourceMap ? true : false;
    if (compilationOptions.esBundle) {
        const bundleOptions = typeof compilationOptions.esBundle === 'object' ? compilationOptions.esBundle : {};

        const entryFilePath = path.resolve(tsOutDir, `${entryNameRel}.js`);
        const esSuffix = ScriptTarget[scriptTarget].replace(/^ES/i, '');
        const fesmFolderName = `fesm${esSuffix}`;
        const outFileName = bundleOptions.outputFile
            ? bundleOptions.outputFile
            : `${fesmFolderName}/${buildAction._packageNameWithoutScope.replace(/\//gm, '-')}.umd.js`;
        const bundleOutFilePath = path.resolve(buildAction._outputPath, outFileName);
        const globalsAndExternals = getExternalsAndGlobals(buildAction.script || {}, {}, buildAction._packageJson);

        const bundleOptionsInternal: ScriptBundleOptionsInternal = {
            moduleFormat: 'es',
            sourceMap,
            minify: false,
            ...bundleOptions,
            _entryFilePath: entryFilePath,
            _outputFilePath: bundleOutFilePath,
            _externals: globalsAndExternals.externals,
            _globals: globalsAndExternals.globals
        };
        bundles.push(bundleOptionsInternal);
    }

    if (compilationOptions.umdBundle) {
        const bundleOptions = typeof compilationOptions.umdBundle === 'object' ? compilationOptions.umdBundle : {};

        const entryFilePath = path.resolve(tsOutDir, `${entryNameRel}.js`);
        const outFileName = bundleOptions.outputFile
            ? bundleOptions.outputFile
            : `bundles/${buildAction._packageNameWithoutScope.replace(/\//gm, '-')}.umd.js`;
        const bundleOutFilePath = path.resolve(buildAction._outputPath, outFileName);
        const globalsAndExternals = getExternalsAndGlobals(buildAction.script || {}, {}, buildAction._packageJson);

        const bundleOptionsInternal: ScriptBundleOptionsInternal = {
            moduleFormat: 'umd',
            sourceMap,
            minify: true,
            ...bundleOptions,
            _entryFilePath: entryFilePath,
            _outputFilePath: bundleOutFilePath,
            _externals: globalsAndExternals.externals,
            _globals: globalsAndExternals.globals
        };
        bundles.push(bundleOptionsInternal);
    }

    if (compilationOptions.cjsBundle) {
        const bundleOptions = typeof compilationOptions.cjsBundle === 'object' ? compilationOptions.cjsBundle : {};

        const entryFilePath = path.resolve(tsOutDir, `${entryNameRel}.js`);
        const outFileName = bundleOptions.outputFile
            ? bundleOptions.outputFile
            : `bundles/${buildAction._packageNameWithoutScope.replace(/\//gm, '-')}.cjs.js`;
        const bundleOutFilePath = path.resolve(buildAction._outputPath, outFileName);
        const globalsAndExternals = getExternalsAndGlobals(buildAction.script || {}, {}, buildAction._packageJson);

        const bundleOptionsInternal: ScriptBundleOptionsInternal = {
            moduleFormat: 'cjs',
            sourceMap,
            minify: true,
            ...bundleOptions,
            _entryFilePath: entryFilePath,
            _outputFilePath: bundleOutFilePath,
            _externals: globalsAndExternals.externals,
            _globals: globalsAndExternals.globals
        };
        bundles.push(bundleOptionsInternal);
    }

    // Add  entry points to package.json
    if (buildAction.script == null || (buildAction.script && buildAction.script.addToPackageJson !== false)) {
        if (declaration) {
            if (buildAction._nestedPackage) {
                // TODO: To check
                buildAction._packageJsonEntryPoint.typings = normalizePath(
                    path.relative(
                        buildAction._packageJsonOutDir,
                        path.join(buildAction._outputPath, `${entryNameRel}.d.ts`)
                    )
                );
            } else {
                buildAction._packageJsonEntryPoint.typings = `${entryNameRel}.d.ts`;
            }
        }

        const jsEntryFile = normalizePath(
            `${path.relative(buildAction._packageJsonOutDir, path.resolve(tsOutDir, entryNameRel))}.js`
        );

        if (
            compilerOptions.module &&
            compilerOptions.module >= ModuleKind.ES2015 &&
            scriptTarget > ScriptTarget.ES2015
        ) {
            let esYear: string;
            if (scriptTarget === ScriptTarget.ESNext) {
                if (compilerOptions.module === ModuleKind.ES2020 || compilerOptions.module === ModuleKind.ESNext) {
                    esYear = '2020';
                } else {
                    esYear = '2015';
                }
            } else {
                esYear = `${2013 + scriptTarget}`;
            }

            buildAction._packageJsonEntryPoint[`es${esYear}`] = jsEntryFile;
            if (!buildAction._packageJsonEntryPoint.module) {
                buildAction._packageJsonEntryPoint.module = jsEntryFile;
            }

            if (esYear === '2015') {
                // (Angular) It is deprecated as of v9, might be removed in the future.
                buildAction._packageJsonEntryPoint[`esm${esYear}`] = jsEntryFile;
            }
        } else if (
            compilerOptions.module &&
            compilerOptions.module >= ModuleKind.ES2015 &&
            scriptTarget === ScriptTarget.ES2015
        ) {
            buildAction._packageJsonEntryPoint.es2015 = jsEntryFile;
            if (!buildAction._packageJsonEntryPoint.module) {
                buildAction._packageJsonEntryPoint.module = jsEntryFile;
            }

            // (Angular) It is deprecated as of v9, might be removed in the future.
            buildAction._packageJsonEntryPoint.esm2015 = jsEntryFile;
        } else if (
            compilerOptions.module &&
            compilerOptions.module >= ModuleKind.ES2015 &&
            scriptTarget === ScriptTarget.ES5
        ) {
            buildAction._packageJsonEntryPoint.esm5 = jsEntryFile;
            buildAction._packageJsonEntryPoint.module = jsEntryFile;
        } else if (compilerOptions.module === ModuleKind.UMD || compilerOptions.module === ModuleKind.CommonJS) {
            buildAction._packageJsonEntryPoint.main = jsEntryFile;
        }

        for (const bundleOptions of bundles) {
            const jsEntryFileForBundle = normalizePath(
                path.relative(buildAction._packageJsonOutDir, bundleOptions._outputFilePath)
            );

            if (bundleOptions.moduleFormat === 'es') {
                if (
                    compilerOptions.module &&
                    compilerOptions.module >= ModuleKind.ES2015 &&
                    scriptTarget > ScriptTarget.ES2015
                ) {
                    let esYear: string;
                    if (scriptTarget === ScriptTarget.ESNext) {
                        if (
                            compilerOptions.module === ModuleKind.ES2020 ||
                            compilerOptions.module === ModuleKind.ESNext
                        ) {
                            esYear = '2020';
                        } else {
                            esYear = '2015';
                        }
                    } else {
                        esYear = `${2013 + scriptTarget}`;
                    }

                    buildAction._packageJsonEntryPoint[`fesm${esYear}`] = jsEntryFileForBundle;
                    buildAction._packageJsonEntryPoint[`es${esYear}`] = jsEntryFileForBundle;
                    if (!buildAction._packageJsonEntryPoint.module) {
                        buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
                    }
                } else if (
                    compilerOptions.module &&
                    compilerOptions.module >= ModuleKind.ES2015 &&
                    scriptTarget === ScriptTarget.ES2015
                ) {
                    buildAction._packageJsonEntryPoint.fesm2015 = jsEntryFileForBundle;
                    buildAction._packageJsonEntryPoint.es2015 = jsEntryFileForBundle;
                    if (!buildAction._packageJsonEntryPoint.module) {
                        buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
                    }
                } else if (
                    compilerOptions.module &&
                    compilerOptions.module >= ModuleKind.ES2015 &&
                    scriptTarget === ScriptTarget.ES5
                ) {
                    buildAction._packageJsonEntryPoint.fesm5 = jsEntryFileForBundle;
                    buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
                }
            } else {
                buildAction._packageJsonEntryPoint.main = jsEntryFileForBundle;
            }
        }
    }

    return {
        ...compilationOptions,
        _tsConfigInfo: tsConfigInfo,
        _entryNameRel: entryNameRel,
        _scriptTarget: scriptTarget,
        _declaration: declaration,
        _tsOutDirRootResolved: tsOutDir,
        _customTsOutDir: customTsOutDir,
        _bundles: bundles
    };
}

async function detectTsConfigPath(workspaceRoot: string, projectRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig.build.json', 'tsconfig-build.json', 'tsconfig.lib.json', 'tsconfig-lib.json', 'tsconfig.json'],
        projectRoot,
        workspaceRoot
    );
}

async function detectEntryName(
    buildAction: BuildActionInternal,
    tsConfigInfo: TsConfigInfo | null
): Promise<string | null> {
    if (buildAction.script && buildAction.script.entry) {
        return normalizePath(buildAction.script.entry).replace(/\.(ts|js)$/i, '');
    }

    const flatModuleOutFile =
        tsConfigInfo &&
        tsConfigInfo.tsConfigJson.angularCompilerOptions &&
        tsConfigInfo.tsConfigJson.angularCompilerOptions.flatModuleOutFile
            ? tsConfigInfo.tsConfigJson.angularCompilerOptions.flatModuleOutFile
            : null;
    if (flatModuleOutFile) {
        return flatModuleOutFile.replace(/\.js$/i, '');
    }

    if (tsConfigInfo) {
        const tsSrcRootDir = path.dirname(tsConfigInfo.tsConfigPath);

        if (await pathExists(path.resolve(tsSrcRootDir, 'index.ts'))) {
            return 'index';
        }

        const packageName =
            buildAction._packageNameWithoutScope.lastIndexOf('/') > -1
                ? buildAction._packageNameWithoutScope.substr(buildAction._packageNameWithoutScope.lastIndexOf('/') + 1)
                : buildAction._packageNameWithoutScope;
        if (await pathExists(path.resolve(tsSrcRootDir, packageName + '.ts'))) {
            return packageName;
        }

        if (await pathExists(path.resolve(tsSrcRootDir, 'main.ts'))) {
            return 'main';
        }

        if (await pathExists(path.resolve(tsSrcRootDir, 'public_api.ts'))) {
            return 'public_api';
        }

        if (await pathExists(path.resolve(tsSrcRootDir, 'public-api.ts'))) {
            return 'public-api';
        }
    }

    return null;
}

function toBundleEntryInternal(
    bundleOptions: ScriptBundleOptions,
    scriptOptions: ScriptOptions,
    tsConfigInfo: TsConfigInfo | null,
    buildAction: BuildActionInternal
): ScriptBundleOptionsInternal {
    if (!scriptOptions.entry) {
        throw new Error(
            `The entry file could not be detected automatically. Please set it manually in 'projects[${buildAction._projectName}].actions.build.script.entry'.`
        );
    }

    const projectRoot = buildAction._projectRoot;
    const entryFilePath = path.resolve(projectRoot, scriptOptions.entry);

    // outputFilePath
    let bundleOutFilePath = '';
    if (bundleOptions.outputFile) {
        bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOptions.outputFile);
        if (!/\.js$/i.test(bundleOutFilePath)) {
            bundleOutFilePath = path.resolve(bundleOutFilePath, `${path.parse(entryFilePath).name}.js`);
        }
    } else {
        bundleOutFilePath = path.resolve(buildAction._outputPath, `${path.parse(entryFilePath).name}.js`);
    }

    // Add  entry points to package.json
    if (buildAction.script == null || (buildAction.script && buildAction.script.addToPackageJson !== false)) {
        const jsEntryFileForBundle = normalizePath(path.relative(buildAction._packageJsonOutDir, bundleOutFilePath));
        const compilerOptions = tsConfigInfo?.tsCompilerConfig.options;
        const scriptTarget = compilerOptions?.target;
        const moduleKind = compilerOptions?.module;

        if (bundleOptions.moduleFormat === 'es') {
            if (moduleKind && moduleKind >= ModuleKind.ES2015 && scriptTarget && scriptTarget > ScriptTarget.ES2015) {
                let esYear: string;
                if (scriptTarget === ScriptTarget.ESNext) {
                    if (moduleKind === ModuleKind.ES2020 || moduleKind === ModuleKind.ESNext) {
                        esYear = '2020';
                    } else {
                        esYear = '2015';
                    }
                } else {
                    esYear = `${2013 + scriptTarget}`;
                }

                buildAction._packageJsonEntryPoint[`fesm${esYear}`] = jsEntryFileForBundle;
                buildAction._packageJsonEntryPoint[`es${esYear}`] = jsEntryFileForBundle;
                if (!buildAction._packageJsonEntryPoint.module) {
                    buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
                }
            } else if (
                moduleKind &&
                moduleKind >= ModuleKind.ES2015 &&
                scriptTarget &&
                scriptTarget === ScriptTarget.ES2015
            ) {
                buildAction._packageJsonEntryPoint.fesm2015 = jsEntryFileForBundle;
                buildAction._packageJsonEntryPoint.es2015 = jsEntryFileForBundle;
                if (!buildAction._packageJsonEntryPoint.module) {
                    buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
                }
            } else if (moduleKind && moduleKind >= ModuleKind.ES2015 && scriptTarget === ScriptTarget.ES5) {
                buildAction._packageJsonEntryPoint.fesm5 = jsEntryFileForBundle;
                buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
            } else {
                buildAction._packageJsonEntryPoint.module = jsEntryFileForBundle;
            }
        } else {
            buildAction._packageJsonEntryPoint.main = jsEntryFileForBundle;
        }
    }

    const globalsAndExternals = getExternalsAndGlobals(scriptOptions, bundleOptions, buildAction._packageJson);

    return {
        ...bundleOptions,
        _entryFilePath: entryFilePath,
        _outputFilePath: bundleOutFilePath,
        _externals: globalsAndExternals.externals,
        _globals: globalsAndExternals.globals
    };
}

function getExternalsAndGlobals(
    scriptOptions: ScriptOptions,
    bundleOptions: Partial<ScriptBundleOptions>,
    packageJson: PackageJsonLike
): { externals: string[]; globals: { [key: string]: string } } {
    let globals: { [key: string]: string } = {};
    if (scriptOptions.externals) {
        globals = {
            ...globals,
            ...scriptOptions.externals
        };
    }
    if (bundleOptions.externals) {
        globals = {
            ...globals,
            ...bundleOptions.externals
        };
    }

    const externals = Object.keys(globals);

    if (bundleOptions.moduleFormat === 'cjs') {
        if (buildInsExternals == null) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
            buildInsExternals = require('builtins')() as string[];
        }

        buildInsExternals
            .filter((e) => !externals.includes(e))
            .forEach((e) => {
                externals.push(e);
            });
    }

    let dependenciesAsExternals = true;
    if (bundleOptions.dependenciesAsExternals != null) {
        dependenciesAsExternals = bundleOptions.dependenciesAsExternals;
    } else if (scriptOptions.dependenciesAsExternals != null) {
        dependenciesAsExternals = scriptOptions.dependenciesAsExternals;
    }

    if (dependenciesAsExternals && packageJson.dependencies) {
        Object.keys(packageJson.dependencies)
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

    let peerDependenciesAsExternals = true;
    if (bundleOptions.peerDependenciesAsExternals != null) {
        peerDependenciesAsExternals = bundleOptions.peerDependenciesAsExternals;
    } else if (scriptOptions.peerDependenciesAsExternals != null) {
        peerDependenciesAsExternals = scriptOptions.peerDependenciesAsExternals;
    }

    if (peerDependenciesAsExternals && packageJson.peerDependencies) {
        Object.keys(packageJson.peerDependencies)
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

    return {
        externals,
        globals
    };
}

function getGlobalVariable(externalKey: string): string | null {
    if (externalKey === 'tslib') {
        return externalKey;
    }

    if (/@angular\//.test(externalKey)) {
        const normalizedValue = externalKey.replace(/@angular\//, 'ng.').replace(/\//g, '.');
        return dashCaseToCamelCase(normalizedValue);
    }

    return null;
}
