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
import { BuildCommandOptions, BuildConfigInternal, ProjectConfigInternal } from '../../models/index.js';
import { normalizePath } from '../../utils/index.js';

import { BuildInfoWebpackPlugin } from '../plugins/build-info-webpack-plugin/index.js';
import { PackageJsonFileWebpackPlugin } from '../plugins/package-json-webpack-plugin/index.js';

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

    if (isFromWebpackCli()) {
        if (argv && (argv.projectName || argv['project-name'])) {
            const projectName = (argv.projectName || argv['project-name']) as string;
            filteredProjectNames.push(projectName);
        }

        if (!env && process.env.WEBPACK_ENV) {
            const rawEnvStr = process.env.WEBPACK_ENV;
            const rawEnv =
                typeof rawEnvStr === 'string'
                    ? (JSON.parse(rawEnvStr) as { [key: string]: unknown })
                    : (rawEnvStr as { [key: string]: unknown });

            if (rawEnv.buildCommandOptions) {
                if (typeof rawEnv.buildCommandOptions === 'object') {
                    buildCommandOptions = { ...buildCommandOptions, ...rawEnv.buildCommandOptions };
                }

                delete rawEnv.buildCommandOptions;
            }

            environment = {
                ...environment,
                ...getEnvironment(rawEnv as { [key: string]: boolean | string }, null)
            };
        }

        if (argv && argv.mode) {
            if (argv.mode === 'production') {
                environment.prod = true;
                environment.production = true;

                if (environment.dev) {
                    environment.dev = false;
                }
                if (environment.development) {
                    environment.development = false;
                }
            } else if (argv.mode === 'development') {
                environment.dev = true;
                environment.development = true;

                if (environment.prod) {
                    environment.prod = false;
                }
                if (environment.production) {
                    environment.production = false;
                }
            }
        }
    } else {
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
    }

    buildCommandOptions.environment = environment;

    const workflowConfig = await getWorkflowConfig(buildCommandOptions, 'build');

    const filteredProjectConfigs = Object.keys(workflowConfig.projects)
        .filter((projectName) => !filteredProjectNames.length || filteredProjectNames.includes(projectName))
        .map((projectName) => workflowConfig.projects[projectName]);

    if (!filteredProjectConfigs.length) {
        throw new Error('No project config to build.');
    }

    const webpackConfigs: Configuration[] = [];

    for (const projectConfig of filteredProjectConfigs) {
        const projectConfigInternal = JSON.parse(JSON.stringify(projectConfig)) as ProjectConfigInternal;
        if (projectConfigInternal._config !== 'auto') {
            await applyProjectExtends(projectConfigInternal, workflowConfig.projects, projectConfig._config);
        }

        if (!projectConfigInternal.tasks || !projectConfigInternal.tasks.build) {
            continue;
        }

        if (projectConfigInternal._config !== 'auto') {
            applyEnvOverrides(projectConfigInternal.tasks.build, environment);
        }

        if (projectConfigInternal.tasks.build.skip) {
            continue;
        }

        const buildConfigInternal = await toBuildActionInternal(projectConfigInternal, buildCommandOptions);

        const wpConfig = (await getWebpackBuildConfigInternal(
            buildConfigInternal,
            buildCommandOptions
        )) as Configuration | null;

        if (wpConfig) {
            webpackConfigs.push(wpConfig);
        }
    }

    return webpackConfigs;
}

async function getWebpackBuildConfigInternal(
    buildConfig: BuildConfigInternal,
    buildCommandOptions: BuildCommandOptions
): Promise<Configuration[]> {
    const webpackConfigs: Configuration[] = [];

    const rootWebpackConfig: Configuration = {
        name: buildConfig._projectName,
        entry: () => ({}),
        output: {
            path: buildConfig._outputPath,
            filename: '[name].js'
        },
        context: buildConfig._projectRoot,
        plugins: [
            new BuildInfoWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        ],
        stats: 'errors-only'
    };

    webpackConfigs.push(rootWebpackConfig);

    // Clean plugin
    if (buildConfig.clean !== false) {
        const pluginModule = await import('../plugins/clean-webpack-plugin/index.js');
        const CleanWebpackPlugin = pluginModule.CleanWebpackPlugin;
        rootWebpackConfig.plugins?.push(
            new CleanWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // Copy plugin
    if (buildConfig._assetEntries.length > 0) {
        const pluginModule = await import('../plugins/copy-webpack-plugin/index.js');
        const CopyWebpackPlugin = pluginModule.CopyWebpackPlugin;
        rootWebpackConfig.plugins?.push(
            new CopyWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // package.json plugin
    if (buildConfig._packageJson) {
        rootWebpackConfig.plugins?.push(
            new PackageJsonFileWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // styles
    if (buildConfig._styleEntries && buildConfig._styleEntries.length > 0) {
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
                    implementation: require('sass'),

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

    return Promise.resolve(webpackConfigs);
}

function isFromWebpackCli(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?webpack(\.js)?$/i.test(process.argv[1]);
}
