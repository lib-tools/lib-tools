import * as path from 'path';

import { Configuration, Plugin } from 'webpack';

import { BuildInfoWebpackPlugin } from '../plugins/build-info-webpack-plugin';
import { CleanWebpackPlugin } from '../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../plugins/copy-webpack-plugin';
import { LibBundleWebpackPlugin } from '../plugins/lib-bundle-webpack-plugin';

import { BuildOptionsInternal, ProjectConfigInternal } from '../../models/internals';
import { prepareCleanOptions } from '../../helpers';
import { LoggerBase } from '../../utils';

export async function getWebpackBuildConfig(
    projectConfig: ProjectConfigInternal,
    buildOptions: BuildOptionsInternal,
    logger: LoggerBase
): Promise<Configuration> {
    const projectRoot = projectConfig._projectRoot;
    const outputPath = projectConfig._outputPath;

    const plugins: Plugin[] = [
        // Info
        new BuildInfoWebpackPlugin({
            projectConfig,
            buildOptions,
            logger
        })
    ];

    // Clean
    let shouldClean = projectConfig.clean || projectConfig.clean !== false;
    if (projectConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        let cleanOutputPath = outputPath;
        if (projectConfig._isNestedPackage) {
            const nestedPackageStartIndex = projectConfig._packageNameWithoutScope.indexOf('/') + 1;
            const nestedPackageSuffix = projectConfig._packageNameWithoutScope.substr(nestedPackageStartIndex);
            cleanOutputPath = path.resolve(cleanOutputPath, nestedPackageSuffix);
        }

        const cleanOptions = prepareCleanOptions(projectConfig);
        const cacheDirs: string[] = [];

        plugins.push(
            new CleanWebpackPlugin({
                ...cleanOptions,
                workspaceRoot: projectConfig._workspaceRoot,
                outputPath: cleanOutputPath,
                cacheDirectries: cacheDirs,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // Bundle
    plugins.push(
        new LibBundleWebpackPlugin({
            projectConfig,
            buildOptions,
            logger
        })
    );

    // Copy assets
    if (projectConfig.copy && Array.isArray(projectConfig.copy) && projectConfig.copy.length > 0) {
        plugins.push(
            new CopyWebpackPlugin({
                assets: projectConfig.copy,
                baseDir: projectRoot,
                outputPath,
                allowCopyOutsideOutputPath: true,
                forceWriteToDisk: true,
                logLevel: buildOptions.logLevel
            })
        );
    }

    const webpackConfig: Configuration = {
        name: projectConfig.name,
        entry: () => ({}),
        output: {
            path: outputPath,
            filename: '[name].js'
        },
        context: projectRoot,
        plugins,
        stats: 'errors-only'
    };

    return Promise.resolve(webpackConfig);
}
