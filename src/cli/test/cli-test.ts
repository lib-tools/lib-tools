import * as path from 'path';

import * as karma from 'karma';
import { Configuration as WebpackConfiguration } from 'webpack';

import {
    applyEnvOverrides,
    applyProjectExtends,
    findKarmaConfigFile,
    findPackageJsonPath,
    findTestIndexFile,
    findTestTsconfigFile,
    getEnvironment,
    getWorkflowConfig,
    readPackageJson
} from '../../helpers';
import {
    CoverageIstanbulReporterOptions,
    JunitReporterOptions,
    PackageJsonLike,
    ProjectConfigInternal,
    TestCommandOptions,
    TestConfigInternal,
    WorkflowConfigInternal
} from '../../models';
import { normalizePath } from '../../utils';
import { getWebpackTestConfig } from '../../webpack/configs';

export interface KarmaConfigOptions extends karma.ConfigOptions {
    webpackConfig: WebpackConfiguration;
    configFile: string | null;
    coverageIstanbulReporter?: CoverageIstanbulReporterOptions;
    junitReporter?: JunitReporterOptions;
}

export async function cliTest(argv: TestCommandOptions & { [key: string]: unknown }): Promise<number> {
    const environment = getEnvironment(null, argv);

    if (argv.environment) {
        delete argv.environment;
    }

    if (argv.env) {
        delete argv.env;
    }

    const workflowConfig = await getWorkflowConfig(argv, 'test');
    const filterNames =
        argv.filter && Array.isArray(argv.filter)
            ? argv.filter.filter((n) => n.trim().length > 0)
            : (argv.filter || '').split(',').filter((n) => n.trim().length > 0);
    const filteredTestConfigs = await getFilteredTestConfigs(workflowConfig, filterNames, environment);
    if (!filteredTestConfigs.length) {
        throw new Error('No workflow test config is available for testing.');
    }

    for (const testConfig of filteredTestConfigs) {
        if (argv.codeCoverageExclude != null) {
            testConfig.codeCoverageExclude = Array.isArray(argv.codeCoverageExclude)
                ? argv.codeCoverageExclude.filter((n) => n.trim().length > 0)
                : argv.codeCoverageExclude.split(',').filter((n) => n.trim().length > 0);
        }

        if (argv.reporters != null) {
            testConfig.reporters = Array.isArray(argv.reporters)
                ? argv.reporters.filter((n) => n.trim().length > 0)
                : argv.reporters.split(',').filter((n) => n.trim().length > 0);
        }

        if (argv.browsers != null) {
            testConfig.browsers = Array.isArray(argv.browsers)
                ? argv.browsers.filter((n) => n.trim().length > 0)
                : argv.browsers.split(',').filter((n) => n.trim().length > 0);
        }

        if (argv.singleRun != null) {
            testConfig.singleRun = argv.singleRun;
        }

        let defaultKarmaOptions: Partial<KarmaConfigOptions> = {};
        if (testConfig._karmaConfigPath) {
            const karmaConfig = (karma.config.parseConfig(
                testConfig._karmaConfigPath,
                {}
            ) as unknown) as KarmaConfigOptions;
            if (karmaConfig.reporters && karmaConfig.reporters.length > 0 && !testConfig.reporters) {
                testConfig.reporters = karmaConfig.reporters;
            }
            if (karmaConfig.browsers && karmaConfig.browsers.length > 0 && !testConfig.browsers) {
                testConfig.browsers = karmaConfig.browsers;
            }

            if (karmaConfig.singleRun != null && testConfig.singleRun == null) {
                testConfig.singleRun = karmaConfig.singleRun;
            }
        } else {
            defaultKarmaOptions = {
                basePath: testConfig._workspaceRoot,
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
                    clearContext: false
                },
                coverageIstanbulReporter: {
                    dir: path.resolve(testConfig._workspaceRoot, 'coverage', testConfig._projectName),
                    reports: ['html', 'lcovonly', 'text-summary', 'cobertura'],
                    fixWebpackSourcePaths: true
                },
                junitReporter: {
                    outputDir: normalizePath(
                        path.relative(
                            testConfig._workspaceRoot,
                            path.resolve(testConfig._workspaceRoot, `junit/${testConfig._projectName}`)
                        )
                    )
                },
                port: 9876,
                colors: true,
                logLevel: argv.logLevel ? argv.logLevel : 'info',
                autoWatch: true,
                customLaunchers: {
                    ChromeHeadlessCI: {
                        base: 'ChromeHeadless',
                        flags: ['--no-sandbox']
                    }
                },
                restartOnFileChange: true
            };

            if (testConfig.reporters) {
                defaultKarmaOptions.reporters = testConfig.reporters;
            } else {
                if (environment.ci) {
                    defaultKarmaOptions.reporters = ['junit', 'coverage-istanbul'];
                } else {
                    defaultKarmaOptions.reporters = ['progress', 'kjhtml'];
                }
            }

            if (testConfig.browsers) {
                defaultKarmaOptions.browsers = testConfig.browsers;
            } else {
                if (environment.ci) {
                    defaultKarmaOptions.browsers = ['ChromeHeadlessCI'];
                } else {
                    defaultKarmaOptions.browsers = ['Chrome'];
                }
            }
        }

        const webpackConfig = await getWebpackTestConfig(testConfig, argv);

        const karmaOptions: KarmaConfigOptions = {
            ...defaultKarmaOptions,
            configFile: testConfig._karmaConfigPath,
            webpackConfig,
            logLevel: argv.logLevel ? argv.logLevel : 'info'
        };

        if (!karmaOptions.frameworks || !karmaOptions.frameworks.includes('lib-tools')) {
            karmaOptions.frameworks = karmaOptions.frameworks || [];
            karmaOptions.frameworks.push('lib-tools');
        }

        if (testConfig.coverageIstanbulReporter) {
            karmaOptions.coverageIstanbulReporter = {
                ...karmaOptions.coverageIstanbulReporter,
                ...testConfig.coverageIstanbulReporter
            };
        }

        if (testConfig.singleRun != null) {
            karmaOptions.singleRun = testConfig.singleRun;
        }

        if (testConfig.browsers) {
            karmaOptions.browsers = testConfig.browsers;
        }

        if (testConfig.reporters) {
            karmaOptions.reporters = testConfig.reporters;
        }

        let karmaServer: karma.Server | undefined;
        const exitCode = await new Promise<number>((res) => {
            karmaServer = new karma.Server(karmaOptions, (serverExitCode) => {
                res(serverExitCode);
            });

            karmaServer.start();
        }).then((serverExitCode) => {
            if (karmaServer) {
                const karmaServerWithStop = (karmaServer as unknown) as { stop: () => void };
                if (typeof karmaServerWithStop.stop === 'function') {
                    karmaServerWithStop.stop();
                }
            }

            return serverExitCode;
        });

        if (exitCode !== 0) {
            return exitCode;
        }
    }

    return 0;
}

async function getFilteredTestConfigs(
    workflowConfig: WorkflowConfigInternal,
    filterNames: string[],
    environment: { [key: string]: boolean | string }
): Promise<TestConfigInternal[]> {
    const testConfigs: TestConfigInternal[] = [];
    const projectNames = Object.keys(workflowConfig.projects);
    for (const projectName of projectNames) {
        if (filterNames.length && !filterNames.includes(projectName)) {
            continue;
        }

        const projectConfig = JSON.parse(JSON.stringify(workflowConfig.projects[projectName])) as ProjectConfigInternal;

        if (projectConfig._config !== 'auto') {
            await applyProjectExtends(projectConfig, workflowConfig.projects, projectConfig._config);
        }

        if (!projectConfig.tasks || !projectConfig.tasks.test) {
            continue;
        }

        const testConfig = projectConfig.tasks.test;

        if (projectConfig._config !== 'auto') {
            applyEnvOverrides(testConfig, environment);
        }

        if (testConfig.skip) {
            continue;
        }

        const workspaceRoot = projectConfig._workspaceRoot;
        const projectRoot = projectConfig._projectRoot;

        let karmaConfigPath: string | null = null;
        let tsConfigPath: string | null = null;
        let testIndexFilePath: string | null = null;

        if (testConfig.karmaConfig) {
            karmaConfigPath = path.resolve(projectRoot, testConfig.karmaConfig);
        } else if (projectConfig._config === 'auto') {
            karmaConfigPath = await findKarmaConfigFile(projectRoot, workspaceRoot);
        }

        if (testConfig.tsConfig) {
            tsConfigPath = path.resolve(projectRoot, testConfig.tsConfig);
        } else {
            tsConfigPath = await findTestTsconfigFile(projectRoot, workspaceRoot);
        }

        if (testConfig.testIndexFile) {
            testIndexFilePath = path.resolve(projectRoot, testConfig.testIndexFile);
        } else {
            testIndexFilePath = await findTestIndexFile(projectRoot, workspaceRoot, tsConfigPath);
        }

        let packageJson: PackageJsonLike | null = null;
        const packageJsonPath = await findPackageJsonPath(projectRoot, workspaceRoot);
        if (packageJsonPath) {
            packageJson = await readPackageJson(packageJsonPath);
        }

        const testConfigInternal: TestConfigInternal = {
            ...testConfig,
            _config: projectConfig._config,
            _workspaceRoot: workspaceRoot,
            _projectRoot: projectRoot,
            _projectName: projectConfig._projectName,
            _packageJson: packageJson,
            _testIndexFilePath: testIndexFilePath,
            _tsConfigPath: tsConfigPath,
            _karmaConfigPath: karmaConfigPath
        };

        testConfigs.push(testConfigInternal);
    }

    return testConfigs;
}
