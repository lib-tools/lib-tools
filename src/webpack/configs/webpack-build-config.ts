import * as path from 'path';

import { Configuration, Plugin } from 'webpack';

import { CleanWebpackPlugin } from '../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../plugins/copy-webpack-plugin';
import { LibBundleWebpackPlugin } from '../plugins/lib-bundle-webpack-plugin';

import { prepareCleanOptions } from '../../helpers';
import { InternalError } from '../../models/errors';
import { BuildOptionsInternal, LibProjectConfigInternal } from '../../models/internals';

export async function getWebpackBuildConfig(
    libConfig: LibProjectConfigInternal,
    buildOptions: BuildOptionsInternal
): Promise<Configuration> {
    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    if (!libConfig._outputPath) {
        throw new InternalError("The 'libConfig._outputPath' is not set.");
    }

    const logLevel = buildOptions.logLevel;
    const projectRoot = libConfig._projectRoot;
    const outputPath = libConfig._outputPath;

    const plugins: Plugin[] = [new AngularBuildContextWebpackPlugin(angularBuildContext)];

    // clean
    let shouldClean = libConfig.clean || libConfig.clean !== false;
    if (libConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        let cleanOutputPath = outputPath;
        if (libConfig._isNestedPackage) {
            if (!libConfig._packageNameWithoutScope) {
                throw new InternalError("The 'libConfig._packageNameWithoutScope' is not set.");
            }

            const nestedPackageStartIndex = libConfig._packageNameWithoutScope.indexOf('/') + 1;
            const nestedPackageSuffix = libConfig._packageNameWithoutScope.substr(nestedPackageStartIndex);
            cleanOutputPath = path.resolve(cleanOutputPath, nestedPackageSuffix);
        }

        const cleanOptions = prepareCleanOptions(libConfig);
        const cacheDirs: string[] = [];

        plugins.push(
            new CleanWebpackPlugin({
                ...cleanOptions,
                workspaceRoot: AngularBuildContext.workspaceRoot,
                outputPath: cleanOutputPath,
                cacheDirectries: cacheDirs,
                // tslint:disable-next-line: no-unsafe-any
                host: angularBuildContext.host,
                logLevel
            })
        );
    }

    // styles, ngc, bundle, packager
    plugins.push(
        new LibBundleWebpackPlugin({
            angularBuildContext
        })
    );

    // copy assets
    if (libConfig.copy && Array.isArray(libConfig.copy) && libConfig.copy.length > 0) {
        plugins.push(
            new CopyWebpackPlugin({
                assets: libConfig.copy,
                baseDir: projectRoot,
                outputPath,
                allowCopyOutsideOutputPath: true,
                forceWriteToDisk: true,
                logLevel
            })
        );
    }

    // tslint:disable-next-line:no-unnecessary-local-variable
    const webpackConfig: Configuration = {
        name: libConfig.name,
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
