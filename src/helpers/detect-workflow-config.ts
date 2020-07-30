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
import { Logger, findUp, readJsonWithComments } from '../utils';

import { findNodeModulesPath } from './find-node-modules-path';
import { findTsconfigBuildFile } from './find-tsconfig-build-file';
import { findTsconfigTestFile } from './find-tsconfig-test-file';
import { detectTsEntryName } from './detect-ts-entry-name';
import { getCachedPackageJson } from './get-cached-package-json';
import { getCachedTsconfigJson } from './get-cached-tsconfig-json';
import { getCachedWorkflowConfigSchema } from './get-cached-workflow-config-schema';
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
            if (taskName === 'build') {
                const projectInternal = await detectProjectInternalForBuild(packageJsonPath);
                if (projectInternal != null) {
                    projects.push(projectInternal);
                }
            } else if (taskName === 'test') {
                const projectInternal = await detectProjectInternalForTest(packageJsonPath);
                if (projectInternal != null) {
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

async function detectProjectInternalForBuild(packageJsonPath: string): Promise<ProjectConfigInternal | null> {
    const packageJson = await getCachedPackageJson(packageJsonPath);
    const packageName = packageJson.name;
    if (!packageName) {
        return null;
    }

    const tsConfigPath = await findTsconfigBuildFile(process.cwd(), path.dirname(packageJsonPath));
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

    let packageNameWithoutScope = packageName;
    const slashIndex = packageName.indexOf('/');
    if (slashIndex > -1 && packageName.startsWith('@')) {
        packageNameWithoutScope = packageName.substr(slashIndex + 1);
    }

    const entryName = await detectTsEntryName(tsConfigInfo, packageNameWithoutScope);
    if (!entryName) {
        return null;
    }

    const nodeModulePath = await findNodeModulesPath(process.cwd());
    const workspaceRoot = nodeModulePath ? path.dirname(nodeModulePath) : process.cwd();
    const projectRoot = path.dirname(packageJsonPath);
    const projectName = packageNameWithoutScope.replace(/\//g, '-');

    const buildConfig: BuildConfig = {
        script: {
            compilations: 'auto'
        }
    };

    const projectInternal: ProjectConfigInternal = {
        root: path.relative(workspaceRoot, projectRoot),
        tasks: {
            build: buildConfig
        },
        _config: 'auto',
        _workspaceRoot: workspaceRoot,
        _projectRoot: projectRoot,
        _projectName: projectName
    };

    return projectInternal;
}

async function detectProjectInternalForTest(packageJsonPath: string): Promise<ProjectConfigInternal | null> {
    const workspaceRoot = process.cwd();
    const projectRoot = path.dirname(packageJsonPath);

    const nodeModulePath = await findNodeModulesPath(workspaceRoot);
    if (!nodeModulePath) {
        return null;
    }

    const packageJson = await getCachedPackageJson(packageJsonPath);
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

    const tsConfigPath = await findTsconfigTestFile(workspaceRoot, projectRoot);
    if (!tsConfigPath) {
        return null;
    }

    let entryFilePath: string | undefined;
    const tsConfigJson = getCachedTsconfigJson(tsConfigPath);
    if (tsConfigJson.files && tsConfigJson.files.length) {
        let testFile = tsConfigJson.files.find((f) => /test\.ts$/i.test(f));
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

    if (!entryFilePath) {
        return null;
    }

    const karmaConfigFilePath = await findUp(
        ['karma.conf.ts', 'karma.conf.js', '.config/karma.conf.ts', '.config/karma.conf.js'],
        [path.resolve(projectRoot, 'test'), path.resolve(projectRoot, 'src')],
        workspaceRoot
    );

    if (!karmaConfigFilePath) {
        return null;
    }

    const testConfig: TestConfig = {
        tsConfig: path.relative(projectRoot, tsConfigPath),
        entry: path.relative(projectRoot, entryFilePath),
        karmaConfig: path.relative(projectRoot, karmaConfigFilePath),
        codeCoverage: true
    };

    const projectInternal: ProjectConfigInternal = {
        root: path.relative(workspaceRoot, projectRoot),
        tasks: {
            test: testConfig
        },
        _config: 'auto',
        _workspaceRoot: workspaceRoot,
        _projectRoot: projectRoot,
        _projectName: projectName
    };

    return projectInternal;
}
