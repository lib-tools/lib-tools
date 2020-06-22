import * as path from 'path';

import { Configuration, Plugin } from 'webpack';

import { BuildContextWebpackPlugin } from '../plugins/build-context-webpack-plugin';
import { CleanWebpackPlugin } from '../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../plugins/copy-webpack-plugin';
import { LibBundleWebpackPlugin } from '../plugins/lib-bundle-webpack-plugin';

import { InternalError } from '../../models/errors';
import { BuildOptionsInternal, LibProjectConfigInternal } from '../../models/internals';
import { prepareCleanOptions } from '../../helpers';
import { LoggerBase } from '../../utils';

export async function getWebpackBuildConfig(
    projectConfig: LibProjectConfigInternal,
    buildOptions: BuildOptionsInternal,
    logger: LoggerBase
): Promise<Configuration> {
    if (!projectConfig._projectRoot) {
        throw new InternalError("The 'projectConfig._projectRoot' is not set.");
    }

    if (!projectConfig._outputPath) {
        throw new InternalError("The 'projectConfig._outputPath' is not set.");
    }

    const projectRoot = projectConfig._projectRoot;
    const outputPath = projectConfig._outputPath;

    const plugins: Plugin[] = [];

    plugins.push(
        new BuildContextWebpackPlugin({
            projectConfig,
            buildOptions,
            logger
        })
    );

    // clean
    let shouldClean = projectConfig.clean || projectConfig.clean !== false;
    if (projectConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        let cleanOutputPath = outputPath;
        if (projectConfig._isNestedPackage) {
            if (!projectConfig._packageNameWithoutScope) {
                throw new InternalError("The 'projectConfig._packageNameWithoutScope' is not set.");
            }

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

    plugins.push(
        new LibBundleWebpackPlugin({
            projectConfig,
            buildOptions,
            logger
        })
    );

    // copy assets
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
