/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { readFile } from 'fs-extra';
import { ScriptTarget } from 'typescript';

import { ModuleExternalsEntry, ScriptBundleEntry } from '../models';
import { BuildActionInternal, ScriptBundleEntryInternal, ScriptTranspilationEntryInternal } from '../models/internals';
import { findUp, normalizePath } from '../utils';

import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';

export async function prepareScriptBundles(buildAction: BuildActionInternal): Promise<void> {
    const projectName = buildAction._projectName;

    const bundleEntries: ScriptBundleEntryInternal[] = [];

    if (buildAction.scriptBundle && typeof buildAction.scriptBundle === 'object' && buildAction.scriptBundle.entries) {
        const bundles = buildAction.scriptBundle.entries;
        for (let i = 0; i < bundles.length; i++) {
            const bundlePartial = bundles[i];
            bundleEntries.push(toBundleEntryInternal(bundleEntries, bundlePartial, i, buildAction));
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
            const es2015BundleEntry: ScriptBundleEntry = {
                libraryTarget: 'esm',
                entryRoot: 'transpilationOutput',
                transpilationEntryIndex: 0
            };

            const es2015BundleInternal = toBundleEntryInternal(bundleEntries, es2015BundleEntry, 0, buildAction);
            bundleEntries.push(es2015BundleInternal);

            const es5BundleEntry: ScriptBundleEntry = {
                libraryTarget: 'esm',
                entryRoot: 'transpilationOutput',
                transpilationEntryIndex: 1
            };

            const es5BundleInternal = toBundleEntryInternal(bundleEntries, es5BundleEntry, 1, buildAction);
            bundleEntries.push(es5BundleInternal);

            const umdBundleEntry: ScriptBundleEntry = {
                libraryTarget: 'umd',
                entryRoot: 'prevBundleOutput'
            };
            const umdBundleInternal = toBundleEntryInternal(bundleEntries, umdBundleEntry, 2, buildAction);
            bundleEntries.push(umdBundleInternal);
        } else {
            throw new Error(
                `Script bundle entries counld not be detected automatically, set entries manually in 'projects[${projectName}].scriptBundle.entries'.`
            );
        }
    }

    buildAction._scriptBundleEntries = bundleEntries;

    await prepareBannerText(buildAction);
}

function toBundleEntryInternal(
    prevBundles: ScriptBundleEntryInternal[],
    currentBundle: ScriptBundleEntry,
    i: number,
    buildAction: BuildActionInternal
): ScriptBundleEntryInternal {
    const projectName = buildAction._projectName;
    const projectRoot = buildAction._projectRoot;
    const bundleOptions = typeof buildAction.scriptBundle == 'object' ? buildAction.scriptBundle : {};

    // externals
    if (currentBundle.externals == null && bundleOptions.externals) {
        currentBundle.externals = JSON.parse(JSON.stringify(bundleOptions.externals)) as ModuleExternalsEntry[];
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

    let entryFilePath: string;
    let sourceScriptTarget: ScriptTarget | null = null;
    let destScriptTarget: ScriptTarget | null = null;
    let tsConfigPath: string | null = null;

    if (currentBundle.entryRoot === 'prevBundleOutput') {
        let foundBundleTarget: ScriptBundleEntryInternal | null = null;
        if (i > 0) {
            foundBundleTarget = prevBundles[i - 1];
        }

        if (!foundBundleTarget) {
            throw new Error(
                `No previous bundle target found, correct value in 'projects[${projectName}].scriptBundle.entries[${i}].entryRoot'.`
            );
        }

        entryFilePath = foundBundleTarget._outputFilePath;
        sourceScriptTarget = foundBundleTarget._destScriptTarget;
        destScriptTarget = foundBundleTarget._destScriptTarget;
    } else if (currentBundle.entryRoot === 'transpilationOutput') {
        if (!buildAction._scriptTranspilationEntries || !buildAction._scriptTranspilationEntries.length) {
            throw new Error(
                `No script transpilation entry found, correct value in 'projects[${projectName}].scriptBundle.entries[${i}].entryRoot'.`
            );
        }

        let foundTranspilationEntry: ScriptTranspilationEntryInternal;

        if (currentBundle.transpilationEntryIndex == null) {
            foundTranspilationEntry = buildAction._scriptTranspilationEntries[0];
        } else {
            if (currentBundle.transpilationEntryIndex > buildAction._scriptTranspilationEntries.length - 1) {
                throw new Error(
                    `No script transpilation entry found, correct value in 'projects[${projectName}].scriptBundle.entries[${i}].transpilationEntryIndex'.`
                );
            }

            foundTranspilationEntry = buildAction._scriptTranspilationEntries[currentBundle.transpilationEntryIndex];
        }

        const entryRootDir = foundTranspilationEntry._tsOutDirRootResolved;
        let entryFile = currentBundle.entry;
        if (!entryFile && foundTranspilationEntry._detectedEntryName) {
            entryFile = `${foundTranspilationEntry._detectedEntryName}.js`;
        }

        if (!entryFile) {
            throw new Error(
                `Entry file could not be detected automatically, set entry value manually in 'projects[${projectName}].scriptBundle.entries[${i}].entry'.`
            );
        }

        entryFilePath = path.resolve(entryRootDir, entryFile);
        sourceScriptTarget = foundTranspilationEntry._scriptTarget;
        destScriptTarget = foundTranspilationEntry._scriptTarget;
    } else {
        const entryFile = currentBundle.entry || bundleOptions.entry;
        if (!entryFile) {
            throw new Error(
                `Entry file could not be detected automatically, set entry value manually in 'projects[${projectName}].scriptBundle.entries[${i}].entry'.`
            );
        }

        entryFilePath = path.resolve(projectRoot, entryFile);

        if (/\.tsx?$/i.test(entryFile)) {
            if (currentBundle.tsConfig) {
                tsConfigPath = path.resolve(projectRoot, currentBundle.tsConfig);
            } else if (buildAction._tsConfigPath) {
                tsConfigPath = buildAction._tsConfigPath;
            }
        }
    }

    if (tsConfigPath && (sourceScriptTarget == null || destScriptTarget == null)) {
        const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);

        if (tsCompilerConfig.options.target != null && sourceScriptTarget == null) {
            sourceScriptTarget = tsCompilerConfig.options.target;
        }

        if (tsCompilerConfig.options.target != null && destScriptTarget == null) {
            destScriptTarget = tsCompilerConfig.options.target;
        }
    }

    // outputFilePath
    let bundleOutFilePath = '';
    if (currentBundle.outputFilePath) {
        bundleOutFilePath = currentBundle.outputFilePath;

        const isDir = /(\\|\/)$/.test(bundleOutFilePath) || !/\.js$/i.test(bundleOutFilePath);
        bundleOutFilePath = path.resolve(buildAction._outputPath, bundleOutFilePath);

        if (isDir) {
            const outFileName = buildAction._packageNameWithoutScope.replace(/\//gm, '-');
            bundleOutFilePath = path.resolve(bundleOutFilePath, `${outFileName}.js`);
        }
    } else {
        const outFileName = buildAction._packageNameWithoutScope.replace(/\//gm, '-');

        if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs') {
            if (
                prevBundles.length > 1 ||
                (buildAction._scriptTranspilationEntries && buildAction._scriptTranspilationEntries.length > 0)
            ) {
                bundleOutFilePath = path.resolve(
                    buildAction._outputPath,
                    `bundles/${outFileName}.${currentBundle.libraryTarget}.js`
                );
            } else {
                bundleOutFilePath = path.resolve(buildAction._outputPath, `${outFileName}.js`);
            }
        } else {
            if (destScriptTarget != null) {
                const scriptTargetStr = ScriptTarget[destScriptTarget].replace(/^ES/i, '');
                const fesmFolderName = `fesm${scriptTargetStr}`;
                bundleOutFilePath = path.resolve(buildAction._outputPath, fesmFolderName, `${outFileName}.js`);
            } else {
                bundleOutFilePath = path.resolve(buildAction._outputPath, `bundles/${outFileName}.es.js`);
            }
        }
    }

    if (entryFilePath && /\[name\]/g.test(bundleOutFilePath)) {
        bundleOutFilePath = bundleOutFilePath.replace(
            /\[name\]/g,
            path.basename(entryFilePath).replace(/\.(js|ts)$/i, '')
        );
    }

    // package entry points
    if (buildAction._packageJsonOutDir) {
        const entryFileRel = normalizePath(path.relative(buildAction._packageJsonOutDir, bundleOutFilePath));

        // TODO: To check
        if (currentBundle.libraryTarget === 'esm' && destScriptTarget === ScriptTarget.ES2015) {
            buildAction._packageJsonEntryPoint.fesm2015 = entryFileRel;
            buildAction._packageJsonEntryPoint.es2015 = entryFileRel;
        } else if (currentBundle.libraryTarget === 'esm' && destScriptTarget === ScriptTarget.ES5) {
            buildAction._packageJsonEntryPoint.fesm5 = entryFileRel;
            buildAction._packageJsonEntryPoint.module = entryFileRel;
        } else if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs') {
            buildAction._packageJsonEntryPoint.main = entryFileRel;
        }
    }

    return {
        ...currentBundle,
        _index: i,
        _entryFilePath: entryFilePath,
        _outputFilePath: bundleOutFilePath,
        _destScriptTarget: destScriptTarget,
        _sourceScriptTarget: sourceScriptTarget,
        _tsConfigPath: tsConfigPath
    };
}

async function prepareBannerText(buildAction: BuildActionInternal): Promise<void> {
    if (!buildAction.scriptBundle || typeof buildAction.scriptBundle !== 'object' || !buildAction.scriptBundle.banner) {
        return;
    }

    let bannerText = buildAction.scriptBundle.banner;

    if (/\.txt$/i.test(bannerText)) {
        const bannerFilePath = await findUp(bannerText, buildAction._projectRoot, buildAction._workspaceRoot);
        if (bannerFilePath) {
            bannerText = await readFile(bannerFilePath, 'utf-8');
        } else {
            throw new Error(
                `The banner text file: ${path.resolve(
                    buildAction._projectRoot,
                    bannerText
                )} doesn't exist. Correct value in 'projects[${buildAction._projectName}].scriptBundle.banner'.`
            );
        }
    }

    if (!bannerText) {
        return;
    }

    bannerText = addCommentToBanner(bannerText);
    bannerText = bannerText.replace(/[$|[]CURRENT[_-]?YEAR[$|\]]/gim, new Date().getFullYear().toString());
    bannerText = bannerText.replace(/[$|[](PROJECT|PACKAGE)[_-]?NAME[$|\]]/gim, buildAction._packageName);
    bannerText = bannerText.replace(/[$|[](PROJECT|PACKAGE)?[_-]?VERSION[$|\]]/gim, buildAction._packageVersion);
    bannerText = bannerText.replace(/0\.0\.0-PLACEHOLDER/i, buildAction._packageVersion);
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
