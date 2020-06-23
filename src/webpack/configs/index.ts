import { pathExists } from 'fs-extra';
import { Configuration } from 'webpack';

import { isFromBuiltInCli, isFromWebpackCli, normalizeEnvironment, readSchema } from '../../helpers';
import { LibConfig } from '../../models';
import { InvalidConfigError } from '../../models/errors';
import { BuildCommandOptions, BuildOptionsInternal } from '../../models/internals';
import { LoggerBase, formatValidationError, readJson, validateSchema } from '../../utils';

export async function getWebpackBuildConfig(
    configPath: string,
    env?: string | { [key: string]: boolean | string },
    argv?: BuildCommandOptions & { [key: string]: unknown },
    logger?: LoggerBase
): Promise<Configuration> {
    const startTime = argv && argv._startTime && typeof argv._startTime === 'number' ? argv._startTime : Date.now();
    const fromBuiltInCli =
        argv && typeof argv._fromBuiltInCli === 'boolean' ? argv._fromBuiltInCli : isFromBuiltInCli();

    if (!configPath || !configPath.length) {
        throw new InvalidConfigError("The 'configPath' is required.");
    }

    if (!/\.json$/i.test(configPath)) {
        throw new InvalidConfigError(`Invalid config file, path: ${configPath}.`);
    }

    if (!(await pathExists(configPath))) {
        throw new InvalidConfigError(`The config file does not exist at ${configPath}.`);
    }

    const prod = argv && typeof argv.prod === 'boolean' ? argv.prod : undefined;
    const verbose = argv && typeof argv.verbose === 'boolean' ? argv.verbose : undefined;
    const environment = env ? normalizeEnvironment(env, prod) : {};

    let buildOptions: BuildOptionsInternal = { environment };
    if (verbose) {
        buildOptions.logLevel = 'debug';
    }

    const cliRootPath = fromBuiltInCli && argv && argv._cliRootPath ? argv._cliRootPath : undefined;
    const cliIsGlobal = fromBuiltInCli && argv && argv._cliIsGlobal ? (argv._cliIsGlobal as boolean) : undefined;
    const cliIsLink = fromBuiltInCli && argv && argv._cliIsLink ? (argv._cliIsLink as boolean) : undefined;
    const cliVersion = fromBuiltInCli && argv && argv._cliVersion ? argv._cliVersion : undefined;

    const filteredProjectNames: string[] = [];

    if (isFromWebpackCli() && !fromBuiltInCli) {
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
        libConfig = ((await readJson(configPath)) as unknown) as LibConfig;
    } catch (error) {
        throw new InvalidConfigError(`Invalid configuration, error: ${(error as Error).message || error}.`);
    }

    const libConfigSchema = await readSchema();

    if (libConfigSchema.$schema) {
        delete libConfigSchema.$schema;
    }

    const errors = validateSchema(libConfigSchema, (libConfig as unknown) as { [key: string]: unknown });
    if (errors.length) {
        const errMsg = errors.map((err) => formatValidationError(libConfigSchema, err)).join('\n');
        throw new InvalidConfigError(`Invalid configuration.\n\n${errMsg}`);
    }
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
