import { Configuration, Plugin } from 'webpack';

import {
    applyEnvOverrides,
    applyProjectExtends,
    getWorkflowConfig,
    normalizeEnvironment,
    toBuildActionInternal
} from '../../helpers';
import { BuildCommandOptions } from '../../models';
import { BuildActionInternal, BuildCommandOptionsInternal, ProjectConfigInternal } from '../../models/internals';

import { ProjectBuildInfoWebpackPlugin } from '../plugins/project-build-info-webpack-plugin';
import { PackageJsonFileWebpackPlugin } from '../plugins/package-json-webpack-plugin';

export async function getWebpackBuildConfig(
    env?: { [key: string]: boolean | string },
    argv?: BuildCommandOptions & { [key: string]: unknown }
): Promise<Configuration[]> {
    const prod = argv && typeof argv.prod === 'boolean' ? argv.prod : undefined;
    const verbose = argv && typeof argv.verbose === 'boolean' ? argv.verbose : undefined;
    const environment = env ? normalizeEnvironment(env, prod) : {};
    let buildOptions: BuildCommandOptionsInternal = { environment };

    if (verbose) {
        buildOptions.logLevel = 'debug';
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

            if (rawEnv.buildOptions) {
                if (typeof rawEnv.buildOptions === 'object') {
                    buildOptions = { ...buildOptions, ...rawEnv.buildOptions };
                }

                delete rawEnv.buildOptions;
            }

            buildOptions.environment = {
                ...buildOptions.environment,
                ...normalizeEnvironment(rawEnv as { [key: string]: boolean | string }, prod)
            };
        }

        if (argv && argv.mode) {
            if (argv.mode === 'production') {
                buildOptions.environment.prod = true;
                buildOptions.environment.production = true;

                if (buildOptions.environment.dev) {
                    buildOptions.environment.dev = false;
                }
                if (buildOptions.environment.development) {
                    buildOptions.environment.development = false;
                }
            } else if (argv.mode === 'development') {
                buildOptions.environment.dev = true;
                buildOptions.environment.development = true;

                if (buildOptions.environment.prod) {
                    buildOptions.environment.prod = false;
                }
                if (buildOptions.environment.production) {
                    buildOptions.environment.production = false;
                }
            }
        }
    } else {
        if (argv) {
            buildOptions = { ...(argv as BuildCommandOptionsInternal), ...buildOptions };
        }

        if (buildOptions.filter) {
            if (Array.isArray(buildOptions.filter)) {
                buildOptions.filter
                    .filter((projectName) => projectName && !filteredProjectNames.includes(projectName))
                    .forEach((projectName) => {
                        filteredProjectNames.push(projectName);
                    });
            } else {
                buildOptions.filter
                    .split(',')
                    .filter((projectName) => projectName && !filteredProjectNames.includes(projectName))
                    .forEach((projectName) => {
                        filteredProjectNames.push(projectName);
                    });
            }
        }
    }

    const workflowConfig = await getWorkflowConfig(buildOptions);

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

        if (!projectConfigInternal.actions || !projectConfigInternal.actions.build) {
            continue;
        }

        if (projectConfigInternal._config !== 'auto') {
            applyEnvOverrides(projectConfigInternal.actions.build, buildOptions.environment);
        }

        if (projectConfigInternal.actions.build.skip) {
            continue;
        }

        const buildActionInternal = await toBuildActionInternal(projectConfigInternal, buildOptions);

        const wpConfig = (await getWebpackBuildConfigInternal(
            buildActionInternal,
            buildOptions
        )) as Configuration | null;

        if (wpConfig) {
            webpackConfigs.push(wpConfig);
        }
    }

    return webpackConfigs;
}

async function getWebpackBuildConfigInternal(
    buildAction: BuildActionInternal,
    buildOptions: BuildCommandOptionsInternal
): Promise<Configuration> {
    const plugins: Plugin[] = [
        new ProjectBuildInfoWebpackPlugin({
            buildAction,
            logLevel: buildOptions.logLevel
        })
    ];

    // Clean plugin
    if (buildAction.clean !== false) {
        const pluginModule = await import('../plugins/clean-webpack-plugin');
        const CleanWebpackPlugin = pluginModule.CleanWebpackPlugin;
        plugins.push(
            new CleanWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // styles
    if (buildAction._styleEntries && buildAction._styleEntries.length > 0) {
        const pluginModule = await import('../plugins/styles-webpack-plugin');
        const StylesWebpackPlugin = pluginModule.StylesWebpackPlugin;
        plugins.push(
            new StylesWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
    }

    if (buildAction._script) {
        // Script compilations plugin
        if (buildAction._script._compilations.length > 0) {
            const pluginModule = await import('../plugins/script-compilations-webpack-plugin');
            const ScriptCompilationsWebpackPlugin = pluginModule.ScriptCompilationsWebpackPlugin;
            plugins.push(
                new ScriptCompilationsWebpackPlugin({
                    buildAction,
                    logLevel: buildOptions.logLevel
                })
            );
        }

        // Script bundles plugin
        if (buildAction._script._bundles.length > 0) {
            const pluginModule = await import('../plugins/script-bundles-webpack-plugin');
            const ScriptBundlesWebpackPlugin = pluginModule.ScriptBundlesWebpackPlugin;
            plugins.push(
                new ScriptBundlesWebpackPlugin({
                    buildAction,
                    logLevel: buildOptions.logLevel
                })
            );
        }
    }

    // Copy plugin
    if (buildAction._assetEntries.length > 0) {
        const pluginModule = await import('../plugins/copy-webpack-plugin');
        const CopyWebpackPlugin = pluginModule.CopyWebpackPlugin;
        plugins.push(
            new CopyWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // package.json plugin
    plugins.push(
        new PackageJsonFileWebpackPlugin({
            buildAction,
            logLevel: buildOptions.logLevel
        })
    );

    const webpackConfig: Configuration = {
        name: buildAction._projectName,
        entry: () => ({}),
        output: {
            path: buildAction._outputPath,
            filename: '[name].js'
        },
        context: buildAction._projectRoot,
        plugins,
        stats: 'errors-only'
    };

    return Promise.resolve(webpackConfig);
}

function isFromWebpackCli(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?webpack(\.js)?$/i.test(process.argv[1]);
}
