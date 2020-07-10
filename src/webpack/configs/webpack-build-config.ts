import * as path from 'path';

import * as Ajv from 'ajv';
import { pathExists } from 'fs-extra';
import { Configuration, Plugin } from 'webpack';

import {
    applyProjectExtends,
    normalizeEnvironment,
    readWorkflowsConfigSchema,
    toBuildActionInternal,
    toWorkflowsConfigInternal
} from '../../helpers';
import { BuildCommandOptions, WorkflowsConfig } from '../../models';
import {
    BuildActionInternal,
    BuildOptionsInternal,
    ProjectConfigInternal,
    WorkflowsConfigInternal
} from '../../models/internals';
import { findUp, readJsonWithComments } from '../../utils';

import { ProjectBuildInfoWebpackPlugin } from '../plugins/project-build-info-webpack-plugin';
import { PackageJsonFileWebpackPlugin } from '../plugins/package-json-webpack-plugin';

const ajv = new Ajv();

export async function getWebpackBuildConfig(
    env?: { [key: string]: boolean | string },
    argv?: BuildCommandOptions & { [key: string]: unknown }
): Promise<Configuration[]> {
    const prod = argv && typeof argv.prod === 'boolean' ? argv.prod : undefined;
    const verbose = argv && typeof argv.verbose === 'boolean' ? argv.verbose : undefined;
    const environment = env ? normalizeEnvironment(env, prod) : {};

    let buildOptions: BuildOptionsInternal = { environment };
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
            buildOptions = { ...(argv as BuildOptionsInternal), ...buildOptions };
        }

        if (buildOptions.filter && Array.isArray(buildOptions.filter) && buildOptions.filter.length) {
            filteredProjectNames.push(...prepareFilterNames(buildOptions.filter));
        }
    }

    const workflowConfig = await getWorkflowsConfig(buildOptions);

    const filteredProjectConfigs = Object.keys(workflowConfig.projects)
        .filter((projectName) => !filteredProjectNames.length || filteredProjectNames.includes(projectName))
        .map((projectName) => workflowConfig.projects[projectName]);

    const webpackConfigs: Configuration[] = [];

    for (const projectConfig of filteredProjectConfigs) {
        const projectConfigInternal = JSON.parse(JSON.stringify(projectConfig)) as ProjectConfigInternal;
        if (projectConfigInternal._configPath) {
            const configPath = projectConfig._configPath as string;
            await applyProjectExtends(projectConfigInternal, workflowConfig.projects, configPath);
        }

        if (projectConfigInternal.skip) {
            continue;
        }

        if (!projectConfigInternal.actions || !projectConfigInternal.actions.build) {
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

async function getWorkflowsConfig(buildOptions: BuildOptionsInternal): Promise<WorkflowsConfigInternal> {
    let foundConfigPath: string | null = null;
    if (!buildOptions.config) {
        foundConfigPath = await findUp(['workflows.json'], process.cwd(), path.parse(process.cwd()).root);
    }

    if (buildOptions.auto && !buildOptions.config && foundConfigPath === null) {
        throw new Error('This feature is not implemented.');
    } else {
        let configPath: string;
        if (buildOptions.config) {
            configPath = path.isAbsolute(buildOptions.config)
                ? buildOptions.config
                : path.resolve(process.cwd(), buildOptions.config);

            if (!(await pathExists(configPath))) {
                throw new Error(`Config file doesn't exist at ${configPath}.`);
            }
        } else {
            if (!foundConfigPath) {
                throw new Error('Could not detect workflows.json file.');
            }

            configPath = foundConfigPath;
        }

        try {
            const workflowsConfig = (await readJsonWithComments(configPath)) as WorkflowsConfig;
            const schema = await readWorkflowsConfigSchema();

            if (schema.$schema) {
                delete schema.$schema;
            }

            const valid = ajv.addSchema(schema, 'workflowsSchema').validate('workflowsSchema', workflowsConfig);

            if (!valid) {
                const errorsText = ajv.errorsText();
                throw new Error(`Invalid configuration.\n\n${errorsText}`);
            }

            const workspaceRoot = path.dirname(configPath);
            return toWorkflowsConfigInternal(workflowsConfig, configPath, workspaceRoot);
        } catch (error) {
            throw new Error(`Invalid configuration, error: ${(error as Error).message || error}.`);
        }
    }
}

async function getWebpackBuildConfigInternal(
    buildAction: BuildActionInternal,
    buildOptions: BuildOptionsInternal
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

    // Typescript transpilation plugin
    if (buildAction._scriptTranspilationEntries && buildAction._scriptTranspilationEntries.length > 0) {
        const pluginModule = await import('../plugins/ts-transpilations-webpack-plugin');
        const TsTranspilationsWebpackPlugin = pluginModule.TsTranspilationsWebpackPlugin;
        plugins.push(
            new TsTranspilationsWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // styles
    if (buildAction._styleEntries && buildAction._styleEntries.length > 0) {
        const pluginModule = await import('../plugins/styles-bundle-webpack-plugin');
        const StyleBundleWebpackPlugin = pluginModule.StyleBundleWebpackPlugin;
        plugins.push(
            new StyleBundleWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // Rollup bundles plugin
    if (buildAction._scriptBundleEntries && buildAction._scriptBundleEntries.length > 0) {
        const pluginModule = await import('../plugins/rollup-bundles-webpack-plugin');
        const RollupBundlesWebpackPlugin = pluginModule.RollupBundlesWebpackPlugin;
        plugins.push(
            new RollupBundlesWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
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

function prepareFilterNames(filter: string | string[]): string[] {
    const filterNames: string[] = [];

    if (filter && (Array.isArray(filter) || typeof filter === 'string')) {
        if (Array.isArray(filter)) {
            filter.forEach((filterName) => {
                if (filterName && filterName.trim() && !filterNames.includes(filterName.trim())) {
                    filterNames.push(filterName.trim());
                }
            });
        } else if (filter && filter.trim()) {
            filterNames.push(filter);
        }
    }

    return filterNames;
}

function isFromWebpackCli(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?webpack(\.js)?$/i.test(process.argv[1]);
}
