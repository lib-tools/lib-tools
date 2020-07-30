import * as path from 'path';

import * as karma from 'karma';
import { Configuration as WebpackConfiguration } from 'webpack';

import {
    applyEnvOverrides,
    applyProjectExtends,
    findKarmaConfigFile,
    findTestEntryFile,
    findTestTsconfigFile,
    getWorkflowConfig,
    normalizeEnvironment
} from '../../helpers';
import { ProjectConfigInternal, TestCommandOptions, TestConfigInternal } from '../../models';
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

    const workflowConfig = await getWorkflowConfig(argv, 'test');
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

        if (!projectConfigInternal.tasks || !projectConfigInternal.tasks.test) {
            continue;
        }

        const testConfig = projectConfigInternal.tasks.test;

        if (projectConfigInternal._config !== 'auto') {
            applyEnvOverrides(testConfig, environment);
        }

        if (testConfig.skip) {
            continue;
        }

        const workspaceRoot = projectConfigInternal._workspaceRoot;
        const projectRoot = projectConfigInternal._projectRoot;

        let tsConfigPath: string | null = null;
        let entryFilePath: string | null = null;
        let karmaConfigPath: string | null = null;

        if (testConfig.tsConfig) {
            tsConfigPath = path.resolve(projectRoot, testConfig.tsConfig);
        } else if (projectConfigInternal._config !== 'auto') {
            tsConfigPath = await findTestTsconfigFile(projectRoot, workspaceRoot);
        }

        if (testConfig.entry) {
            entryFilePath = path.resolve(projectRoot, testConfig.entry);
        } else if (projectConfigInternal._config !== 'auto') {
            entryFilePath = await findTestEntryFile(projectRoot, workspaceRoot, tsConfigPath);
        }

        if (testConfig.karmaConfig) {
            karmaConfigPath = path.resolve(projectRoot, testConfig.karmaConfig);
        } else if (projectConfigInternal._config !== 'auto') {
            karmaConfigPath = await findKarmaConfigFile(projectRoot, workspaceRoot);
        }

        const testConfigInternal: TestConfigInternal = {
            ...testConfig,
            _config: projectConfigInternal._config,
            _workspaceRoot: projectConfigInternal._workspaceRoot,
            _projectRoot: projectConfigInternal._projectRoot,
            _projectName: projectConfigInternal._projectName,

            _entryFilePath: entryFilePath,
            _tsConfigPath: tsConfigPath,
            _karmaConfigPath: karmaConfigPath
        };

        const karmaOptions: KarmaConfigOptions = {
            logger
        };

        if (argv.watch != null) {
            karmaOptions.singleRun = !argv.watch;
        }

        if (argv.browsers) {
            if (Array.isArray(argv.browsers)) {
                karmaOptions.browsers = argv.browsers.filter((b) => b.length);
            } else {
                karmaOptions.browsers = argv.browsers.split(',').filter((b) => b.length);
            }
        } else if (testConfigInternal.browsers) {
            karmaOptions.browsers = testConfigInternal.browsers;
        }

        if (argv.reporters) {
            if (Array.isArray(argv.reporters)) {
                karmaOptions.reporters = argv.reporters.filter((r) => r.length);
            } else {
                karmaOptions.reporters = argv.reporters.split(',').filter((r) => r.length);
            }
        } else if (testConfigInternal.reporters) {
            karmaOptions.reporters = testConfigInternal.reporters;
        }

        if (argv.codeCoverage != null) {
            karmaOptions.codeCoverage = argv.codeCoverage;
        } else if (testConfigInternal.codeCoverage != null) {
            karmaOptions.codeCoverage = testConfigInternal.codeCoverage;
        }

        if (argv.karmaConfig) {
            karmaOptions.configFile = path.isAbsolute(argv.karmaConfig)
                ? path.resolve(argv.karmaConfig)
                : path.resolve(process.cwd(), argv.karmaConfig);
        } else if (testConfigInternal.karmaConfig) {
            karmaOptions.configFile = path.resolve(testConfigInternal._projectRoot, testConfigInternal.karmaConfig);
        }

        karmaOptions.webpackConfig = await getWebpackTestConfig(testConfigInternal);

        let karmaServerWithStop: { stop: () => Promise<void> } | undefined;

        const exitCode = await new Promise<number>((res) => {
            const karmaServer = new karma.Server(karmaOptions, (serverCallback) => {
                res(serverCallback);
            });
            karmaServerWithStop = (karmaServer as unknown) as { stop: () => Promise<void> };

            karmaServer.start();
        });

        if (karmaServerWithStop && typeof karmaServerWithStop.stop === 'function') {
            await karmaServerWithStop.stop();
        }

        if (exitCode !== 0) {
            return exitCode;
        }
    }

    return 0;
}
