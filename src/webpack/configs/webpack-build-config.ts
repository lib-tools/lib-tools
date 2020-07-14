import * as path from 'path';

import * as Ajv from 'ajv';
import { pathExists } from 'fs-extra';
import { Configuration, Plugin } from 'webpack';

import {
    applyEnvOverrides,
    applyProjectExtends,
    getCachedWorkflowConfigSchema,
    normalizeEnvironment,
    toBuildActionInternal,
    toWorkflowConfigInternal
} from '../../helpers';
import { BuildCommandOptions, WorkflowConfig } from '../../models';
import {
    BuildActionInternal,
    BuildCommandOptionsInternal,
    ProjectConfigInternal,
    WorkflowConfigInternal
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

        if (buildOptions.filter && Array.isArray(buildOptions.filter) && buildOptions.filter.length) {
            filteredProjectNames.push(...prepareFilterNames(buildOptions.filter));
        }
    }

    const workflowConfig = await getWorkflowConfig(buildOptions);

    const filteredProjectConfigs = Object.keys(workflowConfig.projects)
        .filter((projectName) => !filteredProjectNames.length || filteredProjectNames.includes(projectName))
        .map((projectName) => workflowConfig.projects[projectName]);

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

        if (projectConfigInternal.skip) {
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

async function getWorkflowConfig(buildOptions: BuildCommandOptionsInternal): Promise<WorkflowConfigInternal> {
    let foundConfigPath: string | null = null;
    if (buildOptions.workflow && buildOptions.workflow !== 'auto') {
        foundConfigPath = path.isAbsolute(buildOptions.workflow)
            ? buildOptions.workflow
            : path.resolve(process.cwd(), buildOptions.workflow);

        if (!(await pathExists(foundConfigPath))) {
            throw new Error(`Workflow configuration file ${buildOptions} doesn't exist.`);
        }
    }

    if (!buildOptions.workflow || buildOptions.workflow === 'auto') {
        foundConfigPath = await findUp(['workflow.json'], process.cwd(), path.parse(process.cwd()).root);
    }

    if (foundConfigPath) {
        try {
            const workflowConfig = (await readJsonWithComments(foundConfigPath)) as WorkflowConfig;
            const schema = await getCachedWorkflowConfigSchema();
            const valid = ajv.addSchema(schema, 'workflowSchema').validate('workflowSchema', workflowConfig);
            if (!valid) {
                throw new Error(`Invalid configuration.\n\n${ajv.errorsText()}`);
            }

            const workspaceRoot = path.extname(foundConfigPath) ? path.dirname(foundConfigPath) : foundConfigPath;
            return toWorkflowConfigInternal(workflowConfig, foundConfigPath, workspaceRoot);
        } catch (err) {
            throw new Error(`Invalid configuration. ${(err as Error).message || err}.`);
        }
    } else {
        if (buildOptions.workflow !== 'auto') {
            throw new Error(`Workflow configuration file could not be detected.`);
        }

        const projects = getProjectConfigsForAuto();

        return {
            _workspaceRoot: process.cwd(),
            _configPath: null,
            _auto: true,
            projects
        };
    }
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

    // Script compilation plugin
    if (buildAction._script && buildAction._script._compilations.length > 0) {
        const pluginModule = await import('../plugins/script-bundles-webpack-plugin');
        const ScriptBundlesWebpackPlugin = pluginModule.ScriptBundlesWebpackPlugin;
        plugins.push(
            new ScriptBundlesWebpackPlugin({
                buildAction,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // Script bundles plugin
    if (buildAction._script && buildAction._script._bundles.length > 0) {
        const pluginModule = await import('../plugins/script-bundles-webpack-plugin');
        const ScriptBundlesWebpackPlugin = pluginModule.ScriptBundlesWebpackPlugin;
        plugins.push(
            new ScriptBundlesWebpackPlugin({
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

function getProjectConfigsForAuto(): { [key: string]: ProjectConfigInternal } {
    const projects: { [key: string]: ProjectConfigInternal } = {};

    // TODO: To implement
    return projects;
}
