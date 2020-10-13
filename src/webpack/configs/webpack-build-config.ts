import { Configuration, WebpackPluginInstance } from 'webpack';

import {
    applyEnvOverrides,
    applyProjectExtends,
    getEnvironment,
    getWorkflowConfig,
    toBuildActionInternal
} from '../../helpers';
import { BuildCommandOptions, BuildConfigInternal, ProjectConfigInternal } from '../../models';

import { BuildInfoWebpackPlugin } from '../plugins/build-info-webpack-plugin';
import { PackageJsonFileWebpackPlugin } from '../plugins/package-json-webpack-plugin';

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
): Promise<Configuration> {
    const plugins: WebpackPluginInstance[] = [
        new BuildInfoWebpackPlugin({
            buildConfig,
            logLevel: buildCommandOptions.logLevel
        })
    ];

    // Clean plugin
    if (buildConfig.clean !== false) {
        const pluginModule = await import('../plugins/clean-webpack-plugin');
        const CleanWebpackPlugin = pluginModule.CleanWebpackPlugin;
        plugins.push(
            new CleanWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // styles
    if (buildConfig._styleEntries && buildConfig._styleEntries.length > 0) {
        const pluginModule = await import('../plugins/styles-webpack-plugin');
        const StylesWebpackPlugin = pluginModule.StylesWebpackPlugin;
        plugins.push(
            new StylesWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    if (buildConfig._script) {
        // Script compilations plugin
        if (buildConfig._script._compilations.length > 0) {
            const pluginModule = await import('../plugins/script-compilations-webpack-plugin');
            const ScriptCompilationsWebpackPlugin = pluginModule.ScriptCompilationsWebpackPlugin;
            plugins.push(
                new ScriptCompilationsWebpackPlugin({
                    buildConfig,
                    logLevel: buildCommandOptions.logLevel
                })
            );
        }

        // Script bundles plugin
        if (buildConfig._script._bundles.length > 0) {
            const pluginModule = await import('../plugins/script-bundles-webpack-plugin');
            const ScriptBundlesWebpackPlugin = pluginModule.ScriptBundlesWebpackPlugin;
            plugins.push(
                new ScriptBundlesWebpackPlugin({
                    buildConfig,
                    logLevel: buildCommandOptions.logLevel
                })
            );
        }
    }

    // Copy plugin
    if (buildConfig._assetEntries.length > 0) {
        const pluginModule = await import('../plugins/copy-webpack-plugin');
        const CopyWebpackPlugin = pluginModule.CopyWebpackPlugin;
        plugins.push(
            new CopyWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    // package.json plugin
    if (buildConfig.packageJson !== false) {
        plugins.push(
            new PackageJsonFileWebpackPlugin({
                buildConfig,
                logLevel: buildCommandOptions.logLevel
            })
        );
    }

    const webpackConfig: Configuration = {
        name: buildConfig._projectName,
        entry: () => ({}),
        output: {
            path: buildConfig._outputPath,
            filename: '[name].js'
        },
        context: buildConfig._projectRoot,
        plugins,
        stats: 'errors-only'
    };

    return Promise.resolve(webpackConfig);
}

function isFromWebpackCli(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?webpack(\.js)?$/i.test(process.argv[1]);
}
