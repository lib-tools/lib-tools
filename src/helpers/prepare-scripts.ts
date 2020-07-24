import * as path from 'path';

import { pathExists } from 'fs-extra';
import { ModuleKind, ScriptTarget } from 'typescript';

import {
    ScriptBundleModuleKind,
    ScriptBundleOptions,
    ScriptCompilationOptions,
    ScriptOptions,
    ScriptTargetString
} from '../models';
import {
    BuildActionInternal,
    EcmaNumber,
    PackageJsonLike,
    ScriptBundleOptionsInternal,
    ScriptCompilationOptionsInternal,
    TsConfigInfo
} from '../models/internals';
import { isInFolder, isSamePaths, normalizePath } from '../utils';

import { dashCaseToCamelCase } from './dash-case-to-camel-case';
import { detectTsconfigPath } from './detect-tsconfig-path';
import { detectTsEntryName } from './detect-ts-entry-name';
import { getCachedTsconfigJson } from './get-cached-tsconfig-json';
import { getUmdGlobalVariable } from './get-umd-global-Variable';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
import { toTsScriptTarget } from './to-ts-script-target';

const esmRegExp = /\/?f?esm?(5|20[1-2][0-9])\/?/i;

let buildInExternals: string[] | null = null;

export async function prepareScripts(buildAction: BuildActionInternal): Promise<void> {
    const workspaceRoot = buildAction._workspaceRoot;
    const projectRoot = buildAction._projectRoot;
    const projectName = buildAction._projectName;
    const compilations: ScriptCompilationOptionsInternal[] = [];
    const bundles: ScriptBundleOptionsInternal[] = [];
    let tsConfigPath: string | null = null;
    let tsConfigInfo: TsConfigInfo | null = null;

    if (buildAction.script && buildAction.script.tsConfig) {
        tsConfigPath = path.resolve(projectRoot, buildAction.script.tsConfig);
        if (!tsConfigPath) {
            throw new Error(
                `The tsConfig file ${tsConfigPath} doesn't exist. Please correct value in 'projects[${projectName}].actions.build.script.tsConfig'.`
            );
        }
    } else if (buildAction.script) {
        tsConfigPath = await detectTsconfigPath(workspaceRoot, projectRoot);
    }

    if (tsConfigPath) {
        const tsConfigJson = getCachedTsconfigJson(tsConfigPath);
        const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
        tsConfigInfo = {
            tsConfigPath,
            tsConfigJson,
            tsCompilerConfig
        };
    }

    let entryName: string | null = null;
    if (buildAction.script && buildAction.script.entry) {
        entryName = normalizePath(buildAction.script.entry).replace(/\.(ts|js)$/i, '');
    } else if (tsConfigInfo) {
        entryName = await detectTsEntryName(tsConfigInfo, buildAction._packageNameWithoutScope);
    }

    const umdIds: { [key: string]: string } = {};
    if (buildAction.script?.umdId) {
        umdIds[buildAction._packageName] = buildAction.script?.umdId;
    } else {
        const normalizedValue = buildAction._packageName.replace(/\//g, '.');
        const umdId = dashCaseToCamelCase(normalizedValue);
        umdIds[buildAction._packageName] = umdId;
    }

    if (buildAction.script && buildAction.script.compilations) {
        if (!tsConfigPath || !tsConfigInfo) {
            throw new Error(
                `Typescript configuration file could not be detected automatically. Please set value manually in 'projects[${projectName}].actions.build.script.tsConfig'.`
            );
        }

        if (!entryName) {
            throw new Error(
                `The entry file could not be detected automatically. Please set value manually in 'projects[${projectName}].actions.build.script.entry'.`
            );
        }

        if (Array.isArray(buildAction.script.compilations)) {
            for (const compilation of buildAction.script.compilations) {
                const compilationInternal = toScriptCompilationOptionsInternal(
                    compilation,
                    entryName,
                    tsConfigInfo,
                    umdIds,
                    buildAction
                );
                compilations.push(compilationInternal);
            }
        } else if (buildAction.script.compilations === 'auto') {
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
                        outDir: 'esm2015',
                        declaration: true,
                        esBundle: true,
                        umdBundle: true
                    },
                    entryName,
                    tsConfigInfo,
                    umdIds,
                    buildAction
                );
                compilations.push(esmScriptCompilation);
            } else {
                const esm5ScriptCompilation = toScriptCompilationOptionsInternal(
                    {
                        target: 'es5',
                        outDir: 'esm5',
                        declaration: false,
                        esBundle: true,
                        umdBundle: true
                    },
                    entryName,
                    tsConfigInfo,
                    umdIds,
                    buildAction
                );
                compilations.push(esm5ScriptCompilation);
            }
        }
    }

    if (buildAction.script && buildAction.script.bundles) {
        if (
            !buildAction._packageJsonEntryPoint.typings &&
            entryName &&
            tsConfigInfo &&
            tsConfigInfo.tsCompilerConfig.options.declaration &&
            buildAction.script.entry &&
            /\.tsx?$/i.test(buildAction.script.entry)
        ) {
            AddTypingsEntryPointToPackageJson(buildAction, entryName);
        }

        for (const bundleOptions of buildAction.script.bundles) {
            const bundleOptionsInternal = toScriptBundleOptionsInternal(
                bundleOptions,
                tsConfigInfo,
                umdIds,
                buildAction
            );
            bundles.push(bundleOptionsInternal);
        }
    }

    let typescriptModulePath: string | null = null;
    if (
        buildAction._nodeModulesPath &&
        pathExists(path.resolve(buildAction._nodeModulesPath, 'typescript', 'package.json'))
    ) {
        typescriptModulePath = path.resolve(buildAction._nodeModulesPath, 'typescript');
    }

    buildAction._script = {
        ...buildAction.script,
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
    if (compilationOptions.esBundle || compilationOptions.umdBundle || compilationOptions.cjsBundle) {
        const sourceMap = compilerOptions.sourceMap ? true : false;
        const entryFilePath = path.resolve(tsOutDir, `${entryName}.js`);
        const defaultOutputFileName = buildAction._packageNameWithoutScope.replace(/\//gm, '-');
        const globalsAndExternals = getExternalsAndGlobals(
            buildAction.script || {},
            {},
            buildAction._packageJson,
            umdIds
        );

        if (compilationOptions.esBundle) {
            const bundleOptions = typeof compilationOptions.esBundle === 'object' ? compilationOptions.esBundle : {};
            const defaultOutputFileNameWithExt = `${defaultOutputFileName}.js`;
            let bundleOutFilePath: string;
            if (bundleOptions.outputFile) {
                if (bundleOptions.outputFile.endsWith('/')) {
                    bundleOutFilePath = path.resolve(
                        buildAction._outputPath,
                        bundleOptions.outputFile,
                        defaultOutputFileNameWithExt
                    );
                } else {
                    bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOptions.outputFile);
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

                bundleOutFilePath = path.resolve(buildAction._outputPath, fesmFolderName, defaultOutputFileNameWithExt);
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
                _umdId: umdIds[buildAction._packageName]
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
                        buildAction._outputPath,
                        bundleOptions.outputFile,
                        defaultOutputFileNameWithExt
                    );
                } else {
                    bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOptions.outputFile);
                }
            } else {
                bundleOutFilePath = path.resolve(buildAction._outputPath, 'bundles', defaultOutputFileNameWithExt);
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
                _umdId: umdIds[buildAction._packageName]
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
                        buildAction._outputPath,
                        bundleOptions.outputFile,
                        defaultOutputFileNameWithExt
                    );
                } else {
                    bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOptions.outputFile);
                }
            } else {
                bundleOutFilePath = path.resolve(buildAction._outputPath, 'bundles', defaultOutputFileNameWithExt);
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
                _umdId: umdIds[buildAction._packageName]
            };
            bundles.push(bundleOptionsInternal);
        }
    }

    const scriptOptions = buildAction.script || {};
    const addToPackageJson = scriptOptions.addToPackageJson !== false ? true : false;

    // Add  entry points to package.json
    if (addToPackageJson) {
        if (declaration) {
            AddTypingsEntryPointToPackageJson(buildAction, entryName);
        }

        const jsEntryFile = normalizePath(
            `${path.relative(buildAction._packageJsonOutDir, path.resolve(tsOutDir, entryName))}.js`
        );

        if (
            compilerOptions.module &&
            compilerOptions.module >= ModuleKind.ES2015 &&
            scriptTarget >= ScriptTarget.ES2015
        ) {
            buildAction._packageJsonEntryPoint.es2015 = jsEntryFile;
            buildAction._packageJsonEntryPoint.esm2015 = jsEntryFile;

            if (
                buildAction._packageJsonLastModuleEntryScriptTarget == null ||
                scriptTarget >= buildAction._packageJsonLastModuleEntryScriptTarget
            ) {
                buildAction._packageJsonEntryPoint.module = jsEntryFile;
                buildAction._packageJsonLastModuleEntryScriptTarget = scriptTarget;
            }
        } else if (
            compilerOptions.module &&
            compilerOptions.module >= ModuleKind.ES2015 &&
            scriptTarget === ScriptTarget.ES5
        ) {
            buildAction._packageJsonEntryPoint.esm5 = jsEntryFile;

            if (
                buildAction._packageJsonLastModuleEntryScriptTarget == null ||
                scriptTarget >= buildAction._packageJsonLastModuleEntryScriptTarget
            ) {
                buildAction._packageJsonEntryPoint.module = jsEntryFile;
                buildAction._packageJsonLastModuleEntryScriptTarget = scriptTarget;
            }
        } else if (compilerOptions.module === ModuleKind.UMD || compilerOptions.module === ModuleKind.CommonJS) {
            buildAction._packageJsonEntryPoint.main = jsEntryFile;
        }

        for (const bundleOptions of bundles) {
            const entryFileForBundle = normalizePath(
                path.relative(buildAction._packageJsonOutDir, bundleOptions._outputFilePath)
            );

            addBundleEntryPointsToPackageJson(
                buildAction,
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
    buildAction: BuildActionInternal
): ScriptBundleOptionsInternal {
    const scriptOptions = buildAction.script || {};
    if (!scriptOptions.entry) {
        throw new Error(
            `The entry file could not be detected automatically. Please set value manually in 'projects[${buildAction._projectName}].actions.build.script.entry'.`
        );
    }

    const projectRoot = buildAction._projectRoot;
    const entryFilePath = path.resolve(projectRoot, scriptOptions.entry);
    let bundleOutFilePath: string;
    const defaultOuputFileName = `${path.basename(entryFilePath)}.js`;
    if (bundleOptions.outputFile) {
        if (!/\.js$/i.test(bundleOptions.outputFile)) {
            bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOptions.outputFile, defaultOuputFileName);
        } else {
            bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOptions.outputFile);
        }
    } else {
        bundleOutFilePath = path.resolve(buildAction._outputPath, defaultOuputFileName);
    }

    // Add  entry points to package.json
    if (scriptOptions.addToPackageJson !== false) {
        const entryFileForBundle = normalizePath(path.relative(buildAction._packageJsonOutDir, bundleOutFilePath));
        const compilerOptions = tsConfigInfo?.tsCompilerConfig.options;
        addBundleEntryPointsToPackageJson(
            buildAction,
            bundleOptions.moduleFormat,
            entryFileForBundle,
            compilerOptions?.target,
            compilerOptions?.module
        );
    }

    const globalsAndExternals = getExternalsAndGlobals(scriptOptions, bundleOptions, buildAction._packageJson, umdIds);

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
        _umdId: umdIds[buildAction._packageName]
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
    buildAction: BuildActionInternal,
    moduleFormat: ScriptBundleModuleKind,
    jsEntryFile: string,
    scriptTarget?: ScriptTarget,
    moduleKind?: ModuleKind
): void {
    if (moduleFormat === 'es') {
        if (moduleKind && moduleKind >= ModuleKind.ES2015 && scriptTarget && scriptTarget >= ScriptTarget.ES2015) {
            buildAction._packageJsonEntryPoint.fesm2015 = jsEntryFile;
            buildAction._packageJsonEntryPoint.es2015 = jsEntryFile;

            if (
                buildAction._packageJsonLastModuleEntryScriptTarget == null ||
                scriptTarget >= buildAction._packageJsonLastModuleEntryScriptTarget
            ) {
                buildAction._packageJsonEntryPoint.module = jsEntryFile;
                buildAction._packageJsonLastModuleEntryScriptTarget = scriptTarget;
            }
        } else if (moduleKind && moduleKind >= ModuleKind.ES2015 && scriptTarget && scriptTarget === ScriptTarget.ES5) {
            buildAction._packageJsonEntryPoint.fesm5 = jsEntryFile;

            if (
                buildAction._packageJsonLastModuleEntryScriptTarget == null ||
                scriptTarget >= buildAction._packageJsonLastModuleEntryScriptTarget
            ) {
                buildAction._packageJsonEntryPoint.module = jsEntryFile;
                buildAction._packageJsonLastModuleEntryScriptTarget = scriptTarget;
            }
        }
    } else {
        buildAction._packageJsonEntryPoint.main = jsEntryFile;
    }
}

function AddTypingsEntryPointToPackageJson(buildAction: BuildActionInternal, entryName: string): void {
    if (buildAction._nestedPackage) {
        // TODO: To check
        buildAction._packageJsonEntryPoint.typings = normalizePath(
            path.relative(buildAction._packageJsonOutDir, path.join(buildAction._outputPath, `${entryName}.d.ts`))
        );
    } else {
        buildAction._packageJsonEntryPoint.typings = `${entryName}.d.ts`;
    }
}
