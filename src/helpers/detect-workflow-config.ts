import * as path from 'path';

import { pathExists } from 'fs-extra';
import { glob } from 'glob';

import { BuildConfig, ProjectConfigInternal, TestConfig, TsConfigInfo, WorkflowConfigInternal } from '../models';
import { normalizePath } from '../utils';

import { detectTsEntryName } from './detect-ts-entry-name';
import { findBuildTsconfigFile } from './find-build-tsconfig-file';
import { findTestIndexFile } from './find-test-index-file';
import { findTestTsconfigFile } from './find-test-tsconfig-file';
import { findKarmaConfigFile } from './find-karma-config-file';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';
import { readTsconfigJson } from './read-tsconfig-json';
import { readPackageJson } from './read-package-json';
import { readWorkflowConfig } from './read-workflow-config';

export async function detectWorkflowConfig(taskName: 'build' | 'test'): Promise<WorkflowConfigInternal | null> {
    const foundPackageJsonPaths = await glob(
        '*(src|modules|packages|projects|libs|samples|examples|demos)/**/package.json',
        {
            cwd: process.cwd(),
            dot: false,
            absolute: true,
            ignore: ['**/lib-tools/package.json', '**/node_modules/**/package.json', '**/dist/**/package.json']
        }
    );

    if (!foundPackageJsonPaths.length) {
        return null;
    }

    const projects: ProjectConfigInternal[] = [];

    for (const packageJsonPath of foundPackageJsonPaths) {
        const workflowConfigPath = path.resolve(path.dirname(packageJsonPath), 'workflow.json');
        if (await pathExists(workflowConfigPath)) {
            const workflowConfig = await readWorkflowConfig(workflowConfigPath);
            const workspaceRoot = path.dirname(workflowConfigPath);
            const keys = Object.keys(workflowConfig.projects);
            for (const key of keys) {
                const project = workflowConfig.projects[key];

                if (project.root && path.isAbsolute(project.root)) {
                    throw new Error(`Invalid configuration. The 'projects[${key}].root' must be relative path.`);
                }

                const projectRoot = path.resolve(workspaceRoot, project.root || '');
                const projectInternal: ProjectConfigInternal = {
                    ...project,
                    _workspaceRoot: workspaceRoot,
                    _config: workflowConfigPath,
                    _projectRoot: projectRoot,
                    _projectName: key
                };

                projects.push(projectInternal);
            }
        } else {
            const packageJson = await readPackageJson(packageJsonPath);
            const packageName = packageJson.name;
            if (!packageName) {
                continue;
            }

            let packageNameWithoutScope = packageName;
            const slashIndex = packageName.indexOf('/');
            if (slashIndex > -1 && packageName.startsWith('@')) {
                packageNameWithoutScope = packageName.substr(slashIndex + 1);
            }
            const projectName = packageNameWithoutScope.replace(/\//g, '-');

            const workspaceRoot = process.cwd();
            const projectRoot = path.dirname(packageJsonPath);

            if (taskName === 'build') {
                const buildConfig = await detectBuildConfig(workspaceRoot, projectRoot, packageNameWithoutScope);
                if (buildConfig != null) {
                    const projectInternal: ProjectConfigInternal = {
                        _config: 'auto',
                        _workspaceRoot: workspaceRoot,
                        _projectRoot: projectRoot,
                        _projectName: projectName,
                        root: normalizePath(path.relative(workspaceRoot, projectRoot)),
                        tasks: {
                            build: buildConfig
                        }
                    };

                    projects.push(projectInternal);
                }
            } else if (taskName === 'test') {
                const testConfig = await detectTestConfig(workspaceRoot, projectRoot);
                if (testConfig != null) {
                    const projectInternal: ProjectConfigInternal = {
                        _config: 'auto',
                        _workspaceRoot: workspaceRoot,
                        _projectRoot: projectRoot,
                        _projectName: projectName,
                        root: normalizePath(path.relative(workspaceRoot, projectRoot)),
                        tasks: {
                            test: testConfig
                        }
                    };

                    projects.push(projectInternal);
                }
            }
        }
    }

    if (!projects.length) {
        return null;
    }

    const projectMap: { [key: string]: ProjectConfigInternal } = {};
    for (const project of projects) {
        projectMap[project._projectName] = project;
    }

    return {
        projects: projectMap
    };
}

async function detectBuildConfig(
    workspaceRoot: string,
    projectRoot: string,
    packageNameWithoutScope: string
): Promise<BuildConfig | null> {
    const tsConfigPath = await findBuildTsconfigFile(projectRoot, workspaceRoot);
    if (!tsConfigPath) {
        return null;
    }

    const tsConfigJson = readTsconfigJson(tsConfigPath);
    const tsCompilerConfig = parseTsJsonConfigFileContent(tsConfigPath);
    const tsConfigInfo: TsConfigInfo = {
        tsConfigPath,
        tsConfigJson,
        tsCompilerConfig
    };

    const entryName = await detectTsEntryName(tsConfigInfo, packageNameWithoutScope);
    if (!entryName) {
        return null;
    }

    return {
        script: {
            compilations: 'auto'
        }
    };
}

async function detectTestConfig(workspaceRoot: string, projectRoot: string): Promise<TestConfig | null> {
    const tsConfigPath = await findTestTsconfigFile(projectRoot, workspaceRoot);
    const testIndexFile = await findTestIndexFile(projectRoot, workspaceRoot, tsConfigPath);

    const karmaConfigFilePath = await findKarmaConfigFile(projectRoot, workspaceRoot);

    if (!karmaConfigFilePath && !testIndexFile) {
        return null;
    }

    return {
        tsConfig: tsConfigPath ? path.relative(projectRoot, tsConfigPath) : undefined,
        testIndexFile: testIndexFile ? path.relative(projectRoot, testIndexFile) : undefined,
        karmaConfig: karmaConfigFilePath ? path.relative(projectRoot, karmaConfigFilePath) : undefined,
        codeCoverageExclude: ['**/test.ts', '**/index.ts', '**/public_api.ts'],
        envOverrides: {
            ci: {
                browsers: ['ChromeHeadlessCI'],
                reporters: ['junit', 'coverage']
            }
        }
    };
}
