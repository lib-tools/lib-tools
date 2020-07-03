import * as path from 'path';

import { pathExists } from 'fs-extra';
import { Configuration, Plugin } from 'webpack';

import {
    applyProjectConfigExtends,
    normalizeEnvironment,
    readLibConfigSchema,
    toLibConfigInternal,
    toProjectBuildConfigInternal
} from '../../helpers';
import { BuildCommandOptions, LibConfig } from '../../models';
import { BuildOptionsInternal, ProjectBuildConfigInternal, ProjectConfigInternal } from '../../models/internals';
import { formatValidationError, readJsonWithComments, validateSchema } from '../../utils';

import { ProjectBuildInfoWebpackPlugin } from '../plugins/project-build-info-webpack-plugin';
import { PackageJsonFileWebpackPlugin } from '../plugins/package-json-webpack-plugin';

export async function getWebpackBuildConfig(
    configPath: string,
    env?: string | { [key: string]: boolean | string },
    argv?: BuildCommandOptions & { [key: string]: unknown }
): Promise<Configuration[]> {
    if (!configPath) {
        throw new Error("The 'configPath' parameter is required.");
    }

    if (!/\.json$/i.test(configPath)) {
        throw new Error(`Invalid config file: ${configPath}.`);
    }

    if (!(await pathExists(configPath))) {
        throw new Error(`Config file: ${configPath} doesn't exist.`);
    }

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

    let libConfig: LibConfig | null = null;

    try {
        libConfig = ((await readJsonWithComments(configPath)) as unknown) as LibConfig;
    } catch (error) {
        throw new Error(`Invalid configuration, error: ${(error as Error).message || error}.`);
    }

    const libConfigSchema = await readLibConfigSchema();

    if (libConfigSchema.$schema) {
        delete libConfigSchema.$schema;
    }

    const errors = validateSchema(libConfigSchema, (libConfig as unknown) as { [key: string]: unknown });
    if (errors.length) {
        const errMsg = errors.map((err) => formatValidationError(libConfigSchema, err)).join('\n');
        throw new Error(`Invalid configuration.\n\n${errMsg}`);
    }

    // TODO: To review
    const workspaceRoot = path.dirname(configPath);
    const libConfigInternal = toLibConfigInternal(libConfig, configPath, workspaceRoot);
    const filteredProjectConfigs = Object.keys(libConfigInternal.projects)
        .filter((projectName) => !filteredProjectNames.length || filteredProjectNames.includes(projectName))
        .map((projectName) => libConfigInternal.projects[projectName]);

    const webpackConfigs: Configuration[] = [];

    for (const projectConfig of filteredProjectConfigs) {
        const projectConfigInternal = JSON.parse(JSON.stringify(projectConfig)) as ProjectConfigInternal;
        await applyProjectConfigExtends(projectConfigInternal, libConfigInternal.projects);

        if (projectConfigInternal.skip) {
            continue;
        }

        if (!projectConfigInternal.tasks || !projectConfigInternal.tasks.build) {
            continue;
        }

        const projectBuildConfigInternal = await toProjectBuildConfigInternal(projectConfigInternal, buildOptions);

        const wpConfig = (await getWebpackBuildConfigInternal(
            projectBuildConfigInternal,
            buildOptions
        )) as Configuration | null;
        if (wpConfig) {
            webpackConfigs.push(wpConfig);
        }
    }

    return webpackConfigs;
}

async function getWebpackBuildConfigInternal(
    projectBuildConfig: ProjectBuildConfigInternal,
    buildOptions: BuildOptionsInternal
): Promise<Configuration> {
    const plugins: Plugin[] = [
        new ProjectBuildInfoWebpackPlugin({
            projectBuildConfig,
            logLevel: buildOptions.logLevel
        })
    ];

    // Clean plugin
    if (projectBuildConfig.clean !== false) {
        const pluginModule = await import('../plugins/clean-webpack-plugin');
        const CleanWebpackPlugin = pluginModule.CleanWebpackPlugin;
        plugins.push(
            new CleanWebpackPlugin({
                projectBuildConfig,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // Typescript transpilation plugin
    if (projectBuildConfig._tsTranspilations && projectBuildConfig._tsTranspilations.length > 0) {
        const pluginModule = await import('../plugins/ts-transpilations-webpack-plugin');
        const TsTranspilationsWebpackPlugin = pluginModule.TsTranspilationsWebpackPlugin;
        plugins.push(
            new TsTranspilationsWebpackPlugin({
                projectBuildConfig,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // styles
    if (projectBuildConfig._styleParsedEntries && projectBuildConfig._styleParsedEntries.length > 0) {
        const pluginModule = await import('../plugins/styles-bundle-webpack-plugin');
        const StyleBundleWebpackPlugin = pluginModule.StyleBundleWebpackPlugin;
        plugins.push(
            new StyleBundleWebpackPlugin({
                projectBuildConfig,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // Rollup bundles plugin
    if (projectBuildConfig._bundles && projectBuildConfig._bundles.length > 0) {
        const pluginModule = await import('../plugins/rollup-bundles-webpack-plugin');
        const RollupBundlesWebpackPlugin = pluginModule.RollupBundlesWebpackPlugin;
        plugins.push(
            new RollupBundlesWebpackPlugin({
                projectBuildConfig,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // Copy plugin
    if (projectBuildConfig._copyAssets && projectBuildConfig._copyAssets.length > 0) {
        const pluginModule = await import('../plugins/copy-webpack-plugin');
        const CopyWebpackPlugin = pluginModule.CopyWebpackPlugin;
        plugins.push(
            new CopyWebpackPlugin({
                assets: projectBuildConfig._copyAssets,
                projectRoot: projectBuildConfig._projectRoot,
                outputPath: projectBuildConfig._outputPath,
                allowCopyOutsideOutputPath: true,
                forceWriteToDisk: true,
                logLevel: buildOptions.logLevel
            })
        );
    }

    // package.json plugin
    plugins.push(
        new PackageJsonFileWebpackPlugin({
            projectBuildConfig,
            logLevel: buildOptions.logLevel
        })
    );

    const webpackConfig: Configuration = {
        name: projectBuildConfig._projectName,
        entry: () => ({}),
        output: {
            path: projectBuildConfig._outputPath,
            filename: '[name].js'
        },
        context: projectBuildConfig._projectRoot,
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
