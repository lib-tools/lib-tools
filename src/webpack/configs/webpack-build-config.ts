import * as path from 'path';

import autoprefixer from 'autoprefixer';
import { Configuration } from 'webpack';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';

import {
    applyEnvOverrides,
    applyProjectExtends,
    getEnvironment,
    getWorkflowConfig,
    toBuildActionInternal
} from '../../helpers/index.js';
import { BuildCommandOptions, BuildConfigInternal, CleanOptions, ProjectConfigInternal } from '../../models/index.js';
import { LogLevelString, normalizePath } from '../../utils/index.js';

import { ProjectBuildInfoWebpackPlugin } from '../plugins/project-build-info-webpack-plugin/index.js';
import { CleanWebpackPlugin, CleanWebpackPluginOptions } from '../plugins/clean-webpack-plugin/index.js';
import { PackageJsonFileWebpackPlugin } from '../plugins/package-json-webpack-plugin/index.js';
import { StyleBuildInfoWebpackPlugin } from '../plugins/style-build-info-webpack-plugin/index.js';

export async function getWebpackBuildConfig(
    env?: { [key: string]: boolean | string },
    argv?: BuildCommandOptions & { [key: string]: unknown }
): Promise<Configuration[]> {
    let environment = getEnvironment(env, argv);
    let buildCommandOptions: BuildCommandOptions = {};
    const verbose = argv && typeof argv.verbose === 'boolean' ? argv.verbose : undefined;
    if (verbose) {
        buildCommandOptions.logLevel = 'debug';
    }

    const filteredProjectNames: string[] = [];

    if (argv) {
        buildCommandOptions = { ...(argv as BuildCommandOptions), ...buildCommandOptions };
    }

    if (buildCommandOptions.filter) {
        if (Array.isArray(buildCommandOptions.filter)) {
            buildCommandOptions.filter
                .filter((projectName) => projectName && !filteredProjectNames.includes(projectName))
                .forEach((projectName) => {
                    filteredProjectNames.push(projectName);
                });
        } else {
            buildCommandOptions.filter
                .split(',')
                .filter((projectName) => projectName && !filteredProjectNames.includes(projectName))
                .forEach((projectName) => {
                    filteredProjectNames.push(projectName);
                });
        }
    }

    buildCommandOptions.environment = environment;

    const workflowConfig = await getWorkflowConfig(buildCommandOptions, 'build');

    const projectConfigInternals = Object.keys(workflowConfig.projects)
        .filter((projectName) => !filteredProjectNames.length || filteredProjectNames.includes(projectName))
        .map((projectName) => workflowConfig.projects[projectName])
        .map((projectConfig) => JSON.parse(JSON.stringify(projectConfig)) as ProjectConfigInternal);

    const selectedProjectConfigInternals: ProjectConfigInternal[] = [];

    for (const projectConfigInternal of projectConfigInternals) {
        await applyProjectExtends(projectConfigInternal, workflowConfig.projects, projectConfigInternal._config);

        if (!projectConfigInternal.tasks || !projectConfigInternal.tasks.build) {
            continue;
        }

        if (projectConfigInternal._config !== 'auto') {
            applyEnvOverrides(projectConfigInternal.tasks.build, environment);
        }

        if (projectConfigInternal.tasks.build.skip) {
            continue;
        }

        selectedProjectConfigInternals.push(projectConfigInternal);
    }

    if (!selectedProjectConfigInternals.length) {
        throw new Error('No project config to build.');
    }

    const webpackConfigs: Configuration[] = [];

    let currentProjectNumber = 0;
    let totalProjectsCount = selectedProjectConfigInternals.length;

    for (const projectConfigInternal of selectedProjectConfigInternals) {
        ++currentProjectNumber;

        const buildConfigInternal = await toBuildActionInternal(projectConfigInternal, buildCommandOptions);
        const webpackBuildConfigs = await getWebpackBuildConfigInternal(
            buildConfigInternal,
            buildCommandOptions,
            currentProjectNumber,
            totalProjectsCount
        );

        webpackConfigs.push(...webpackBuildConfigs);
    }

    return webpackConfigs;
}

async function getWebpackBuildConfigInternal(
    buildConfig: BuildConfigInternal,
    buildCommandOptions: BuildCommandOptions,
    currentProjectNumber: number,
    totalProjectCount: number
): Promise<Configuration[]> {
    const webpackConfigs: Configuration[] = [];

    const firstWebpackConfig: Configuration = {
        name: `${buildConfig._projectName}`,
        entry: () => ({}),
        output: {
            path: buildConfig._outputPath,
            filename: '[name].js'
        },
        context: buildConfig._projectRoot,
        plugins: [
            new ProjectBuildInfoWebpackPlugin({
                buildConfig,
                currentProjectNumber,
                totalProjectCount,
                logLevel: buildCommandOptions.logLevel
            })
        ],
        stats: 'errors-only'
    };

    webpackConfigs.push(firstWebpackConfig);

    // Clean plugin for before build
    if (buildConfig.clean) {
        const cleanPlugin = getCleanWebpackPlugin(buildConfig, 'beforeBuild', buildCommandOptions.logLevel);
        if (cleanPlugin != null) {
            firstWebpackConfig.plugins?.push(cleanPlugin);
        }
    }

    // Copy plugin
    if (buildConfig._assetEntries.length > 0) {
        const pluginModule = await import('../plugins/copy-webpack-plugin/index.js');
        const CopyWebpackPlugin = pluginModule.CopyWebpackPlugin;
        firstWebpackConfig.plugins?.push(
            new CopyWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // styles
    if (buildConfig._styleEntries && buildConfig._styleEntries.length) {
        let styleCounter = 0;

        for (let styleEntry of buildConfig._styleEntries) {
            ++styleCounter;
            const inputFilePath = styleEntry._inputFilePath;
            const outFilePath = styleEntry._outputFilePath;
            const outputFileRelToOutputPath = normalizePath(path.relative(outFilePath, outFilePath));

            const vendorPrefixesOptions =
                typeof styleEntry._vendorPrefixes === 'object' ? styleEntry._vendorPrefixes : {};

            const scssRuleUses: {
                ident?: string;
                loader?: string;
                options?: string | { [index: string]: any };
            }[] = [];

            scssRuleUses.push({
                loader: 'css-loader',
                options: {
                    sourceMap: styleEntry._sourceMap
                }
            });
            if (styleEntry._vendorPrefixes !== false) {
                scssRuleUses.push({
                    loader: 'postcss-loader',
                    options: {
                        postcssOptions: {
                            plugins: [
                                autoprefixer({
                                    ...vendorPrefixesOptions
                                })
                            ]
                        }
                    }
                });
            }
            scssRuleUses.push({
                loader: 'sass-loader',
                options: {
                    sourceMap: styleEntry._sourceMap,

                    // Prefer Dart Sass
                    // implementation: require('sass'),

                    // See https://github.com/webpack-contrib/sass-loader/issues/804
                    webpackImporter: false,

                    // api: 'modern',
                    sassOptions: {
                        outputStyle: 'compressed',
                        includePaths: styleEntry._loadPaths
                    }
                }
            });

            const styleWebpackConfig: Configuration = {
                name: `${buildConfig._projectName}-style-${styleCounter}`,
                devtool: styleEntry._sourceMap ? 'source-map' : false,
                entry: inputFilePath,
                output: {
                    path: buildConfig._outputPath
                },
                context: buildConfig._projectRoot,
                module: {
                    rules: [
                        // {
                        //     test: /\.js$/,
                        //     exclude: /node_modules/,
                        //     use: []
                        // },
                        {
                            test: /\.(s[ac]|c)ss$/i,
                            type: 'asset/resource',
                            generator: {
                                filename: outputFileRelToOutputPath
                            },
                            use: [...scssRuleUses]
                        }
                    ]
                },
                plugins: [
                    new StyleBuildInfoWebpackPlugin({
                        styleEntryName: normalizePath(path.relative(buildConfig._workspaceRoot, inputFilePath))
                    })
                ],
                stats: 'errors-only'
            };

            if (styleEntry._minify !== false) {
                const minimizerPresetOptions = typeof styleEntry._minify === 'object' ? styleEntry._minify : {};

                styleWebpackConfig.optimization = {
                    // For development mode.
                    minimize: true,
                    minimizer: [
                        new CssMinimizerPlugin({
                            minimizerOptions: {
                                preset: [
                                    'default',
                                    {
                                        ...minimizerPresetOptions
                                    }
                                ]
                            }
                        })
                    ]
                };
            }

            webpackConfigs.push(styleWebpackConfig);
        }
    }

    if (buildConfig._script) {
        // TODO:
    }

    // package.json plugin
    if (buildConfig._packageJson) {
        firstWebpackConfig.plugins?.push(
            new PackageJsonFileWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // Clean plugin for after emits
    if (buildConfig.clean && typeof buildConfig.clean === 'object' && buildConfig.clean.afterEmit) {
        const cleanPlugin = getCleanWebpackPlugin(buildConfig, 'afterEmit', buildCommandOptions.logLevel);
        if (cleanPlugin != null) {
            if (webpackConfigs.length === 1) {
                firstWebpackConfig.plugins?.push(cleanPlugin);
            } else {
                const dependencies = webpackConfigs
                    .filter((wpConfig) => wpConfig.name)
                    .map((wpConfig) => wpConfig.name as string);

                const lastWebpackConfig: Configuration = {
                    name: `${buildConfig._projectName}-last`,
                    dependencies,
                    entry: () => ({}),
                    output: {
                        path: buildConfig._outputPath,
                        filename: '[name].js'
                    },
                    context: buildConfig._projectRoot,
                    plugins: [cleanPlugin],
                    stats: 'errors-only'
                };

                webpackConfigs.push(lastWebpackConfig);
            }
        }
    }

    return Promise.resolve(webpackConfigs);
}

function getCleanWebpackPlugin(
    buildConfig: BuildConfigInternal,
    cleanFor: 'beforeBuild' | 'afterEmit',
    logLevel?: LogLevelString
): CleanWebpackPlugin | null {
    const cleanConfigOptions =
        typeof buildConfig.clean === 'object' ? (JSON.parse(JSON.stringify(buildConfig.clean)) as CleanOptions) : {};

    if (
        cleanFor === 'afterEmit' &&
        (!cleanConfigOptions.afterEmit ||
            (cleanConfigOptions.afterEmit &&
                (!cleanConfigOptions.afterEmit.paths || !cleanConfigOptions.afterEmit.paths.length)))
    ) {
        return null;
    }

    let skipCleanOutDir = false;
    if (buildConfig._nestedPackage && cleanConfigOptions.beforeBuild && cleanConfigOptions.beforeBuild.cleanOutDir) {
        skipCleanOutDir = true;
    }

    if (cleanFor === 'beforeBuild') {
        if (
            skipCleanOutDir &&
            (!cleanConfigOptions.beforeBuild ||
                !Object.keys(cleanConfigOptions.beforeBuild).length ||
                !cleanConfigOptions.beforeBuild.paths ||
                !cleanConfigOptions.beforeBuild.paths.length)
        ) {
            return null;
        }
    }

    const workspaceRoot = buildConfig._workspaceRoot;
    let outputPath = buildConfig._outputPath;
    if (buildConfig._nestedPackage) {
        const nestedPackageStartIndex = buildConfig._packageNameWithoutScope.indexOf('/') + 1;
        const nestedPackageSuffix = buildConfig._packageNameWithoutScope.substr(nestedPackageStartIndex);
        outputPath = path.resolve(outputPath, nestedPackageSuffix);
    }

    const cleanOptions: CleanWebpackPluginOptions = {
        ...cleanConfigOptions,
        workspaceRoot,
        outputPath,
        logLevel
    };

    if (cleanFor === 'beforeBuild') {
        cleanOptions.beforeBuild = cleanOptions.beforeBuild || {};
        const beforeBuildOption = cleanOptions.beforeBuild;

        if (skipCleanOutDir) {
            beforeBuildOption.cleanOutDir = false;
        } else if (beforeBuildOption.cleanOutDir == null) {
            beforeBuildOption.cleanOutDir = true;
        }

        cleanOptions.beforeBuild = beforeBuildOption;
    }

    return new CleanWebpackPlugin(cleanOptions);
}
