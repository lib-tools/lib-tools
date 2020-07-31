import * as path from 'path';

import * as karma from 'karma';
import { Configuration as WebpackConfiguration } from 'webpack';

import {
    applyEnvOverrides,
    applyProjectExtends,
    findKarmaConfigFile,
    findTestEntryFile,
    findTestTsconfigFile,
    getEnvironment,
    getWorkflowConfig
} from '../../helpers';
import { ProjectConfigInternal, TestCommandOptions, TestConfigInternal } from '../../models';
import { LogLevelString, Logger, LoggerBase, normalizePath } from '../../utils';
import { getWebpackTestConfig } from '../../webpack/configs';

export interface KarmaConfigOptions extends karma.ConfigOptions {
    webpackConfig: WebpackConfiguration;
    configFile: string | null;
    codeCoverage?: boolean;
    logger: LoggerBase;
    coverageIstanbulReporter?: { [key: string]: unknown };
    junitReporter?: { [key: string]: unknown };
}

export async function cliTest(argv: TestCommandOptions & { [key: string]: unknown }): Promise<number> {
    const environment = getEnvironment(null, argv);
    if (argv.environment) {
        delete argv.environment;
    }

    if (argv.env) {
        delete argv.env;
    }

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

        let karmaConfigPath: string | null = null;
        let tsConfigPath: string | null = null;
        let entryFilePath: string | null = null;
        let codeCoverage: boolean | undefined;

        if (argv.karmaConfig) {
            karmaConfigPath = path.isAbsolute(argv.karmaConfig)
                ? path.resolve(argv.karmaConfig)
                : path.resolve(process.cwd(), argv.karmaConfig);
        } else {
            if (testConfig.karmaConfig) {
                karmaConfigPath = path.resolve(projectRoot, testConfig.karmaConfig);
            } else if (projectConfigInternal._config !== 'auto') {
                karmaConfigPath = await findKarmaConfigFile(projectRoot, workspaceRoot);
            }
        }

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

        if (argv.codeCoverage != null) {
            codeCoverage = argv.codeCoverage;
        } else if (testConfig.codeCoverage != null) {
            codeCoverage = testConfig.codeCoverage;
        }

        const testConfigInternal: TestConfigInternal = {
            ...testConfig,
            _config: projectConfigInternal._config,
            _workspaceRoot: workspaceRoot,
            _projectRoot: projectRoot,
            _projectName: projectConfigInternal._projectName,

            _entryFilePath: entryFilePath,
            _tsConfigPath: tsConfigPath,
            _karmaConfigPath: karmaConfigPath,
            _codeCoverage: codeCoverage
        };

        const webpackConfig = await getWebpackTestConfig(testConfigInternal);

        let karmaDefaultOptions: Partial<KarmaConfigOptions> = {};
        if (!karmaConfigPath) {
            karmaDefaultOptions = {
                basePath: projectRoot,
                frameworks: ['jasmine', 'lib-tools'],
                plugins: [
                    require('karma-jasmine'),
                    require('karma-chrome-launcher'),
                    require('karma-jasmine-html-reporter'),
                    require('karma-coverage-istanbul-reporter'),
                    require('karma-junit-reporter'),
                    require(path.resolve(__dirname, '../../karma-plugin'))
                ],
                client: {
                    // leave Jasmine Spec Runner output visible in browser
                    clearContext: false
                },
                coverageIstanbulReporter: {
                    dir: path.resolve(workspaceRoot, 'coverage', projectConfigInternal._projectName),
                    reports: ['html', 'lcovonly', 'text-summary', 'cobertura'],
                    fixWebpackSourcePaths: true
                    // thresholds: {
                    //     statements: 80,
                    //     lines: 80,
                    //     branches: 80,
                    //     functions: 80
                    // }
                },
                reporters: codeCoverage ? ['progress', 'kjhtml', 'coverage-istanbul'] : ['progress', 'kjhtml'],
                junitReporter: {
                    outputDir: normalizePath(
                        path.relative(
                            projectRoot,
                            path.resolve(workspaceRoot, `junit/${projectConfigInternal._projectName}`)
                        )
                    )
                },
                port: 9876,
                colors: true,
                logLevel: 'info',
                autoWatch: true,
                browsers: ['Chrome'],
                customLaunchers: {
                    ChromeHeadlessCI: {
                        base: 'ChromeHeadless',
                        flags: ['--no-sandbox']
                    }
                },
                restartOnFileChange: true
            };
        }

        const karmaOptions: KarmaConfigOptions = {
            ...karmaDefaultOptions,
            configFile: karmaConfigPath,
            webpackConfig,
            codeCoverage,
            logger
        };

        if (argv.watch != null) {
            webpackConfig.watch = argv.watch;
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
