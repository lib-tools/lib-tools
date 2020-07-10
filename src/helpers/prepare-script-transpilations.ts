/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as ts from 'typescript';

import { ScriptTargetString, ScriptTranspilationEntry } from '../models';
import { BuildActionInternal, ScriptTranspilationEntryInternal } from '../models/internals';
import { findUp, isInFolder, isSamePaths, normalizePath } from '../utils';

import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
import { readTsConfigFile } from './read-ts-config-file';
import { toTsScriptTarget } from './to-ts-script-target';

export async function prepareScriptTranspilations(buildAction: BuildActionInternal, auto?: boolean): Promise<void> {
    const workspaceRoot = buildAction._workspaceRoot;
    const projectRoot = buildAction._projectRoot;
    const projectName = buildAction._projectName;

    // tsconfig.json
    if (
        buildAction.scriptTranspilation &&
        typeof buildAction.scriptTranspilation === 'object' &&
        buildAction.scriptTranspilation.tsConfig
    ) {
        const tsConfigPath = path.resolve(projectRoot, buildAction.scriptTranspilation.tsConfig);
        buildAction._tsConfigPath = tsConfigPath;
        buildAction._tsConfigJson = readTsConfigFile(tsConfigPath);
        buildAction._tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
    }

    if (
        buildAction.scriptTranspilation &&
        typeof buildAction.scriptTranspilation === 'object' &&
        buildAction.scriptTranspilation.entries
    ) {
        const entries = buildAction.scriptTranspilation.entries;
        for (let i = 0; i < entries.length; i++) {
            const transpilationEntry = entries[i];
            let tsConfigPath = '';
            if (buildAction._tsConfigPath) {
                tsConfigPath = buildAction._tsConfigPath;
            } else if (i > 0 && buildAction._scriptTranspilationEntries[i - 1]._tsConfigPath) {
                tsConfigPath = buildAction._scriptTranspilationEntries[i - 1]._tsConfigPath;
            } else if (i === 0) {
                const foundTsConfigPath = await detectTsConfigPath(workspaceRoot, projectRoot);
                if (foundTsConfigPath) {
                    tsConfigPath = foundTsConfigPath;
                }
            }

            if (!tsConfigPath) {
                throw new Error(
                    `Typescript configuration file could not be detected automatically, set it manually in 'projects[${projectName}].scriptTranspilation.tsConfig'.`
                );
            }

            const scriptTranspilationEntry = await toTranspilationEntryInternal(
                tsConfigPath,
                transpilationEntry,
                1,
                buildAction
            );
            buildAction._scriptTranspilationEntries.push(scriptTranspilationEntry);
        }
    } else if (buildAction.scriptTranspilation || auto) {
        let tsConfigPath: string | null = null;
        if (buildAction._tsConfigPath) {
            tsConfigPath = buildAction._tsConfigPath;
        } else {
            tsConfigPath = await detectTsConfigPath(workspaceRoot, projectRoot);
        }

        if (!tsConfigPath) {
            if (auto) {
                return;
            }

            throw new Error(
                `Typescript configuration file could not be detected automatically, set it manually in 'projects[${projectName}].scriptTranspilation.tsConfig'.`
            );
        }

        const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
        if (tsCompilerConfig.options.target && tsCompilerConfig.options.target > ts.ScriptTarget.ES2015) {
            const esSuffix =
                tsCompilerConfig.options.target >= ts.ScriptTarget.ESNext
                    ? 'Next'
                    : `${2013 + tsCompilerConfig.options.target}`;
            const esmTranspilation = await toTranspilationEntryInternal(
                tsConfigPath,
                {
                    target: `es${esSuffix}` as ScriptTargetString,
                    outDir: `esm${esSuffix}`
                },
                0,
                buildAction
            );
            buildAction._scriptTranspilationEntries.push(esmTranspilation);
        } else {
            const esm2015Transpilation = await toTranspilationEntryInternal(
                tsConfigPath,
                {
                    target: 'es2015',
                    outDir: 'esm2015'
                },
                0,
                buildAction
            );
            buildAction._scriptTranspilationEntries.push(esm2015Transpilation);
        }

        const esm5Transpilation = await toTranspilationEntryInternal(
            tsConfigPath,
            {
                target: 'es5',
                outDir: 'esm5',
                declaration: false
            },
            1,
            buildAction
        );
        buildAction._scriptTranspilationEntries.push(esm5Transpilation);
    }
}

async function toTranspilationEntryInternal(
    tsConfigPath: string,
    transpilationEntry: ScriptTranspilationEntry,
    i: number,
    buildAction: BuildActionInternal
): Promise<ScriptTranspilationEntryInternal> {
    const tsConfigJson = readTsConfigFile(tsConfigPath);
    const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
    const compilerOptions = tsCompilerConfig.options;

    // scriptTarget
    let scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES2017;
    if (transpilationEntry.target) {
        const tsScriptTarget = toTsScriptTarget(transpilationEntry.target);
        if (tsScriptTarget == null) {
            throw new Error(
                `Invalid script target value. Config location projects[${buildAction._projectName}].scriptTranspilation.entries[${i}].`
            );
        }

        scriptTarget = tsScriptTarget;
    } else if (compilerOptions.target) {
        scriptTarget = compilerOptions.target;
    }

    // declaration
    let declaration = true;
    if (transpilationEntry.declaration != null) {
        declaration = transpilationEntry.declaration;
    } else if (compilerOptions.declaration != null) {
        declaration = compilerOptions.declaration;
    }

    // tsOutDir
    let tsOutDir: string;
    let customTsOutDir: string | null = null;
    if (transpilationEntry.outDir) {
        tsOutDir = path.resolve(buildAction._outputPath, transpilationEntry.outDir);
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

    // Detect entry file
    let detectedEntryName: string | null = null;
    const flatModuleOutFile =
        buildAction._tsConfigJson &&
        buildAction._tsConfigJson.angularCompilerOptions &&
        buildAction._tsConfigJson.angularCompilerOptions.flatModuleOutFile
            ? buildAction._tsConfigJson.angularCompilerOptions.flatModuleOutFile
            : null;
    if (flatModuleOutFile) {
        detectedEntryName = flatModuleOutFile.replace(/\.js$/i, '');
    } else {
        const testName1 = buildAction._packageNameWithoutScope.replace(/\//gm, '-');
        const testName2 = buildAction._packageNameWithoutScope
            .substr(buildAction._packageNameWithoutScope.lastIndexOf('/') + 1)
            .replace(/\//gm, '-');

        const tsSrcDir = path.dirname(tsConfigPath);
        if (await pathExists(path.resolve(tsSrcDir, 'index.ts'))) {
            detectedEntryName = 'index';
        } else if (await pathExists(path.resolve(tsSrcDir, testName1 + '.ts'))) {
            detectedEntryName = testName1;
        } else if (await pathExists(path.resolve(tsSrcDir, testName2 + '.ts'))) {
            detectedEntryName = testName2;
        } else if (await pathExists(path.resolve(tsSrcDir, 'main.ts'))) {
            detectedEntryName = 'main';
        } else if (await pathExists(path.resolve(tsSrcDir, 'public_api.ts'))) {
            detectedEntryName = 'public_api';
        } else if (await pathExists(path.resolve(tsSrcDir, 'public-api.ts'))) {
            detectedEntryName = 'public-api';
        }
    }

    // Add  entry points to package.json
    if (
        detectedEntryName &&
        buildAction.scriptTranspilation !== false &&
        (buildAction.scriptTranspilation == null ||
            (typeof buildAction.scriptTranspilation === 'object' &&
                buildAction.scriptTranspilation.addToPackageJson !== false))
    ) {
        const jsEntryFile = normalizePath(
            `${path.relative(buildAction._packageJsonOutDir, path.resolve(tsOutDir, detectedEntryName))}.js`
        );

        if (
            compilerOptions.module &&
            compilerOptions.module >= ts.ModuleKind.ES2015 &&
            scriptTarget > ts.ScriptTarget.ES2015
        ) {
            let esYear: string;
            if (scriptTarget === ts.ScriptTarget.ESNext) {
                if (
                    compilerOptions.module === ts.ModuleKind.ES2020 ||
                    compilerOptions.module === ts.ModuleKind.ESNext
                ) {
                    esYear = '2020';
                } else {
                    esYear = '2015';
                }
            } else {
                esYear = `${2013 + scriptTarget}`;
            }

            buildAction._packageJsonEntryPoint[`es${esYear}`] = jsEntryFile;
            if (esYear === '2015') {
                // (Angular) It is deprecated as of v9, might be removed in the future.
                buildAction._packageJsonEntryPoint[`esm${esYear}`] = jsEntryFile;
            }
            buildAction._packageJsonEntryPoint.module = jsEntryFile;
        } else if (
            compilerOptions.module &&
            compilerOptions.module >= ts.ModuleKind.ES2015 &&
            scriptTarget === ts.ScriptTarget.ES2015
        ) {
            buildAction._packageJsonEntryPoint.es2015 = jsEntryFile;
            // (Angular) It is deprecated as of v9, might be removed in the future.
            buildAction._packageJsonEntryPoint.esm2015 = jsEntryFile;
            buildAction._packageJsonEntryPoint.module = jsEntryFile;
        } else if (
            compilerOptions.module &&
            compilerOptions.module >= ts.ModuleKind.ES2015 &&
            scriptTarget === ts.ScriptTarget.ES5
        ) {
            buildAction._packageJsonEntryPoint.esm5 = jsEntryFile;
            buildAction._packageJsonEntryPoint.module = jsEntryFile;
        } else if (compilerOptions.module === ts.ModuleKind.UMD || compilerOptions.module === ts.ModuleKind.CommonJS) {
            buildAction._packageJsonEntryPoint.main = jsEntryFile;
        }

        if (declaration) {
            // TODO: To review
            if (buildAction._nestedPackage) {
                const typingEntryName = buildAction._packageNameWithoutScope.substr(
                    buildAction._packageNameWithoutScope.lastIndexOf('/') + 1
                );

                // TODO: To check
                // buildAction._packageJsonEntryPoint.typings = typingsEntryFileRel; ?
                buildAction._packageJsonEntryPoint.typings = normalizePath(
                    path.relative(
                        buildAction._packageJsonOutDir,
                        path.join(buildAction._outputPath, `${typingEntryName}.d.ts`)
                    )
                );
            } else {
                buildAction._packageJsonEntryPoint.typings = `${detectedEntryName}.d.ts`;
            }
        }
    }

    return {
        ...transpilationEntry,
        _index: i,
        _scriptTarget: scriptTarget,
        _tsConfigPath: tsConfigPath,
        _tsConfigJson: tsConfigJson,
        _tsCompilerConfig: tsCompilerConfig,
        _declaration: declaration,
        _tsOutDirRootResolved: tsOutDir,
        _detectedEntryName: detectedEntryName,
        _customTsOutDir: customTsOutDir
    };
}

async function detectTsConfigPath(workspaceRoot: string, projectRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig.build.json', 'tsconfig-build.json', 'tsconfig.lib.json', 'tsconfig-lib.json', 'tsconfig.json'],
        projectRoot,
        workspaceRoot
    );
}
