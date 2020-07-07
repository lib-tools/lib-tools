/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import * as Ajv from 'ajv';
import { pathExists } from 'fs-extra';

import { ProjectConfigStandalone, WorkflowsConfig } from '../models';
import { ProjectConfigInternal } from '../models/internals';
import { readJsonWithComments } from '../utils';

import { readProjectConfigSchema } from './read-project-config-schema';
import { readWorkflowsConfigSchema } from './read-workflows-config-schema';
import { toWorkflowsConfigInternal } from './to-workflows-config-internal';

const ajv = new Ajv();

export async function applyProjectExtends(
    projectConfig: ProjectConfigInternal,
    projectCollection: { [key: string]: ProjectConfigInternal } = {},
    configPath: string
): Promise<void> {
    if (!projectConfig.extends || !projectConfig.extends.trim().length) {
        return;
    }

    await applyProjectExtendsInternal(projectConfig, projectCollection, configPath);
}

async function applyProjectExtendsInternal(
    projectConfig: ProjectConfigInternal,
    projectCollection: { [key: string]: ProjectConfigInternal } = {},
    rootConfigPath: string
): Promise<void> {
    if (!projectConfig.extends) {
        return;
    }

    const currentConfigFile =
        projectConfig._configPath === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._configPath;
    const configErrorLocation = `projects[${projectConfig._projectName}].extends`;
    let baseProjectConfig: ProjectConfigInternal | null;

    if (projectConfig.extends.startsWith('project:')) {
        baseProjectConfig = getBaseProjectConfigFromProjectCollection(projectConfig, projectCollection, rootConfigPath);
    } else if (projectConfig.extends.startsWith('file:')) {
        baseProjectConfig = await getBaseProjectConfigFromFile(projectConfig, rootConfigPath);
    } else {
        throw new Error(
            `Error in extending project config, invalid extends name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    if (!baseProjectConfig) {
        return;
    }

    const clonedBaseProject = JSON.parse(JSON.stringify(baseProjectConfig)) as ProjectConfigInternal;
    if (clonedBaseProject.extends) {
        await applyProjectExtendsInternal(clonedBaseProject, projectCollection, rootConfigPath);

        delete clonedBaseProject.extends;
    }

    if (clonedBaseProject._configPath) {
        delete clonedBaseProject._configPath;
    }

    if ((clonedBaseProject as ProjectConfigStandalone).$schema) {
        delete (clonedBaseProject as ProjectConfigStandalone).$schema;
    }

    const extendedConfig = { ...clonedBaseProject, ...projectConfig };
    Object.assign(projectConfig, extendedConfig);
}

function getBaseProjectConfigFromProjectCollection(
    projectConfig: ProjectConfigInternal,
    projectCollection: { [key: string]: ProjectConfigInternal } = {},
    rootConfigPath: string
): ProjectConfigInternal | null {
    if (!projectConfig.extends) {
        return null;
    }

    const currentConfigFile =
        projectConfig._configPath === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._configPath;
    const configErrorLocation = `projects[${projectConfig._projectName}].extends`;

    const projectNameToExtend = projectConfig.extends.substr('project:'.length).trim();
    if (!projectNameToExtend) {
        throw new Error(
            `Error in extending project config, invalid extends name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    const foundBaseProject = projectCollection[projectNameToExtend];
    if (!foundBaseProject) {
        throw new Error(
            `Error in extending project config, no base project config exists with name '${projectNameToExtend}'. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    if (foundBaseProject._projectName === projectConfig._projectName) {
        throw new Error(
            `Error in extending project config, base project name must not be the same as current project name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    return foundBaseProject;
}

async function getBaseProjectConfigFromFile(
    projectConfig: ProjectConfigInternal,
    rootConfigPath: string
): Promise<ProjectConfigInternal | null> {
    if (!projectConfig.extends) {
        return null;
    }

    const currentConfigFile =
        projectConfig._configPath === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._configPath;
    const configErrorLocation = `projects[${projectConfig._projectName}].extends`;

    const parts = projectConfig.extends.split(':');
    if (parts.length < 2 || parts.length > 3) {
        throw new Error(
            `Error in extending project config, invalid extends name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    const extendsFilePath = path.isAbsolute(parts[1])
        ? path.resolve(parts[1])
        : path.resolve(path.dirname(projectConfig._configPath || rootConfigPath), parts[1]);

    if (!(await pathExists(extendsFilePath))) {
        throw new Error(
            `Error in extending project config, no file exists at ${extendsFilePath}. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    try {
        const projectNameToExtend = parts.length === 3 ? parts[2] : null;
        if (projectNameToExtend) {
            const workflowConfig = (await readJsonWithComments(extendsFilePath)) as WorkflowsConfig;
            const foundBaseProject = workflowConfig.projects[projectNameToExtend];
            if (!foundBaseProject) {
                throw new Error(
                    `Error in extending project config, no base project config exists with name '${projectNameToExtend}'. Config location ${currentConfigFile} -> ${configErrorLocation}.`
                );
            }

            const skipValidate = extendsFilePath === rootConfigPath || extendsFilePath === projectConfig._configPath;
            if (!skipValidate) {
                if (workflowConfig.$schema) {
                    delete workflowConfig.$schema;
                }

                const schema = await readWorkflowsConfigSchema();
                const valid = ajv.addSchema(schema, 'workflowsSchema').validate('workflowsSchema', workflowConfig);
                if (!valid) {
                    const errorsText = ajv.errorsText();
                    throw new Error(
                        `Error in extending project config, invalid configuration:\n\n${errorsText}\nConfig file location ${currentConfigFile}.`
                    );
                }
            }

            const workflowsConfigInternal = toWorkflowsConfigInternal(
                workflowConfig,
                extendsFilePath,
                projectConfig._workspaceRoot
            );
            const foundBaseProjectInternal = workflowsConfigInternal.projects[projectNameToExtend];

            if (foundBaseProjectInternal._projectName === projectConfig._projectName) {
                throw new Error(
                    `Error in extending project config, base project name must not be the same as current project name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
                );
            }

            return {
                ...foundBaseProjectInternal,
                _configPath: extendsFilePath,
                _workspaceRoot: projectConfig._workspaceRoot,
                _projectName: projectConfig._projectName,
                _projectRoot: projectConfig._projectRoot
            };
        } else {
            // Standalone project config
            const foundBaseProject = (await readJsonWithComments(extendsFilePath)) as ProjectConfigStandalone;
            if (foundBaseProject.$schema) {
                delete foundBaseProject.$schema;
            }

            const schema = await readProjectConfigSchema();
            const valid = ajv.addSchema(schema, 'projectSchema').validate('projectSchema', foundBaseProject);
            if (!valid) {
                const errorsText = ajv.errorsText();
                throw new Error(
                    `Error in extending project config, invalid configuration:\n\n${errorsText}\nConfig file location ${currentConfigFile}.`
                );
            }

            return {
                ...foundBaseProject,
                _configPath: extendsFilePath,
                _workspaceRoot: projectConfig._workspaceRoot,
                _projectName: projectConfig._projectName,
                _projectRoot: projectConfig._projectRoot
            };
        }
    } catch (err) {
        throw new Error(
            `Error in extending project config, could not read file '${extendsFilePath}'. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }
}
