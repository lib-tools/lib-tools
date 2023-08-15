import * as path from 'path';

import {
    BuildCommandOptions,
    BuildConfig,
    BuildConfigInternal,
    PackageJsonLike,
    ProjectConfigInternal
} from '../models/index.js';
import { isInFolder, isSamePaths } from '../utils/index.js';

import { findNodeModulesPath } from './find-node-modules-path.js';
import { findPackageJsonPath } from './find-package-json-path.js';
import { prepareBannerText } from './prepare-banner-text.js';
import { readPackageJson } from './read-package-json.js';

// TODO: To reivew
import { prepareAssetEntries } from './prepare-asset-entries.js';

// import { findBuildTsconfigFile } from './find-build-tsconfig-file';
// import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
// import { prepareScripts } from './prepare-scripts';

import { prepareForStyleModule } from './prepare-for-style-module.js';

const versionPlaceholderRegex = /0\.0\.0-PLACEHOLDER/i;

export async function toBuildActionInternal(
    projectConfig: ProjectConfigInternal,
    buildCommandOptions: BuildCommandOptions
): Promise<BuildConfigInternal> {
    if (!projectConfig.tasks || !projectConfig.tasks.build) {
        throw new Error('No build actions in configuration.');
    }

    const buildConfig = JSON.parse(JSON.stringify(projectConfig.tasks.build)) as BuildConfig;
    const workspaceRoot = projectConfig._workspaceRoot;
    const projectRoot = projectConfig._projectRoot;
    const projectName = projectConfig._projectName;

    const packageJsonPath = await findPackageJsonPath(projectRoot, workspaceRoot);
    if (!packageJsonPath) {
        throw new Error('Could not detect package.json file.');
    }
    const packageJson = await readPackageJson(packageJsonPath);

    const rootPackageJsonPath = await findPackageJsonPath(null, workspaceRoot);
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

    let packageVersion: string;
    if (buildCommandOptions.version) {
        packageVersion = buildCommandOptions.version;
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

    if (buildConfig.outputPath) {
        const configErrorLocation = `projects[${projectName}].outputPath`;
        if (path.isAbsolute(buildConfig.outputPath)) {
            throw new Error(`The '${configErrorLocation}' must be relative path.`);
        }

        outputPathAbs = path.resolve(projectRoot, buildConfig.outputPath);

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
    }
    // else {
    //     let tsConfigPath: string | null = null;
    //     if (buildConfig.script && buildConfig.script.tsConfig) {
    //         tsConfigPath = path.resolve(projectRoot, buildConfig.script.tsConfig);
    //     } else if (buildConfig.script) {
    //         tsConfigPath = await findBuildTsconfigFile(projectRoot, workspaceRoot);
    //     }

    //     let outputPath: string | null = null;
    //     if (tsConfigPath) {
    //         const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
    //         const compilerOptions = tsCompilerConfig.options;
    //         if (compilerOptions.outDir) {
    //             outputPath = path.isAbsolute(compilerOptions.outDir)
    //                 ? path.resolve(compilerOptions.outDir)
    //                 : path.resolve(path.dirname(tsConfigPath), compilerOptions.outDir);
    //         }
    //     } else {
    //         outputPath = path.resolve(workspaceRoot, `dist/packages/${packageNameWithoutScope}`);
    //     }

    //     if (outputPath && !isSamePaths(projectRoot, outputPath) && !isInFolder(outputPath, projectRoot)) {
    //         outputPathAbs = outputPath;
    //     }
    // }

    if (!outputPathAbs) {
        throw new Error(
            `The outputPath could not be automatically detected. Set value in 'projects[${projectName}].tasks.build.outputPath' manually.`
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

    const buildConfigInternal: BuildConfigInternal = {
        ...buildConfig,
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
    await prepareBannerText(buildConfigInternal);

    // Copy assets
    await prepareAssetEntries(buildConfigInternal);

    // Styles
    await prepareForStyleModule(buildConfigInternal);

    // Scripts
    // await prepareScripts(buildConfigInternal);

    return buildConfigInternal;
}
