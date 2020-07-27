import * as path from 'path';

import * as karma from 'karma';
import { Configuration as WebpackConfiguration } from 'webpack';
import { applyEnvOverrides, applyProjectExtends, getWorkflowConfig, normalizeEnvironment } from '../../helpers';
import { TestCommandOptions } from '../../models';
import { ProjectConfigInternal } from '../../models/internals';
import { LogLevelString, Logger, LoggerBase } from '../../utils';
import { getWebpackTestConfig } from '../../webpack/configs';

export interface KarmaConfigOptions extends karma.ConfigOptions {
    configFile?: string;
    webpackConfig?: WebpackConfiguration;
    codeCoverage?: boolean;
    logger?: LoggerBase;
}

export async function cliTest(argv: TestCommandOptions & { [key: string]: unknown }): Promise<number> {
    const prod = argv && typeof argv.prod === 'boolean' ? argv.prod : undefined;
    let env: { [key: string]: boolean | string } | undefined;

    if (argv.environment) {
        env = argv.environment as { [key: string]: boolean | string };
        delete argv.environment;
    }

    if (argv.env) {
        if (!env) {
            env = argv.env as { [key: string]: boolean | string };
        }

        delete argv.env;
    }
    const environment = env ? normalizeEnvironment(env, prod) : {};

    const verbose = argv && typeof argv.verbose === 'boolean' ? argv.verbose : undefined;
    const logLevel = verbose ? 'debug' : argv.logLevel ? (argv.logLevel as LogLevelString) : 'info';
    const logger = new Logger({
        logLevel
    });

    const karmaOptions: KarmaConfigOptions = {
        logger
    };

    if (argv.watch != null) {
        karmaOptions.singleRun = argv.watch;
    }

    const workflowConfig = await getWorkflowConfig(argv);

    const filteredProjectNames: string[] = [];
    if (argv.filter) {
        if (Array.isArray(argv.filter)) {
            argv.filter
                .filter((projectName) => projectName && !filteredProjectNames.includes(projectName))
                .forEach((projectName) => {
                    filteredProjectNames.push(projectName);
                });
        } else {
            argv.filter
                .split(',')
                .filter((projectName) => projectName && !filteredProjectNames.includes(projectName))
                .forEach((projectName) => {
                    filteredProjectNames.push(projectName);
                });
        }
    }

    const filteredProjectConfigs = Object.keys(workflowConfig.projects)
        .filter((projectName) => !filteredProjectNames.length || filteredProjectNames.includes(projectName))
        .map((projectName) => workflowConfig.projects[projectName]);

    if (!filteredProjectConfigs.length) {
        throw new Error('No project config to test.');
    }

    for (const projectConfig of filteredProjectConfigs) {
        const projectConfigInternal = JSON.parse(JSON.stringify(projectConfig)) as ProjectConfigInternal;
        if (projectConfigInternal._config !== 'auto') {
            await applyProjectExtends(projectConfigInternal, workflowConfig.projects, projectConfig._config);
        }

        if (!projectConfigInternal.actions || !projectConfigInternal.actions.test) {
            continue;
        }

        const testAction = projectConfigInternal.actions.test;

        if (projectConfigInternal._config !== 'auto') {
            applyEnvOverrides(testAction, environment);
        }

        if (testAction.skip) {
            continue;
        }

        const projectRoot = projectConfigInternal._projectRoot;

        if (argv.browsers) {
            if (Array.isArray(argv.browsers)) {
                karmaOptions.browsers = argv.browsers.filter((b) => b.length);
            } else {
                karmaOptions.browsers = argv.browsers.split(',').filter((b) => b.length);
            }
        } else if (testAction.browsers) {
            karmaOptions.browsers = testAction.browsers;
        }

        if (argv.reporters) {
            if (Array.isArray(argv.reporters)) {
                karmaOptions.reporters = argv.reporters.filter((r) => r.length);
            } else {
                karmaOptions.reporters = argv.reporters.split(',').filter((r) => r.length);
            }
        } else if (testAction.reporters) {
            karmaOptions.reporters = testAction.reporters;
        }

        if (argv.codeCoverage != null) {
            karmaOptions.codeCoverage = argv.codeCoverage;
        } else if (testAction.codeCoverage != null) {
            karmaOptions.codeCoverage = testAction.codeCoverage;
        }

        if (testAction.karmaConfig) {
            karmaOptions.configFile = path.resolve(projectRoot, testAction.karmaConfig);
        }

        const webpackConfig = await getWebpackTestConfig(projectConfigInternal._projectName, projectRoot, testAction);
        karmaOptions.webpackConfig = webpackConfig;
    }

    const karmaServer = new karma.Server(karmaOptions);
    // Karma typings incorrectly define start's return value as void
    const karmaStartPromise = (karmaServer.start() as unknown) as Promise<void>;

    const karmaServerWithStop = (karmaServer as unknown) as { stop: () => Promise<void> };
    if (typeof karmaServerWithStop.stop === 'function') {
        await karmaStartPromise;
        await karmaServerWithStop.stop();
    }

    return 0;
}
