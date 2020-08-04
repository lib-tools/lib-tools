import * as path from 'path';

import { ConfigOptions as KarmaConfigOptions } from 'karma';

import {
    applyProjectExtends,
    findPackageJsonPath,
    findTestIndexFile,
    findTestTsconfigFile,
    readPackageJson,
    readWorkflowConfig
} from '../helpers';
import { PackageJsonLike, ProjectConfigInternal, TestCommandOptions, TestConfigInternal } from '../models';
import { findUp, isInFolder, isSamePaths } from '../utils';

export interface KarmaPluginOptions extends KarmaConfigOptions {
    configFile: string;
    codeCoverage?: boolean;
}

export async function getTestConfigFromKarma(
    karmaConfig: KarmaPluginOptions,
    commandOptions: TestCommandOptions
): Promise<TestConfigInternal | null> {
    const karmaConfigDir = path.dirname(karmaConfig.configFile);
    const foundWorkflowConfigPath = await findUp(['workflow.json'], karmaConfigDir, path.parse(karmaConfigDir).root);
    let testConfigInternal: TestConfigInternal | null = null;
    if (foundWorkflowConfigPath) {
        const workflowConfig = await readWorkflowConfig(foundWorkflowConfigPath);
        const workspaceRoot = path.dirname(foundWorkflowConfigPath);
        const projectConfigs = Object.keys(workflowConfig.projects).map((projectName) => {
            const projectConfig = workflowConfig.projects[projectName];
            if (projectConfig.root && path.isAbsolute(projectConfig.root)) {
                throw new Error(
                    `Invalid workflow configuration. The 'projects[${projectName}].root' must be relative path.`
                );
            }

            const projectRoot = path.resolve(workspaceRoot, projectConfig.root || '');

            const projectConfigInternal: ProjectConfigInternal = {
                ...projectConfig,
                _workspaceRoot: workspaceRoot,
                _config: foundWorkflowConfigPath,
                _projectName: projectName,
                _projectRoot: projectRoot
            };

            return projectConfigInternal;
        });

        for (const projectConfig of projectConfigs) {
            await applyProjectExtends(projectConfig, projectConfigs, projectConfig._config);
            if (!projectConfig.tasks || !projectConfig.tasks.test) {
                continue;
            }

            const testConfig = projectConfig.tasks.test;

            if (testConfig.skip) {
                continue;
            }

            const projectRoot = projectConfig._projectRoot;

            if (
                testConfig.karmaConfig &&
                !isSamePaths(karmaConfig.configFile, path.resolve(projectRoot, testConfig.karmaConfig))
            ) {
                continue;
            }

            let tsConfigPath: string | null = null;
            let testIndexFilePath: string | null = null;

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

            testConfigInternal = {
                ...testConfig,
                _config: projectConfig._config,
                _workspaceRoot: workspaceRoot,
                _projectRoot: projectRoot,
                _projectName: projectConfig._projectName,
                _packageJson: packageJson,
                _testIndexFilePath: testIndexFilePath,
                _tsConfigPath: tsConfigPath,
                _karmaConfigPath: karmaConfig.configFile
            };

            break;
        }
    } else {
        const workspaceRoot = isInFolder(process.cwd(), karmaConfigDir) ? process.cwd() : karmaConfigDir;
        const tsConfigPath = await findTestTsconfigFile(karmaConfigDir, workspaceRoot);
        const testIndexFilePath = await findTestIndexFile(karmaConfigDir, workspaceRoot, tsConfigPath);
        if (!testIndexFilePath) {
            return null;
        }

        const packageJsonPath = await findUp('package.json', karmaConfigDir, workspaceRoot);
        let packageJson: PackageJsonLike | null = null;
        if (!packageJsonPath) {
            return null;
        }

        packageJson = await readPackageJson(packageJsonPath);
        const packageName = packageJson.name;
        if (!packageName) {
            return null;
        }

        let packageNameWithoutScope = packageName;
        const slashIndex = packageName.indexOf('/');
        if (slashIndex > -1 && packageName.startsWith('@')) {
            packageNameWithoutScope = packageName.substr(slashIndex + 1);
        }
        const projectName = packageNameWithoutScope.replace(/\//g, '-');

        testConfigInternal = {
            _config: 'auto',
            _workspaceRoot: workspaceRoot,
            _projectRoot: karmaConfigDir,
            _projectName: projectName,
            _packageJson: packageJson,
            _tsConfigPath: tsConfigPath,
            _testIndexFilePath: testIndexFilePath,
            _karmaConfigPath: karmaConfig.configFile
        };
    }

    if (!testConfigInternal) {
        return null;
    }

    if (karmaConfig.codeCoverage != null) {
        testConfigInternal.codeCoverage = karmaConfig.codeCoverage;
    } else if (commandOptions.codeCoverage != null) {
        testConfigInternal.codeCoverage = commandOptions.codeCoverage;
    }

    if (commandOptions.reporters != null) {
        testConfigInternal.reporters = Array.isArray(commandOptions.reporters)
            ? commandOptions.reporters
            : commandOptions.reporters.split(',').filter((r) => r.length > 0);
    }

    if (commandOptions.browsers != null) {
        testConfigInternal.browsers = Array.isArray(commandOptions.browsers)
            ? commandOptions.browsers
            : commandOptions.browsers.split(',').filter((b) => b.length > 0);
    }

    return testConfigInternal;
}
