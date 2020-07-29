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
    TsConfigInfo,
    WorkflowConfig,
    WorkflowConfigInternal
} from '../models';
import { Logger, readJsonWithComments } from '../utils';

import { detectTsconfigPath } from './detect-tsconfig-path';
import { findNodeModulesPath } from './find-node-modules-path';
import { detectTsEntryName } from './detect-ts-entry-name';
import { getCachedPackageJson } from './get-cached-package-json';
import { getCachedTsconfigJson } from './get-cached-tsconfig-json';
import { getCachedWorkflowConfigSchema } from './get-cached-workflow-config-schema';
import { parseTsJsonConfigFileContent } from './parse-ts-json-config-file-content';

const ajv = new Ajv();

export async function detectWorkflowConfig(
    commandOptions: SharedCommandOptions
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

            const tsConfigPath = await detectTsconfigPath(process.cwd(), path.dirname(packageJsonPath));
            if (!tsConfigPath) {
                continue;
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
                continue;
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
            projects.push(projectInternal);
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
