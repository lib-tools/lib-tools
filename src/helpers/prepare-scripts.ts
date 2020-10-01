import * as path from 'path';

import { pathExists } from 'fs-extra';
import { ModuleKind, ScriptTarget } from 'typescript';

import {
    BuildConfigInternal,
    EcmaNumber,
    PackageJsonLike,
    ScriptBundleModuleKind,
    ScriptBundleOptions,
    ScriptBundleOptionsInternal,
    ScriptCompilationOptions,
    ScriptCompilationOptionsInternal,
    ScriptOptions,
    ScriptTargetString,
    TsConfigInfo
} from '../models';
import { dashCaseToCamelCase, isInFolder, isSamePaths, normalizePath } from '../utils';

import { detectTsEntryName } from './detect-ts-entry-name';
import { findBuildTsconfigFile } from './find-build-tsconfig-file';
import { readTsconfigJson } from './read-tsconfig-json';
import { addPredefinedUmdIds, getUmdGlobalVariable } from './umd-ids';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
import { toTsScriptTarget } from './to-ts-script-target';

const esmRegExp = /\/?f?esm?(5|20[1-2][0-9])\/?/i;

let buildInExternals: string[] | null = null;

export async function prepareScripts(buildConfig: BuildConfigInternal): Promise<void> {
    const workspaceRoot = buildConfig._workspaceRoot;
    const projectRoot = buildConfig._projectRoot;
    const projectName = buildConfig._projectName;
    const compilations: ScriptCompilationOptionsInternal[] = [];
    const bundles: ScriptBundleOptionsInternal[] = [];
    let tsConfigPath: string | null = null;
    let tsConfigInfo: TsConfigInfo | null = null;

    if (buildConfig.script && buildConfig.script.tsConfig) {
        tsConfigPath = path.resolve(projectRoot, buildConfig.script.tsConfig);
        if (!tsConfigPath) {
            throw new Error(
                `The tsConfig file ${tsConfigPath} doesn't exist. Please correct value in 'projects[${projectName}].tasks.build.script.tsConfig'.`
            );
        }
    } else if (buildConfig.script) {
        tsConfigPath = await findBuildTsconfigFile(projectRoot, workspaceRoot);
    }

    if (tsConfigPath) {
        const tsConfigJson = readTsconfigJson(tsConfigPath);
        const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
        tsConfigInfo = {
            tsConfigPath,
            tsConfigJson,
            tsCompilerConfig
        };
    }

    let entryName: string | null = null;
    if (buildConfig.script && buildConfig.script.entry) {
        entryName = normalizePath(buildConfig.script.entry).replace(/\.(ts|js)$/i, '');
    } else if (tsConfigInfo) {
        entryName = await detectTsEntryName(tsConfigInfo, buildConfig._packageNameWithoutScope);
    }

    const umdIds: { [key: string]: string } = {};
    if (buildConfig.script?.umdId) {
        umdIds[buildConfig._packageName] = buildConfig.script?.umdId;
    } else {
        const normalizedValue = buildConfig._packageName.replace(/\//g, '.');
        const umdId = dashCaseToCamelCase(normalizedValue);
        umdIds[buildConfig._packageName] = umdId;
    }

    if (buildConfig.script && buildConfig.script.compilations) {
        if (!tsConfigPath || !tsConfigInfo) {
            throw new Error(
                `Typescript configuration file could not be detected automatically. Please set value manually in 'projects[${projectName}].tasks.build.script.tsConfig'.`
            );
        }

        if (!entryName) {
            throw new Error(
                `The entry file could not be detected automatically. Please set value manually in 'projects[${projectName}].tasks.build.script.entry'.`
            );
        }

        if (Array.isArray(buildConfig.script.compilations)) {
            for (const compilation of buildConfig.script.compilations) {
                const compilationInternal = toScriptCompilationOptionsInternal(
                    compilation,
                    entryName,
                    tsConfigInfo,
                    umdIds,
                    buildConfig
                );
                compilations.push(compilationInternal);
            }
        } else if (buildConfig.script.compilations === 'auto') {
            if (
                tsConfigInfo.tsCompilerConfig.options.target == null ||
                (tsConfigInfo.tsCompilerConfig.options.target &&
                    tsConfigInfo.tsCompilerConfig.options.target >= ScriptTarget.ES2015)
            ) {
                let scriptTargetStr: ScriptTargetString = 'ES2015';
                if (
                    tsConfigInfo.tsCompilerConfig.options.target &&
                    tsConfigInfo.tsCompilerConfig.options.target >= ScriptTarget.ESNext
                ) {
                    scriptTargetStr = 'ESNext';
                } else if (tsConfigInfo.tsCompilerConfig.options.target) {
                    scriptTargetStr = `ES${2013 + tsConfigInfo.tsCompilerConfig.options.target}` as ScriptTargetString;
                }

                const esmScriptCompilation = toScriptCompilationOptionsInternal(
                    {
                        target: scriptTargetStr,
                        declaration: true,
                        esBundle: true,
                        umdBundle: true
                    },
                    entryName,
                    tsConfigInfo,
                    umdIds,
                    buildConfig
                );
                compilations.push(esmScriptCompilation);
            } else {
                const esm5ScriptCompilation = toScriptCompilationOptionsInternal(
                    {
                        target: 'es5',
                        declaration: false,
                        esBundle: true,
                        umdBundle: true
                    },
                    entryName,
                    tsConfigInfo,
                    umdIds,
                    buildConfig
                );
                compilations.push(esm5ScriptCompilation);
            }
        }
    }

    if (buildConfig.script && buildConfig.script.bundles) {
        if (
            !buildConfig._packageJsonEntryPoint.typings &&
            entryName &&
            tsConfigInfo &&
            tsConfigInfo.tsCompilerConfig.options.declaration &&
            buildConfig.script.entry &&
            /\.tsx?$/i.test(buildConfig.script.entry)
        ) {
            AddTypingsEntryPointToPackageJson(buildConfig, entryName);
        }

        for (const bundleOptions of buildConfig.script.bundles) {
            const bundleOptionsInternal = toScriptBundleOptionsInternal(
                bundleOptions,
                tsConfigInfo,
                umdIds,
                buildConfig
            );
            bundles.push(bundleOptionsInternal);
        }
    }

    let typescriptModulePath: string | null = null;
    if (
        buildConfig._nodeModulesPath &&
        pathExists(path.resolve(buildConfig._nodeModulesPath, 'typescript', 'package.json'))
    ) {
        typescriptModulePath = path.resolve(buildConfig._nodeModulesPath, 'typescript');
    }

    addPredefinedUmdIds(umdIds);

    buildConfig._script = {
        ...buildConfig.script,
        _tsConfigInfo: tsConfigInfo,
        _entryName: entryName,
        _compilations: compilations,
        _bundles: bundles,
        _projectTypescriptModulePath: typescriptModulePath
    };
}

function toScriptCompilationOptionsInternal(
    compilationOptions: ScriptCompilationOptions,
    entryName: string,
    tsConfigInfo: TsConfigInfo,
    umdIds: { [key: string]: string },
    buildConfig: BuildConfigInternal
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

    // tsOutDir
    let tsOutDir: string;
    let customTsOutDir: string | null = null;
    if (compilationOptions.outDir) {
        tsOutDir = path.resolve(buildConfig._outputPath, compilationOptions.outDir);
        customTsOutDir = tsOutDir;
    } else {
        if (compilerOptions.outDir) {
            tsOutDir = path.isAbsolute(compilerOptions.outDir)
                ? path.resolve(compilerOptions.outDir)
                : path.resolve(path.dirname(tsConfigPath), compilerOptions.outDir);
        } else {
            tsOutDir = buildConfig._outputPath;
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
    if (compilationOptions.esBundle || compilationOptions.umdBundle || compilationOptions.cjsBundle) {
        const sourceMap = compilerOptions.sourceMap ? true : false;
        const entryFilePath = path.resolve(tsOutDir, `${entryName}.js`);
        const defaultOutputFileName = buildConfig._packageNameWithoutScope.replace(/\//gm, '-');
        const globalsAndExternals = getExternalsAndGlobals(
            buildConfig.script || {},
            {},
            buildConfig._packageJson,
            umdIds
        );

        if (compilationOptions.esBundle) {
            const bundleOptions = typeof compilationOptions.esBundle === 'object' ? compilationOptions.esBundle : {};
            const defaultOutputFileNameWithExt = `${defaultOutputFileName}.js`;
            let bundleOutFilePath: string;
            if (bundleOptions.outputFile) {
                if (bundleOptions.outputFile.endsWith('/')) {
                    bundleOutFilePath = path.resolve(
                        buildConfig._outputPath,
                        bundleOptions.outputFile,
                        defaultOutputFileNameWithExt
                    );
                } else {
                    bundleOutFilePath = path.resolve(buildConfig._outputPath, bundleOptions.outputFile);
                }
            } else {
                let fesmFolderName: string;
                const m = esmRegExp.exec(compilationOptions.outDir || '');
                if (m != null && m.length === 2) {
                    const esmVersion = m[1];
                    fesmFolderName = `fesm${esmVersion}`;
                } else {
                    const targetSuffix = scriptTarget >= ScriptTarget.ES2015 ? '2015' : '5';
                    fesmFolderName = `fesm${targetSuffix}`;
                }

                bundleOutFilePath = path.resolve(buildConfig._outputPath, fesmFolderName, defaultOutputFileNameWithExt);
            }

            let ecma: EcmaNumber | undefined;
            if (scriptTarget >= ScriptTarget.ESNext) {
                ecma = 2020;
            } else if (scriptTarget >= ScriptTarget.ES2015) {
                ecma = (2013 + scriptTarget) as EcmaNumber;
            } else if (scriptTarget >= ScriptTarget.ES5) {
                ecma = 5;
            }

            const bundleOptionsInternal: ScriptBundleOptionsInternal = {
                moduleFormat: 'es',
                sourceMap,
                minify: false,
                ...bundleOptions,
                _entryFilePath: entryFilePath,
                _outputFilePath: bundleOutFilePath,
                _externals: globalsAndExternals.externals,
                _globals: globalsAndExternals.globals,
                _ecma: ecma,
                _umdId: umdIds[buildConfig._packageName]
            };
            bundles.push(bundleOptionsInternal);
        }

        if (compilationOptions.umdBundle) {
            const bundleOptions = typeof compilationOptions.umdBundle === 'object' ? compilationOptions.umdBundle : {};
            const defaultOutputFileNameWithExt = `${defaultOutputFileName}.umd.js`;
            let bundleOutFilePath: string;
            if (bundleOptions.outputFile) {
                if (bundleOptions.outputFile.endsWith('/')) {
                    bundleOutFilePath = path.resolve(
                        buildConfig._outputPath,
                        bundleOptions.outputFile,
                        defaultOutputFileNameWithExt
                    );
                } else {
                    bundleOutFilePath = path.resolve(buildConfig._outputPath, bundleOptions.outputFile);
                }
            } else {
                bundleOutFilePath = path.resolve(buildConfig._outputPath, 'bundles', defaultOutputFileNameWithExt);
            }

            const bundleOptionsInternal: ScriptBundleOptionsInternal = {
                moduleFormat: 'umd',
                sourceMap,
                minify: true,
                ...bundleOptions,
                _entryFilePath: entryFilePath,
                _outputFilePath: bundleOutFilePath,
                _externals: globalsAndExternals.externals,
                _globals: globalsAndExternals.globals,
                _umdId: umdIds[buildConfig._packageName]
            };
            bundles.push(bundleOptionsInternal);
        }

        if (compilationOptions.cjsBundle) {
            const bundleOptions = typeof compilationOptions.cjsBundle === 'object' ? compilationOptions.cjsBundle : {};
            const defaultOutputFileNameWithExt = `${defaultOutputFileName}.cjs.js`;
            let bundleOutFilePath: string;
            if (bundleOptions.outputFile) {
                if (bundleOptions.outputFile.endsWith('/')) {
                    bundleOutFilePath = path.resolve(
                        buildConfig._outputPath,
                        bundleOptions.outputFile,
                        defaultOutputFileNameWithExt
                    );
                } else {
                    bundleOutFilePath = path.resolve(buildConfig._outputPath, bundleOptions.outputFile);
                }
            } else {
                bundleOutFilePath = path.resolve(buildConfig._outputPath, 'bundles', defaultOutputFileNameWithExt);
            }

            const bundleOptionsInternal: ScriptBundleOptionsInternal = {
                moduleFormat: 'cjs',
                sourceMap,
                minify: true,
                ...bundleOptions,
                _entryFilePath: entryFilePath,
                _outputFilePath: bundleOutFilePath,
                _externals: globalsAndExternals.externals,
                _globals: globalsAndExternals.globals,
                _umdId: umdIds[buildConfig._packageName]
            };
            bundles.push(bundleOptionsInternal);
        }
    }

    const scriptOptions = buildConfig.script || {};
    const addToPackageJson = scriptOptions.addToPackageJson !== false ? true : false;

    // declaration
    let declaration = true;
    if (compilationOptions.declaration != null) {
        declaration = compilationOptions.declaration;
    }

    // Add  entry points to package.json
    if (addToPackageJson) {
        if (declaration) {
            AddTypingsEntryPointToPackageJson(buildConfig, entryName);
        }

        if (!compilationOptions.deleteCompilationOutDirAfterBundle) {
            const jsEntryFile = normalizePath(
                `${path.relative(buildConfig._packageJsonOutDir, path.resolve(tsOutDir, entryName))}.js`
            );

            if (
                compilerOptions.module &&
                compilerOptions.module >= ModuleKind.ES2015 &&
                scriptTarget >= ScriptTarget.ES2015
            ) {
                buildConfig._packageJsonEntryPoint.es2015 = jsEntryFile;
                buildConfig._packageJsonEntryPoint.esm2015 = jsEntryFile;

                if (
                    buildConfig._packageJsonLastModuleEntryScriptTarget == null ||
                    scriptTarget >= buildConfig._packageJsonLastModuleEntryScriptTarget
                ) {
                    buildConfig._packageJsonEntryPoint.module = jsEntryFile;
                    buildConfig._packageJsonLastModuleEntryScriptTarget = scriptTarget;
                }
            } else if (
                compilerOptions.module &&
                compilerOptions.module >= ModuleKind.ES2015 &&
                scriptTarget === ScriptTarget.ES5
            ) {
                buildConfig._packageJsonEntryPoint.esm5 = jsEntryFile;

                if (
                    buildConfig._packageJsonLastModuleEntryScriptTarget == null ||
                    scriptTarget >= buildConfig._packageJsonLastModuleEntryScriptTarget
                ) {
                    buildConfig._packageJsonEntryPoint.module = jsEntryFile;
                    buildConfig._packageJsonLastModuleEntryScriptTarget = scriptTarget;
                }
            } else if (compilerOptions.module === ModuleKind.UMD || compilerOptions.module === ModuleKind.CommonJS) {
                buildConfig._packageJsonEntryPoint.main = jsEntryFile;
            }
        }

        for (const bundleOptions of bundles) {
            const entryFileForBundle = normalizePath(
                path.relative(buildConfig._packageJsonOutDir, bundleOptions._outputFilePath)
            );

            addBundleEntryPointsToPackageJson(
                buildConfig,
                bundleOptions.moduleFormat,
                entryFileForBundle,
                scriptTarget,
                compilerOptions.module
            );
        }
    }

    return {
        ...compilationOptions,
        _tsConfigInfo: tsConfigInfo,
        _entryName: entryName,
        _scriptTarget: scriptTarget,
        _declaration: declaration,
        _tsOutDirRootResolved: tsOutDir,
        _customTsOutDir: customTsOutDir,
        _bundles: bundles
    };
}

function toScriptBundleOptionsInternal(
    bundleOptions: ScriptBundleOptions,
    tsConfigInfo: TsConfigInfo | null,
    umdIds: { [key: string]: string },
    buildConfig: BuildConfigInternal
): ScriptBundleOptionsInternal {
    const scriptOptions = buildConfig.script || {};
    if (!scriptOptions.entry) {
        throw new Error(
            `The entry file could not be detected automatically. Please set value manually in 'projects[${buildConfig._projectName}].tasks.build.script.entry'.`
        );
    }

    const projectRoot = buildConfig._projectRoot;
    const entryFilePath = path.resolve(projectRoot, scriptOptions.entry);
    let bundleOutFilePath: string;
    const defaultOuputFileName = `${path.basename(entryFilePath)}.js`;
    if (bundleOptions.outputFile) {
        if (!/\.js$/i.test(bundleOptions.outputFile)) {
            bundleOutFilePath = path.resolve(buildConfig._outputPath, bundleOptions.outputFile, defaultOuputFileName);
        } else {
            bundleOutFilePath = path.resolve(buildConfig._outputPath, bundleOptions.outputFile);
        }
    } else {
        bundleOutFilePath = path.resolve(buildConfig._outputPath, defaultOuputFileName);
    }

    // Add  entry points to package.json
    if (scriptOptions.addToPackageJson !== false) {
        const entryFileForBundle = normalizePath(path.relative(buildConfig._packageJsonOutDir, bundleOutFilePath));
        const compilerOptions = tsConfigInfo?.tsCompilerConfig.options;
        addBundleEntryPointsToPackageJson(
            buildConfig,
            bundleOptions.moduleFormat,
            entryFileForBundle,
            compilerOptions?.target,
            compilerOptions?.module
        );
    }

    const globalsAndExternals = getExternalsAndGlobals(scriptOptions, bundleOptions, buildConfig._packageJson, umdIds);

    let ecma: EcmaNumber | undefined;
    if (tsConfigInfo && tsConfigInfo.tsCompilerConfig.options.target) {
        const scriptTarget = tsConfigInfo.tsCompilerConfig.options.target;
        if (scriptTarget >= ScriptTarget.ESNext) {
            ecma = 2020;
        } else if (scriptTarget >= ScriptTarget.ES2015) {
            ecma = (2013 + scriptTarget) as EcmaNumber;
        } else if (scriptTarget >= ScriptTarget.ES5) {
            ecma = 5;
        }
    }

    return {
        ...bundleOptions,
        _entryFilePath: entryFilePath,
        _outputFilePath: bundleOutFilePath,
        _externals: globalsAndExternals.externals,
        _globals: globalsAndExternals.globals,
        _ecma: ecma,
        _umdId: umdIds[buildConfig._packageName]
    };
}

function getExternalsAndGlobals(
    scriptOptions: ScriptOptions,
    bundleOptions: Partial<ScriptBundleOptions>,
    packageJson: PackageJsonLike,
    umdIds: { [key: string]: string }
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
        if (buildInExternals == null) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
            buildInExternals = require('builtins')() as string[];
        }

        buildInExternals
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
                    const globalVar = getUmdGlobalVariable(e, umdIds);
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
                    const globalVar = getUmdGlobalVariable(e, umdIds);
                    if (globalVar) {
                        globals[e] = globalVar;
                    }
                }
            });
    }

    if (externals.includes('rxjs') && !externals.includes('rxjs/operators')) {
        globals['rxjs/operators'] = 'rxjs.operators';
        externals.push('rxjs/operators');
    }

    return {
        externals,
        globals
    };
}

function addBundleEntryPointsToPackageJson(
    buildConfig: BuildConfigInternal,
    moduleFormat: ScriptBundleModuleKind,
    jsEntryFile: string,
    scriptTarget?: ScriptTarget,
    moduleKind?: ModuleKind
): void {
    if (moduleFormat === 'es') {
        if (moduleKind && moduleKind >= ModuleKind.ES2015 && scriptTarget && scriptTarget >= ScriptTarget.ES2015) {
            buildConfig._packageJsonEntryPoint.fesm2015 = jsEntryFile;
            buildConfig._packageJsonEntryPoint.es2015 = jsEntryFile;

            if (
                buildConfig._packageJsonLastModuleEntryScriptTarget == null ||
                scriptTarget >= buildConfig._packageJsonLastModuleEntryScriptTarget
            ) {
                buildConfig._packageJsonEntryPoint.module = jsEntryFile;
                buildConfig._packageJsonLastModuleEntryScriptTarget = scriptTarget;
            }
        } else if (moduleKind && moduleKind >= ModuleKind.ES2015 && scriptTarget && scriptTarget === ScriptTarget.ES5) {
            buildConfig._packageJsonEntryPoint.fesm5 = jsEntryFile;

            if (
                buildConfig._packageJsonLastModuleEntryScriptTarget == null ||
                scriptTarget >= buildConfig._packageJsonLastModuleEntryScriptTarget
            ) {
                buildConfig._packageJsonEntryPoint.module = jsEntryFile;
                buildConfig._packageJsonLastModuleEntryScriptTarget = scriptTarget;
            }
        }
    } else {
        buildConfig._packageJsonEntryPoint.main = jsEntryFile;
    }
}

function AddTypingsEntryPointToPackageJson(buildConfig: BuildConfigInternal, entryName: string): void {
    if (buildConfig._nestedPackage) {
        buildConfig._packageJsonEntryPoint.typings = normalizePath(
            path.relative(buildConfig._packageJsonOutDir, path.join(buildConfig._outputPath, `${entryName}.d.ts`))
        );
    } else {
        buildConfig._packageJsonEntryPoint.typings = `${entryName}.d.ts`;
    }
}
