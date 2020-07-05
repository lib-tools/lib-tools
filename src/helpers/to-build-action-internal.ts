/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { pathExists, readFile } from 'fs-extra';
import * as ts from 'typescript';

import { AssetEntry, BuildAction, ScriptTranspilationEntry, StyleEntry } from '../models';
import {
    BuildActionInternal,
    BuildOptionsInternal,
    PackageJsonLike,
    ProjectConfigInternal,
    ScriptBundleEntryInternal,
    ScriptTranspilationEntryInternal,
    StyleParsedEntry
} from '../models/internals';
import { findUp, isInFolder, isSamePaths, normalizeRelativePath } from '../utils';

import { applyEnvOverrides } from './apply-env-overrides';
import { findPackageJsonPath } from './find-package-json-path';
import { findNodeModulesPath } from './find-node-modules-path';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
import { readPackageJson } from './read-package-json';
import { readTsConfigFile } from './read-ts-config-file';
import { toTsScriptTarget } from './to-ts-script-target';

const versionPlaceholderRegex = /0\.0\.0-PLACEHOLDER/i;
const supportedStyleInputExt = /\.(sass|scss|css)$/i;
const supportedStyleOutputExt = /\.css$/i;

export async function toBuildActionInternal(
    projectConfig: ProjectConfigInternal,
    buildOptions: BuildOptionsInternal
): Promise<BuildActionInternal> {
    if (!projectConfig.actions || !projectConfig.actions.build) {
        throw new Error('No build actions in configuration.');
    }

    const buildAction = JSON.parse(JSON.stringify(projectConfig.actions.build)) as BuildAction;
    const configPath = projectConfig._configPath;
    const workspaceRoot = projectConfig._workspaceRoot;
    const projectRoot = projectConfig._projectRoot;
    const projectName = projectConfig._projectName;

    // apply env
    applyEnvOverrides(buildAction, buildOptions.environment);

    const packageJsonPath = await findPackageJsonPath(workspaceRoot, projectRoot);
    if (!packageJsonPath) {
        throw new Error('Could not detect package.json file.');
    }
    const packageJson = await readPackageJson(packageJsonPath);

    const rootPackageJsonPath = await findPackageJsonPath(workspaceRoot);
    let rootPackageJson: PackageJsonLike | null = null;
    if (rootPackageJsonPath) {
        rootPackageJson = await readPackageJson(rootPackageJsonPath);
    }

    const packageName = packageJson.name;
    const slashIndex = packageName.indexOf('/');
    let packageScope: string | null = null;
    let packageNameWithoutScope = packageName;

    if (slashIndex > -1 && packageName.startsWith('@')) {
        packageScope = packageName.substr(0, slashIndex);
        packageNameWithoutScope = packageName.substr(slashIndex + 1);
    }
    const privatePackage = packageJson.private ? true : false;

    let packageVersion: string;
    if (buildOptions.version) {
        packageVersion = buildOptions.version;
    } else {
        if (
            !packageJson ||
            !packageJson.version ||
            packageJson.version === '0.0.0' ||
            versionPlaceholderRegex.test(packageJson.version)
        ) {
            if (rootPackageJson && rootPackageJson.version) {
                packageVersion = rootPackageJson.version;
            } else {
                throw new Error('The package version could not be detected.');
            }
        } else {
            packageVersion = packageJson.version;
        }
    }

    let nestedPackage = false;

    if (packageName.split('/').length > 2 || (!packageName.startsWith('@') && packageName.split('/').length >= 2)) {
        nestedPackage = true;
    }

    let outputPathAbs: string | null = null;

    if (buildAction.outputPath) {
        const configErrorLocation = `projects[${projectName}].outputPath`;
        if (path.isAbsolute(buildAction.outputPath)) {
            throw new Error(`The '${configErrorLocation}' must be relative path.`);
        }

        outputPathAbs = path.resolve(projectRoot, buildAction.outputPath);

        if (isSamePaths(workspaceRoot, outputPathAbs)) {
            throw new Error(`The '${configErrorLocation}' must not be the same as workspace root directory.`);
        }

        if (isSamePaths(projectRoot, outputPathAbs)) {
            throw new Error(`The '${configErrorLocation}' must not be the same as project root directory.`);
        }

        if (outputPathAbs === path.parse(outputPathAbs).root) {
            throw new Error(`The '${configErrorLocation}' must not be the same as system root directory.`);
        }

        const projectRootRoot = path.parse(projectRoot).root;
        if (outputPathAbs === projectRootRoot) {
            throw new Error(`The '${configErrorLocation}' must not be the same as system root directory.`);
        }

        if (isInFolder(outputPathAbs, workspaceRoot)) {
            throw new Error(
                `The workspace root folder must not be inside output directory. Change outputPath in 'projects[${projectName}].outputPath'.`
            );
        }

        if (isInFolder(outputPathAbs, projectRoot)) {
            throw new Error(
                `The project root folder must not be inside output directory. Change outputPath in 'projects[${projectName}].outputPath'.`
            );
        }
    } else {
        const tempOutputPath = path.resolve(projectRoot, `dist/packages/${packageNameWithoutScope}`);
        if (
            !isSamePaths(workspaceRoot, tempOutputPath) &&
            !isSamePaths(projectRoot, tempOutputPath) &&
            !isInFolder(tempOutputPath, workspaceRoot) &&
            !isInFolder(tempOutputPath, projectRoot)
        ) {
            outputPathAbs = tempOutputPath;
        }
    }

    if (!outputPathAbs) {
        throw new Error(
            `The outputPath could not be automatically detected. Set value in 'projects[${projectName}].outputPath' manually.`
        );
    }

    let packageJsonOutDir: string;
    if (nestedPackage) {
        const nestedPath = packageNameWithoutScope.substr(packageNameWithoutScope.indexOf('/') + 1);
        packageJsonOutDir = path.resolve(outputPathAbs, nestedPath);
    } else {
        packageJsonOutDir = outputPathAbs;
    }

    let copyAssets: (string | AssetEntry)[] | null = null;
    if (buildAction.copy && Array.isArray(buildAction.copy)) {
        copyAssets = buildAction.copy;
    } else if (buildAction.copy == null || buildAction.copy !== false) {
        const filesToCopy: string[] = [];
        const foundReadMeFile = await findUp(['README.md'], projectRoot, workspaceRoot);
        if (foundReadMeFile) {
            filesToCopy.push(path.relative(projectRoot, foundReadMeFile));
        }
        const foundLicenseFile = await findUp(['LICENSE', 'LICENSE.txt'], projectRoot, workspaceRoot);
        if (foundLicenseFile) {
            filesToCopy.push(path.relative(projectRoot, foundLicenseFile));
        }

        copyAssets = filesToCopy;
    }

    const nodeModulesPath = await findNodeModulesPath(workspaceRoot);

    const buildActionInternal: BuildActionInternal = {
        ...buildAction,
        _configPath: configPath,
        _workspaceRoot: workspaceRoot,
        _nodeModulesPath: nodeModulesPath,
        _projectRoot: projectRoot,
        _projectName: projectName,
        _outputPath: outputPathAbs,
        _packageJsonPath: packageJsonPath,
        _packageJson: packageJson,
        _packageName: packageName,
        _packageNameWithoutScope: packageNameWithoutScope,
        _packageVersion: packageVersion,
        _privatePackage: privatePackage,
        _nestedPackage: nestedPackage,
        _packageScope: packageScope,
        _rootPackageJsonPath: rootPackageJsonPath,
        _rootPackageJson: rootPackageJson,
        _copyAssets: copyAssets,
        _packageJsonOutDir: packageJsonOutDir
    };

    // Styles
    if (
        buildActionInternal.style &&
        buildActionInternal.style.entries &&
        buildActionInternal.style.entries.length > 0
    ) {
        buildActionInternal._styleParsedEntries = parseStyleEntries(
            buildActionInternal.style.entries,
            buildActionInternal,
            projectRoot,
            outputPathAbs
        );
    }

    // Script transpilations
    await prepareScriptTranspilations(buildActionInternal);

    // Bundles
    prepareScriptBundles(buildActionInternal);

    if (buildAction.scriptBundle && typeof buildAction.scriptBundle === 'object' && buildAction.scriptBundle.banner) {
        const bannerText = await getBannerText(
            workspaceRoot,
            projectRoot,
            projectName,
            packageName,
            packageVersion,
            buildAction.scriptBundle.banner
        );

        buildActionInternal._bannerText = bannerText;
    }

    return buildActionInternal;
}

async function getBannerText(
    workspaceRoot: string,
    projectRoot: string,
    projectName: string,
    packageName: string,
    packageVersion: string,
    banner: string
): Promise<string> {
    let bannerText = banner;

    if (/\.txt$/i.test(bannerText)) {
        const bannerFilePath = await findUp(bannerText, projectRoot, workspaceRoot);
        if (bannerFilePath) {
            bannerText = await readFile(bannerFilePath, 'utf-8');
        } else {
            throw new Error(
                `The banner text file: ${path.resolve(
                    projectRoot,
                    bannerText
                )} doesn't exist, please correct value in 'projects[${projectName}].banner'.`
            );
        }
    }

    if (!bannerText) {
        return bannerText;
    }

    bannerText = addCommentToBanner(bannerText);
    bannerText = replaceTokensForBanner(bannerText, packageName, packageVersion);

    return bannerText;
}

function addCommentToBanner(banner: string): string {
    if (banner.trim().startsWith('/')) {
        return banner;
    }

    const commentLines: string[] = [];
    const bannerLines = banner.split('\n');
    for (let i = 0; i < bannerLines.length; i++) {
        if (bannerLines[i] === '' || bannerLines[i] === '\r') {
            continue;
        }

        const bannerText = bannerLines[i].trim();
        if (i === 0) {
            commentLines.push('/**');
        }
        commentLines.push(` * ${bannerText}`);
    }
    commentLines.push(' */');
    banner = commentLines.join('\n');

    return banner;
}

function replaceTokensForBanner(input: string, packageName: string, packageVersion: string): string {
    let str = input.replace(/[$|[]CURRENT[_-]?YEAR[$|\]]/gim, new Date().getFullYear().toString());

    if (packageName) {
        str = str.replace(/[$|[](PROJECT|PACKAGE)[_-]?NAME[$|\]]/gim, packageName);
    }

    if (packageVersion) {
        str = str.replace(/[$|[](PROJECT|PACKAGE)?[_-]?VERSION[$|\]]/gim, packageVersion);
        str = str.replace(versionPlaceholderRegex, packageVersion);
    }

    return str;
}

async function prepareScriptTranspilations(buildAction: BuildActionInternal): Promise<void> {
    const workspaceRoot = buildAction._workspaceRoot;
    const projectRoot = buildAction._projectRoot;
    const projectName = buildAction._projectName;

    // Scripts
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

    const scriptTranspilationEntries: ScriptTranspilationEntryInternal[] = [];

    if (
        buildAction.scriptTranspilation &&
        typeof buildAction.scriptTranspilation === 'object' &&
        buildAction.scriptTranspilation.entries
    ) {
        const entries = buildAction.scriptTranspilation.entries;
        for (let i = 0; i < entries.length; i++) {
            const tsTranspilation = entries[i];
            let tsConfigPath = '';
            if (tsTranspilation.tsConfig) {
                tsConfigPath = path.resolve(projectRoot, tsTranspilation.tsConfig);
            } else {
                if (buildAction._tsConfigPath) {
                    tsConfigPath = buildAction._tsConfigPath;
                } else if (i > 0 && scriptTranspilationEntries[i - 1]._tsConfigPath) {
                    tsConfigPath = scriptTranspilationEntries[i - 1]._tsConfigPath;
                } else if (i === 0) {
                    const foundTsConfigPath = await detectTsConfigPath(workspaceRoot, projectRoot);
                    if (foundTsConfigPath) {
                        tsConfigPath = foundTsConfigPath;
                    }
                }
            }

            if (!tsConfigPath) {
                throw new Error(`The 'projects[${projectName}].tsTranspilations[${i}].tsConfig' value is required.`);
            }

            const tsTranspilationInternal = await prepareScriptTranspilationEntry(
                tsConfigPath,
                tsTranspilation,
                1,
                buildAction
            );
            scriptTranspilationEntries.push(tsTranspilationInternal);
        }
    } else if (buildAction.scriptTranspilation) {
        let tsConfigPath: string | null = null;
        if (buildAction._tsConfigPath) {
            tsConfigPath = buildAction._tsConfigPath;
        } else {
            tsConfigPath = await detectTsConfigPath(workspaceRoot, projectRoot);
        }

        if (!tsConfigPath) {
            throw new Error(`Could not detect tsconfig file for 'projects[${projectName}].`);
        }

        const esm2015Transpilation = await prepareScriptTranspilationEntry(
            tsConfigPath,
            {
                target: 'es2015',
                outDir: 'esm2015'
            },
            0,
            buildAction
        );
        scriptTranspilationEntries.push(esm2015Transpilation);

        const esm5Transpilation = await prepareScriptTranspilationEntry(
            tsConfigPath,
            {
                target: 'es5',
                outDir: 'esm5',
                declaration: false
            },
            1,
            buildAction
        );
        scriptTranspilationEntries.push(esm5Transpilation);
    }

    buildAction._scriptTranspilationEntries = scriptTranspilationEntries;
}

export async function prepareScriptTranspilationEntry(
    tsConfigPath: string,
    tsTranspilation: ScriptTranspilationEntry & Partial<ScriptTranspilationEntryInternal>,
    i: number,
    buildAction: BuildActionInternal
): Promise<ScriptTranspilationEntryInternal> {
    const tsConfigJson = readTsConfigFile(tsConfigPath);
    const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);

    const outputRootDir = buildAction._outputPath;
    const compilerOptions = tsCompilerConfig.options;

    // scriptTarget
    let scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES2015;
    if (tsTranspilation.target) {
        const tsScriptTarget = toTsScriptTarget(tsTranspilation.target);
        if (tsScriptTarget) {
            scriptTarget = tsScriptTarget;
        }
    } else if (compilerOptions.target) {
        scriptTarget = compilerOptions.target;
    }

    // declaration
    let declaration = true;
    if (tsTranspilation.declaration === false) {
        declaration = false;
    } else if (!tsTranspilation.declaration && !compilerOptions.declaration) {
        declaration = false;
    }

    // tsOutDir
    let tsOutDir: string;
    if (tsTranspilation.outDir) {
        tsOutDir = path.resolve(outputRootDir, tsTranspilation.outDir);
        tsTranspilation._customTsOutDir = tsOutDir;
    } else {
        if (compilerOptions.outDir) {
            tsOutDir = path.isAbsolute(compilerOptions.outDir)
                ? path.resolve(compilerOptions.outDir)
                : path.resolve(path.dirname(tsConfigPath), compilerOptions.outDir);
        } else {
            tsOutDir = outputRootDir;
            tsTranspilation._customTsOutDir = tsOutDir;
        }
    }

    if (compilerOptions.rootDir && !isSamePaths(compilerOptions.rootDir, path.dirname(tsConfigPath))) {
        const relSubDir = isInFolder(compilerOptions.rootDir, path.dirname(tsConfigPath))
            ? normalizeRelativePath(path.relative(compilerOptions.rootDir, path.dirname(tsConfigPath)))
            : normalizeRelativePath(path.relative(path.dirname(tsConfigPath), compilerOptions.rootDir));
        tsOutDir = path.resolve(tsOutDir, relSubDir);
    }

    // typingsOutDir
    if (declaration) {
        tsTranspilation._typingsOutDir = buildAction._packageJsonOutDir || tsOutDir;
    }

    // const flatModuleOutFile =
    //     tsTranspilation._angularCompilerOptions && tsTranspilation._angularCompilerOptions.flatModuleOutFile
    //         ? (tsTranspilation._angularCompilerOptions.flatModuleOutFile as string)
    //         : null;

    // if (flatModuleOutFile) {
    //     tsTranspilation._detectedEntryName = flatModuleOutFile.replace(/\.js$/i, '');
    // } else {
    //     const tsSrcDir = path.dirname(tsConfigPath);
    //     if (await pathExists(path.resolve(tsSrcDir, 'index.ts'))) {
    //         tsTranspilation._detectedEntryName = 'index';
    //     } else if (await pathExists(path.resolve(tsSrcDir, 'main.ts'))) {
    //         tsTranspilation._detectedEntryName = 'main';
    //     }
    // }

    const tsSrcDir = path.dirname(tsConfigPath);
    if (await pathExists(path.resolve(tsSrcDir, 'index.ts'))) {
        tsTranspilation._detectedEntryName = 'index';
    } else if (await pathExists(path.resolve(tsSrcDir, 'main.ts'))) {
        tsTranspilation._detectedEntryName = 'main';
    } else if (await pathExists(path.resolve(tsSrcDir, 'public_api.ts'))) {
        tsTranspilation._detectedEntryName = 'public_api';
    } else if (await pathExists(path.resolve(tsSrcDir, 'public-api.ts'))) {
        tsTranspilation._detectedEntryName = 'public-api';
    }

    // package entry points
    if (buildAction._packageJsonOutDir && tsTranspilation._detectedEntryName) {
        buildAction._packageEntryPoints = buildAction._packageEntryPoints || {};
        const packageEntryPoints = buildAction._packageEntryPoints;
        const packageJsonOutDir = buildAction._packageJsonOutDir;

        const entryFileAbs = path.resolve(tsOutDir, `${tsTranspilation._detectedEntryName}.js`);

        if (
            (compilerOptions.module === ts.ModuleKind.ES2015 || compilerOptions.module === ts.ModuleKind.ESNext) &&
            (tsTranspilation.target === 'es2015' ||
                (!tsTranspilation.target && compilerOptions.target === ts.ScriptTarget.ES2015))
        ) {
            packageEntryPoints.es2015 = normalizeRelativePath(path.relative(packageJsonOutDir, entryFileAbs));
            // It is deprecated as of v9, might be removed in the future.
            packageEntryPoints.esm2015 = packageEntryPoints.es2015;
        } else if (
            (compilerOptions.module === ts.ModuleKind.ES2015 || compilerOptions.module === ts.ModuleKind.ESNext) &&
            (tsTranspilation.target === 'es5' ||
                (!tsTranspilation.target && compilerOptions.target === ts.ScriptTarget.ES5))
        ) {
            packageEntryPoints.esm5 = normalizeRelativePath(path.relative(packageJsonOutDir, entryFileAbs));
            packageEntryPoints.module = packageEntryPoints.esm5;
        } else if (compilerOptions.module === ts.ModuleKind.UMD || compilerOptions.module === ts.ModuleKind.CommonJS) {
            packageEntryPoints.main = normalizeRelativePath(path.relative(packageJsonOutDir, entryFileAbs));
        }

        if (declaration && tsTranspilation._typingsOutDir) {
            if (buildAction._nestedPackage && buildAction._packageNameWithoutScope) {
                const typingEntryName = buildAction._packageNameWithoutScope.substr(
                    buildAction._packageNameWithoutScope.lastIndexOf('/') + 1
                );

                packageEntryPoints.typings = normalizeRelativePath(
                    path.relative(packageJsonOutDir, path.join(outputRootDir, `${typingEntryName}.d.ts`))
                );
            } else {
                packageEntryPoints.typings = normalizeRelativePath(
                    path.relative(
                        packageJsonOutDir,
                        path.join(tsTranspilation._typingsOutDir, `${tsTranspilation._detectedEntryName}.d.ts`)
                    )
                );
            }
        }
    }

    return {
        ...tsTranspilation,
        _index: i,
        _scriptTarget: scriptTarget,
        _tsConfigPath: tsConfigPath,
        _tsConfigJson: tsConfigJson,
        _tsCompilerConfig: tsCompilerConfig,
        _declaration: declaration,
        _tsOutDirRootResolved: tsOutDir
    };
}

async function detectTsConfigPath(workspaceRoot: string, projectRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig.build.json', 'tsconfig-build.json', 'tsconfig.lib.json', 'tsconfig-lib.json', 'tsconfig.json'],
        projectRoot,
        workspaceRoot
    );
}

function prepareScriptBundles(buildAction: BuildActionInternal): void {
    const projectName = buildAction._projectName;

    const scriptBundleEntries: ScriptBundleEntryInternal[] = [];

    if (buildAction.scriptBundle && typeof buildAction.scriptBundle === 'object' && buildAction.scriptBundle.entries) {
        const bundles = buildAction.scriptBundle.entries;
        for (let i = 0; i < bundles.length; i++) {
            const bundlePartial = bundles[i];
            scriptBundleEntries.push(prepareBundleEntry(scriptBundleEntries, bundlePartial, i, buildAction));
        }
    } else if (buildAction.scriptBundle) {
        let shouldBundlesDefault = buildAction.scriptTranspilation === true;
        if (
            !shouldBundlesDefault &&
            buildAction._scriptTranspilationEntries &&
            buildAction._scriptTranspilationEntries.length >= 2 &&
            buildAction._scriptTranspilationEntries[0].target === 'es2015' &&
            buildAction._scriptTranspilationEntries[1].target === 'es5'
        ) {
            shouldBundlesDefault = true;
        }

        if (shouldBundlesDefault) {
            const es2015BundlePartial: Partial<ScriptBundleEntryInternal> = {
                libraryTarget: 'esm',
                entryRoot: 'tsTranspilationOutput',
                tsTranspilationIndex: 0
            };

            const es2015BundleInternal = prepareBundleEntry(scriptBundleEntries, es2015BundlePartial, 0, buildAction);
            scriptBundleEntries.push(es2015BundleInternal);

            const es5BundlePartial: Partial<ScriptBundleEntryInternal> = {
                libraryTarget: 'esm',
                entryRoot: 'tsTranspilationOutput',
                tsTranspilationIndex: 1
            };

            const es5BundleInternal = prepareBundleEntry(scriptBundleEntries, es5BundlePartial, 1, buildAction);
            scriptBundleEntries.push(es5BundleInternal);

            const umdBundlePartial: Partial<ScriptBundleEntryInternal> = {
                libraryTarget: 'umd',
                entryRoot: 'prevBundleOutput'
            };
            const umdBundleInternal = prepareBundleEntry(scriptBundleEntries, umdBundlePartial, 2, buildAction);
            scriptBundleEntries.push(umdBundleInternal);
        } else {
            throw new Error(
                `Counld not detect to bunlde automatically, please correct option in 'projects[${projectName}].bundles'.`
            );
        }
    }

    buildAction._scriptBundleEntries = scriptBundleEntries;
}

export function prepareBundleEntry(
    bundles: ScriptBundleEntryInternal[],
    currentBundle: Partial<ScriptBundleEntryInternal>,
    i: number,
    buildAction: BuildActionInternal
): ScriptBundleEntryInternal {
    const projectName = buildAction._projectName;

    if (!currentBundle.libraryTarget) {
        throw new Error(`The 'projects[${projectName}].bundles[${i}].libraryTarget' value is required.`);
    }

    const projectRoot = buildAction._projectRoot;
    const outputPath = buildAction._outputPath;
    const bundleOptions = typeof buildAction.scriptBundle == 'object' ? buildAction.scriptBundle : {};

    // externals
    if (currentBundle.externals == null && bundleOptions.externals) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        currentBundle.externals = JSON.parse(JSON.stringify(bundleOptions.externals));
    }

    // dependenciesAsExternals
    if (currentBundle.dependenciesAsExternals == null && bundleOptions.dependenciesAsExternals != null) {
        currentBundle.dependenciesAsExternals = bundleOptions.dependenciesAsExternals;
    }

    // peerDependenciesAsExternals
    if (currentBundle.peerDependenciesAsExternals == null && bundleOptions.peerDependenciesAsExternals != null) {
        currentBundle.peerDependenciesAsExternals = bundleOptions.peerDependenciesAsExternals;
    }

    // includeCommonJs
    if (currentBundle.includeCommonJs == null && bundleOptions.includeCommonJs != null) {
        currentBundle.includeCommonJs = bundleOptions.includeCommonJs;
    }

    if (currentBundle.entryRoot === 'prevBundleOutput') {
        let foundBundleTarget: ScriptBundleEntryInternal | null = null;
        if (i > 0) {
            foundBundleTarget = bundles[i - 1];
        }

        if (!foundBundleTarget) {
            throw new Error(
                `No previous bundle target found, please correct value in 'projects[${projectName}].bundles[${i}].entryRoot'.`
            );
        }

        currentBundle._entryFilePath = foundBundleTarget._outputFilePath;
        currentBundle._sourceScriptTarget = foundBundleTarget._destScriptTarget;
        currentBundle._destScriptTarget = foundBundleTarget._destScriptTarget;
    } else if (currentBundle.entryRoot === 'tsTranspilationOutput') {
        if (!buildAction._scriptTranspilationEntries || !buildAction._scriptTranspilationEntries.length) {
            throw new Error(
                `To use 'tsTranspilationOutDir', the 'projects[${projectName}].tsTranspilations' option is required.`
            );
        }

        let foundTsTranspilation: ScriptTranspilationEntryInternal;

        if (currentBundle.tsTranspilationIndex == null) {
            foundTsTranspilation = buildAction._scriptTranspilationEntries[0];
        } else {
            if (currentBundle.tsTranspilationIndex > buildAction._scriptTranspilationEntries.length - 1) {
                throw new Error(
                    `No _tsTranspilations found, please correct value in 'projects[${projectName}].bundles[${i}].tsTranspilationIndex'.`
                );
            }

            foundTsTranspilation = buildAction._scriptTranspilationEntries[currentBundle.tsTranspilationIndex];
        }

        const entryRootDir = foundTsTranspilation._tsOutDirRootResolved;
        let entryFile = currentBundle.entry;
        if (!entryFile && foundTsTranspilation._detectedEntryName) {
            entryFile = `${foundTsTranspilation._detectedEntryName}.js`;
        }
        if (!entryFile) {
            throw new Error(`The 'projects[${projectName}].bundles[${i}].entry' value is required.`);
        }

        currentBundle._entryFilePath = path.resolve(entryRootDir, entryFile);

        currentBundle._sourceScriptTarget = foundTsTranspilation._scriptTarget;
        currentBundle._destScriptTarget = foundTsTranspilation._scriptTarget;
    } else {
        const entryFile = currentBundle.entry || bundleOptions.entry;
        if (!entryFile) {
            throw new Error(`The 'projects[${projectName}].bundles[${i}].entry' value is required.`);
        }

        currentBundle._entryFilePath = path.resolve(projectRoot, entryFile);

        if (/\.tsx?$/i.test(entryFile)) {
            if (currentBundle.tsConfig) {
                currentBundle._tsConfigPath = path.resolve(projectRoot, currentBundle.tsConfig);
            } else if (buildAction._tsConfigPath) {
                currentBundle._tsConfigPath = buildAction._tsConfigPath;
                currentBundle._tsConfigJson = buildAction._tsConfigJson;
                currentBundle._tsCompilerConfig = buildAction._tsCompilerConfig;
            }
        }
    }

    if (currentBundle._tsConfigPath) {
        currentBundle._tsConfigJson = readTsConfigFile(currentBundle._tsConfigPath);
        currentBundle._tsCompilerConfig = parseTsJsonConfigFileContent(currentBundle._tsConfigPath);

        if (!currentBundle._sourceScriptTarget) {
            currentBundle._sourceScriptTarget = currentBundle._tsCompilerConfig.options.target;
        }
        if (!currentBundle._destScriptTarget) {
            currentBundle._destScriptTarget = currentBundle._tsCompilerConfig.options.target;
        }
    }

    if (currentBundle._destScriptTarget) {
        const scriptTarget = currentBundle._destScriptTarget as ts.ScriptTarget;

        // supportES2015
        currentBundle._supportES2015 = scriptTarget !== ts.ScriptTarget.ES3 && scriptTarget !== ts.ScriptTarget.ES5;
    }

    // outputFilePath
    let bundleOutFilePath = '';
    if (currentBundle.outputFilePath) {
        bundleOutFilePath = currentBundle.outputFilePath;

        const isDir = /(\\|\/)$/.test(bundleOutFilePath) || !/\.js$/i.test(bundleOutFilePath);
        bundleOutFilePath = path.resolve(outputPath, bundleOutFilePath);

        if (isDir) {
            const outFileName = buildAction._packageNameWithoutScope.replace(/\//gm, '-');
            bundleOutFilePath = path.resolve(bundleOutFilePath, `${outFileName}.js`);
        }
    } else {
        const outFileName = buildAction._packageNameWithoutScope.replace(/\//gm, '-');

        if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs') {
            if (
                bundles.length > 1 ||
                (buildAction._scriptTranspilationEntries && buildAction._scriptTranspilationEntries.length > 0)
            ) {
                bundleOutFilePath = path.resolve(
                    outputPath,
                    `bundles/${outFileName}.${currentBundle.libraryTarget}.js`
                );
            } else {
                bundleOutFilePath = path.resolve(outputPath, `${outFileName}.js`);
            }
        } else {
            if (currentBundle._destScriptTarget) {
                const scriptTargetStr = ts.ScriptTarget[currentBundle._destScriptTarget].replace(/^ES/i, '');
                const fesmFolderName = `fesm${scriptTargetStr}`;
                bundleOutFilePath = path.resolve(outputPath, fesmFolderName, `${outFileName}.js`);
            } else {
                bundleOutFilePath = path.resolve(outputPath, `bundles/${outFileName}.es.js`);
            }
        }
    }

    if (currentBundle._entryFilePath && /\[name\]/g.test(bundleOutFilePath)) {
        bundleOutFilePath = bundleOutFilePath.replace(
            /\[name\]/g,
            path.basename(currentBundle._entryFilePath).replace(/\.(js|ts)$/i, '')
        );
    }

    // package entry points
    if (buildAction._packageJsonOutDir) {
        buildAction._packageEntryPoints = buildAction._packageEntryPoints || {};
        const packageEntryPoints = buildAction._packageEntryPoints;
        const packageJsonOutDir = buildAction._packageJsonOutDir;
        const scriptTarget = currentBundle._destScriptTarget;

        if (currentBundle.libraryTarget === 'esm' && scriptTarget === ts.ScriptTarget.ES2015) {
            packageEntryPoints.fesm2015 = normalizeRelativePath(path.relative(packageJsonOutDir, bundleOutFilePath));
            packageEntryPoints.es2015 = packageEntryPoints.fesm2015;
        } else if (currentBundle.libraryTarget === 'esm' && scriptTarget === ts.ScriptTarget.ES5) {
            packageEntryPoints.fesm5 = normalizeRelativePath(path.relative(packageJsonOutDir, bundleOutFilePath));
            packageEntryPoints.module = packageEntryPoints.fesm5;
        } else if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs') {
            packageEntryPoints.main = normalizeRelativePath(path.relative(packageJsonOutDir, bundleOutFilePath));
        }
    }

    return {
        ...currentBundle,
        _index: i,
        _entryFilePath: currentBundle._entryFilePath,
        _outputFilePath: bundleOutFilePath
    };
}

function parseStyleEntries(
    styleEntries: StyleEntry[],
    buildAction: BuildActionInternal,
    projectRoot: string,
    outputPath: string
): StyleParsedEntry[] {
    return styleEntries.map((styleEntry) => {
        if (!supportedStyleInputExt.test(styleEntry.input)) {
            throw new Error(
                `Unsupported style input entry '${styleEntry.input}'. Config location projects[${buildAction._projectName}].style.entries.`
            );
        }

        const inputFilePath = path.resolve(projectRoot, styleEntry.input);
        let outputFilePath: string;

        if (styleEntry.output) {
            const extName = path.extname(styleEntry.output);

            if (!extName || styleEntry.output.endsWith('/')) {
                const outputFileName = path.basename(inputFilePath).replace(supportedStyleInputExt, '.css');
                outputFilePath = path.resolve(outputPath, styleEntry.output, outputFileName);
            } else {
                if (!supportedStyleOutputExt.test(extName)) {
                    throw new Error(
                        `Unsupported style output entry '${styleEntry.output}'. Config location projects[${buildAction._projectName}].style.entries.`
                    );
                }

                outputFilePath = path.resolve(outputPath, styleEntry.output);
            }
        } else {
            const outputFileName = path.basename(inputFilePath).replace(supportedStyleInputExt, '.css');
            outputFilePath = path.resolve(outputPath, outputFileName);
        }

        let includePaths: string[] | undefined;
        if (styleEntry.includePaths) {
            if (styleEntry.includePaths.length) {
                includePaths = styleEntry.includePaths.map((includePath: string) =>
                    path.resolve(projectRoot, includePath)
                );
            }
        } else if (buildAction.style && buildAction.style.includePaths && buildAction.style.includePaths.length > 0) {
            includePaths = buildAction.style.includePaths.map((includePath: string) =>
                path.resolve(projectRoot, includePath)
            );
        }

        return {
            ...styleEntry,
            _inputFilePath: inputFilePath,
            _outputFilePath: outputFilePath,
            _includePaths: includePaths
        };
    });
}
