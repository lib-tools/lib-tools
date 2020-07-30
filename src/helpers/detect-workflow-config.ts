import * as path from 'path';
import { promisify } from 'util';

import * as Ajv from 'ajv';
import { pathExists } from 'fs-extra';
import * as glob from 'glob';

const globAsync = promisify(glob);

import {
    BuildConfig,
    ProjectConfigInternal,
    SharedCommandOptions,
    TestConfig,
    TsConfigInfo,
    WorkflowConfig,
    WorkflowConfigInternal
} from '../models';
import { Logger, findUp, normalizePath, readJsonWithComments } from '../utils';

import { findTsconfigBuildFile } from './find-tsconfig-build-file';
import { findTsconfigTestFile } from './find-tsconfig-test-file';
import { detectTsEntryName } from './detect-ts-entry-name';
import { getCachedTsconfigJson } from './get-cached-tsconfig-json';
import { getCachedWorkflowConfigSchema } from './get-cached-workflow-config-schema';
import { getCachedPackageJson } from './get-cached-package-json';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';

const ajv = new Ajv();

export async function detectWorkflowConfig(
    commandOptions: SharedCommandOptions,
    taskName: 'build' | 'test'
): Promise<WorkflowConfigInternal | null> {
    const foundPackageJsonPaths = await globAsync(
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

    const logger = new Logger({
        logLevel: commandOptions.logLevel ? commandOptions.logLevel : 'info'
    });

    for (const packageJsonPath of foundPackageJsonPaths) {
        const workflowConfigPath = path.resolve(path.dirname(packageJsonPath), 'workflow.json');
        if (await pathExists(workflowConfigPath)) {
            const workflowConfig = (await readJsonWithComments(workflowConfigPath)) as WorkflowConfig;
            const schema = await getCachedWorkflowConfigSchema();
            if (!ajv.getSchema('workflowSchema')) {
                ajv.addSchema(schema, 'workflowSchema');
            }

            const valid = ajv.validate('workflowSchema', workflowConfig);
            if (!valid) {
                logger.warn(`Workflow config file is found at ${workflowConfigPath} but configuration is invalid.`);
                continue;
            }

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
            const packageJson = await getCachedPackageJson(packageJsonPath);
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
                const buildConfig = await detectBuildConfigAuto(workspaceRoot, projectRoot, packageNameWithoutScope);
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
                const testConfig = await detectTestConfigAuto(workspaceRoot, projectRoot);
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

async function detectBuildConfigAuto(
    workspaceRoot: string,
    projectRoot: string,
    packageNameWithoutScope: string
): Promise<BuildConfig | null> {
    const tsConfigPath = await findTsconfigBuildFile(workspaceRoot, projectRoot);
    if (!tsConfigPath) {
        return null;
    }

    const tsConfigJson = getCachedTsconfigJson(tsConfigPath);
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

async function detectTestConfigAuto(workspaceRoot: string, projectRoot: string): Promise<TestConfig | null> {
    const tsConfigPath = await findTsconfigTestFile(workspaceRoot, projectRoot);
    let entryFilePath: string | null = null;

    if (tsConfigPath) {
        const tsConfigJson = getCachedTsconfigJson(tsConfigPath);
        if (tsConfigJson.files && tsConfigJson.files.length) {
            let testFile = tsConfigJson.files.find((f) => /test([-_]index)?\.tsx?$/i.test(f));
            if (!testFile) {
                testFile = tsConfigJson.files[0];
            }

            if (testFile) {
                const testFileAbs = path.resolve(path.dirname(tsConfigPath), testFile);
                if (await pathExists(testFileAbs)) {
                    entryFilePath = testFileAbs;
                }
            }
        }
    }

    if (!entryFilePath) {
        entryFilePath = await findUp(
            ['test.ts', 'test_index.ts', 'test.js', 'test_index.js'],
            [path.resolve(projectRoot, 'test'), path.resolve(projectRoot, 'src')],
            workspaceRoot
        );
    }

    const karmaConfigFilePath = await findUp(
        ['karma.conf.ts', 'karma.conf.js', '.config/karma.conf.ts', '.config/karma.conf.js'],
        [path.resolve(projectRoot, 'test'), path.resolve(projectRoot, 'src')],
        workspaceRoot
    );

    if (!karmaConfigFilePath && !entryFilePath) {
        return null;
    }

    return {
        tsConfig: tsConfigPath ? path.relative(projectRoot, tsConfigPath) : undefined,
        entry: entryFilePath ? path.relative(projectRoot, entryFilePath) : undefined,
        karmaConfig: karmaConfigFilePath ? path.relative(projectRoot, karmaConfigFilePath) : undefined,
        codeCoverage: true
    };
}
