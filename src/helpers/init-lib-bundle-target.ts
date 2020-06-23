import * as path from 'path';

import { ScriptTarget } from 'typescript';

import { InternalError, InvalidConfigError } from '../models/errors';
import {
    LibBundleOptionsInternal,
    LibProjectConfigInternal,
    TsTranspilationOptionsInternal
} from '../models/internals';
import { normalizeRelativePath } from '../utils';

import { getEcmaVersionFromScriptTarget } from './get-ecma-version-from-script-target';
import { getnodeResolveFieldsFromScriptTarget } from './get-node-resolve-fields-from-script-target';
import { loadTsConfig } from './load-ts-config';

// tslint:disable:max-func-body-length
export function initLibBundleTarget(
    bundles: LibBundleOptionsInternal[],
    currentBundle: Partial<LibBundleOptionsInternal>,
    i: number,
    libConfig: LibProjectConfigInternal
): LibBundleOptionsInternal {
    if (!libConfig._workspaceRoot) {
        throw new InternalError("The 'libConfig._workspaceRoot' is not set.");
    }

    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    if (!libConfig._outputPath) {
        throw new InternalError("The 'libConfig._outputPath' is not set.");
    }

    if (!currentBundle.libraryTarget) {
        throw new InvalidConfigError(
            `The 'projects[${libConfig.name || libConfig._index}].bundles[${i}].libraryTarget' value is required.`
        );
    }

    const projectRoot = libConfig._projectRoot;
    const outputPath = libConfig._outputPath;

    // externals
    if (currentBundle.externals == null && libConfig.externals) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        currentBundle.externals = JSON.parse(JSON.stringify(libConfig.externals));
    }

    // dependenciesAsExternals
    if (currentBundle.dependenciesAsExternals == null && libConfig.dependenciesAsExternals != null) {
        currentBundle.dependenciesAsExternals = libConfig.dependenciesAsExternals;
    }

    // peerDependenciesAsExternals
    if (currentBundle.peerDependenciesAsExternals == null && libConfig.peerDependenciesAsExternals != null) {
        currentBundle.peerDependenciesAsExternals = libConfig.peerDependenciesAsExternals;
    }

    // includeCommonJs
    if (currentBundle.includeCommonJs == null && libConfig.includeCommonJs != null) {
        currentBundle.includeCommonJs = libConfig.includeCommonJs;
    }

    if (currentBundle.entryRoot === 'prevBundleOutput') {
        let foundBundleTarget: LibBundleOptionsInternal | undefined;
        if (i > 0) {
            foundBundleTarget = bundles[i - 1];
        }
        if (!foundBundleTarget) {
            throw new InvalidConfigError(
                `No previous bundle target found, please correct value in 'projects[${
                    libConfig.name || libConfig._index
                }].bundles[${i}].entryRoot'.`
            );
        }

        currentBundle._entryFilePath = foundBundleTarget._outputFilePath;
        currentBundle._sourceScriptTarget = foundBundleTarget._destScriptTarget;
        currentBundle._destScriptTarget = foundBundleTarget._destScriptTarget;
    } else if (currentBundle.entryRoot === 'tsTranspilationOutput') {
        if (!libConfig._tsTranspilations || !libConfig._tsTranspilations.length) {
            throw new InvalidConfigError(
                `To use 'tsTranspilationOutDir', the 'projects[${
                    libConfig.name || libConfig._index
                }].tsTranspilations' option is required.`
            );
        }

        let foundTsTranspilation: TsTranspilationOptionsInternal;

        if (currentBundle.tsTranspilationIndex == null) {
            foundTsTranspilation = libConfig._tsTranspilations[0];
        } else {
            if (currentBundle.tsTranspilationIndex > libConfig._tsTranspilations.length - 1) {
                throw new InvalidConfigError(
                    `No _tsTranspilations found, please correct value in 'projects[${
                        libConfig.name || libConfig._index
                    }].bundles[${i}].tsTranspilationIndex'.`
                );
            }

            foundTsTranspilation = libConfig._tsTranspilations[currentBundle.tsTranspilationIndex];
        }

        const entryRootDir = foundTsTranspilation._tsOutDirRootResolved;
        let entryFile = currentBundle.entry;
        if (!entryFile && foundTsTranspilation._detectedEntryName) {
            entryFile = `${foundTsTranspilation._detectedEntryName}.js`;
        }
        if (!entryFile) {
            throw new InvalidConfigError(
                `The 'projects[${libConfig.name || libConfig._index}].bundles[${i}].entry' value is required.`
            );
        }

        currentBundle._entryFilePath = path.resolve(entryRootDir, entryFile);

        currentBundle._sourceScriptTarget = foundTsTranspilation._scriptTarget;
        currentBundle._destScriptTarget = foundTsTranspilation._scriptTarget;
    } else {
        const entryFile = currentBundle.entry || libConfig.main;
        if (!entryFile) {
            throw new InvalidConfigError(
                `The 'projects[${libConfig.name || libConfig._index}].bundles[${i}].entry' value is required.`
            );
        }

        currentBundle._entryFilePath = path.resolve(projectRoot, entryFile);

        if (/\.tsx?$/i.test(entryFile)) {
            if (currentBundle.tsConfig) {
                currentBundle._tsConfigPath = path.resolve(projectRoot, currentBundle.tsConfig);
            } else if (libConfig._tsConfigPath) {
                currentBundle._tsConfigPath = libConfig._tsConfigPath;
                currentBundle._tsConfigJson = libConfig._tsConfigJson;
                currentBundle._tsCompilerConfig = libConfig._tsCompilerConfig;
            }
        }
    }

    let nodeResolveFields: string[] = [];

    if (currentBundle._tsConfigPath) {
        loadTsConfig(currentBundle._tsConfigPath, currentBundle, libConfig);

        if (!currentBundle._tsCompilerConfig) {
            throw new InternalError("The 'currentBundle._tsCompilerConfig' is not set.");
        }

        if (!currentBundle._sourceScriptTarget) {
            currentBundle._sourceScriptTarget = currentBundle._tsCompilerConfig.options.target;
        }
        if (!currentBundle._destScriptTarget) {
            currentBundle._destScriptTarget = currentBundle._tsCompilerConfig.options.target;
        }
    }

    if (currentBundle._destScriptTarget) {
        const scriptTarget = currentBundle._destScriptTarget as ScriptTarget;

        // ecmaVersion
        const ecmaVersion = getEcmaVersionFromScriptTarget(scriptTarget);
        if (ecmaVersion) {
            currentBundle._ecmaVersion = ecmaVersion;
        }

        // supportES2015
        currentBundle._supportES2015 = scriptTarget !== ScriptTarget.ES3 && scriptTarget !== ScriptTarget.ES5;

        // nodeResolveFields
        nodeResolveFields = getnodeResolveFieldsFromScriptTarget(scriptTarget);
    }

    // nodeResolveFields
    const defaultMainFields = ['module', 'main'];
    nodeResolveFields.push(...defaultMainFields);
    currentBundle._nodeResolveFields = nodeResolveFields;

    // outputFilePath
    let bundleOutFilePath = '';
    if (currentBundle.outputFilePath) {
        bundleOutFilePath = currentBundle.outputFilePath;

        const isDir = /(\\|\/)$/.test(bundleOutFilePath) || !/\.js$/i.test(bundleOutFilePath);
        bundleOutFilePath = path.resolve(outputPath, bundleOutFilePath);

        if (isDir) {
            if (!libConfig._packageNameWithoutScope) {
                throw new InternalError("The 'libConfig._packageNameWithoutScope' is not set.");
            }

            const outFileName = libConfig._packageNameWithoutScope.replace(/\//gm, '-');
            bundleOutFilePath = path.resolve(bundleOutFilePath, `${outFileName}.js`);
        }
    } else {
        if (!libConfig._packageNameWithoutScope) {
            throw new InternalError("The 'libConfig._packageNameWithoutScope' is not set.");
        }

        const outFileName = libConfig._packageNameWithoutScope.replace(/\//gm, '-');

        if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs') {
            if (bundles.length > 1 || (libConfig._tsTranspilations && libConfig._tsTranspilations.length > 0)) {
                bundleOutFilePath = path.resolve(
                    outputPath,
                    `bundles/${outFileName}.${currentBundle.libraryTarget}.js`
                );
            } else {
                bundleOutFilePath = path.resolve(outputPath, `${outFileName}.js`);
            }
        } else {
            if (currentBundle._destScriptTarget) {
                const scriptTargetStr = ScriptTarget[currentBundle._destScriptTarget].replace(/^ES/i, '');
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
    if (libConfig._packageJsonOutDir) {
        libConfig._packageEntryPoints = libConfig._packageEntryPoints || {};
        const packageEntryPoints = libConfig._packageEntryPoints;
        const packageJsonOutDir = libConfig._packageJsonOutDir;
        const scriptTarget = currentBundle._destScriptTarget;

        if (currentBundle.libraryTarget === 'esm' && scriptTarget === ScriptTarget.ES2015) {
            packageEntryPoints.fesm2015 = normalizeRelativePath(path.relative(packageJsonOutDir, bundleOutFilePath));
            packageEntryPoints.es2015 = packageEntryPoints.fesm2015;
        } else if (currentBundle.libraryTarget === 'esm' && scriptTarget === ScriptTarget.ES5) {
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
