/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { BuildAction } from '../models';
import { BuildActionInternal, BuildOptionsInternal, PackageJsonLike, ProjectConfigInternal } from '../models/internals';
import { isInFolder, isSamePaths } from '../utils';

import { applyEnvOverrides } from './apply-env-overrides';
import { findNodeModulesPath } from './find-node-modules-path';
import { findPackageJsonPath } from './find-package-json-path';
import { prepareAssetEntries } from './prepare-asset-entries';
import { prepareScriptBundles } from './prepare-script-bundles';
import { prepareScriptTranspilations } from './prepare-script-transpilations';
import { prepareStyles } from './prepare-styles';
import { readPackageJson } from './read-package-json';

const versionPlaceholderRegex = /0\.0\.0-PLACEHOLDER/i;

export async function toBuildActionInternal(
    projectConfig: ProjectConfigInternal,
    buildOptions: BuildOptionsInternal
): Promise<BuildActionInternal> {
    if (!projectConfig.actions || !projectConfig.actions.build) {
        throw new Error('No build actions in configuration.');
    }

    const buildAction = JSON.parse(JSON.stringify(projectConfig.actions.build)) as BuildAction;
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
            !packageJson.version ||
            packageJson.version === '0.0.0' ||
            packageJson.version === '[PLACEHOLDER]' ||
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

    const nodeModulesPath = await findNodeModulesPath(workspaceRoot);

    const buildActionInternal: BuildActionInternal = {
        ...buildAction,
        _configPath: projectConfig._configPath,
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
        _assetEntries: [],
        _styleEntries: [],
        _scriptTranspilationEntries: [],
        _scriptBundleEntries: [],
        _packageJsonOutDir: packageJsonOutDir,
        _packageJsonEntryPoint: {}
    };

    // Copy assets
    await prepareAssetEntries(buildActionInternal);

    // Styles
    if (
        buildActionInternal.style &&
        buildActionInternal.style.entries &&
        buildActionInternal.style.entries.length > 0
    ) {
        await prepareStyles(buildActionInternal);
    }

    // Script transpilations
    if (buildActionInternal.scriptTranspilation) {
        await prepareScriptTranspilations(buildActionInternal);
    }

    // Script bundles
    if (buildActionInternal.scriptBundle) {
        await prepareScriptBundles(buildActionInternal);
    }

    return buildActionInternal;
}
