import * as path from 'path';

import { BuildAction } from '../models';
import {
    BuildActionInternal,
    BuildCommandOptionsInternal,
    PackageJsonLike,
    ProjectConfigInternal
} from '../models/internals';
import { isInFolder, isSamePaths } from '../utils';

import { findNodeModulesPath } from './find-node-modules-path';
import { findPackageJsonPath } from './find-package-json-path';
import { prepareAssetEntries } from './prepare-asset-entries';
import { prepareBannerText } from './prepare-banner-text';
import { prepareScripts } from './prepare-scripts';
import { prepareStyles } from './prepare-styles';
import { getCachedPackageJson } from './get-cached-package-json';

const versionPlaceholderRegex = /0\.0\.0-PLACEHOLDER/i;

export async function toBuildActionInternal(
    projectConfig: ProjectConfigInternal,
    buildOptions: BuildCommandOptionsInternal
): Promise<BuildActionInternal> {
    if (!projectConfig.actions || !projectConfig.actions.build) {
        throw new Error('No build actions in configuration.');
    }

    const buildAction = JSON.parse(JSON.stringify(projectConfig.actions.build)) as BuildAction;
    const workspaceRoot = projectConfig._workspaceRoot;
    const projectRoot = projectConfig._projectRoot;
    const projectName = projectConfig._projectName;

    const packageJsonPath = await findPackageJsonPath(workspaceRoot, projectRoot);
    if (!packageJsonPath) {
        throw new Error('Could not detect package.json file.');
    }
    const packageJson = await getCachedPackageJson(packageJsonPath);

    const rootPackageJsonPath = await findPackageJsonPath(workspaceRoot);
    let rootPackageJson: PackageJsonLike | null = null;
    if (rootPackageJsonPath) {
        rootPackageJson = await getCachedPackageJson(rootPackageJsonPath);
    }

    const packageName = packageJson.name;
    const slashIndex = packageName.indexOf('/');
    let packageScope: string | null = null;
    let packageNameWithoutScope = packageName;

    if (slashIndex > -1 && packageName.startsWith('@')) {
        packageScope = packageName.substr(0, slashIndex);
        packageNameWithoutScope = packageName.substr(slashIndex + 1);
    }

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
        const tempOutputPath = path.resolve(workspaceRoot, `dist/packages/${packageNameWithoutScope}`);
        if (!isSamePaths(projectRoot, tempOutputPath) && !isInFolder(tempOutputPath, projectRoot)) {
            outputPathAbs = tempOutputPath;
        }
    }

    if (!outputPathAbs) {
        throw new Error(
            `The outputPath could not be automatically detected. Set value in 'projects[${projectName}].actions.build.outputPath' manually.`
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
        _config: projectConfig._config,
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
        _nestedPackage: nestedPackage,
        _packageScope: packageScope,
        _rootPackageJsonPath: rootPackageJsonPath,
        _rootPackageJson: rootPackageJson,
        _assetEntries: [],
        _styleEntries: [],
        _packageJsonOutDir: packageJsonOutDir,
        _packageJsonEntryPoint: {}
    };

    // Banner
    await prepareBannerText(buildActionInternal);

    // Copy assets
    await prepareAssetEntries(buildActionInternal);

    // Styles
    await prepareStyles(buildActionInternal);

    // Scripts
    await prepareScripts(buildActionInternal);

    return buildActionInternal;
}
