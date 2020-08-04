import * as path from 'path';

import { pathExists } from 'fs-extra';

import { ProjectConfigInternal } from '../models';

import { readWorkflowConfig } from './read-workflow-config';
import { toWorkflowConfigInternal } from './to-workflow-config-internal';

export async function applyProjectExtends(
    projectConfig: ProjectConfigInternal,
    projects: { [key: string]: ProjectConfigInternal } | ProjectConfigInternal[] = {},
    configPath: string
): Promise<void> {
    if (!projectConfig.extends || !projectConfig.extends.trim().length) {
        return;
    }

    let projectCollection: { [key: string]: ProjectConfigInternal } = {};
    if (Array.isArray(projects)) {
        projects.forEach((project) => {
            projectCollection[project._projectName] = project;
        });
    } else {
        projectCollection = projects;
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
        projectConfig._config === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._config;
    const configErrorLocation = `projects[${projectConfig._projectName}].extends`;
    let baseProjectConfig: ProjectConfigInternal | null;

    if (projectConfig.extends.startsWith('project:')) {
        baseProjectConfig = getBaseProjectConfigFromProjectCollection(projectConfig, projectCollection, rootConfigPath);
    } else if (projectConfig.extends.startsWith('file:')) {
        baseProjectConfig = await getBaseProjectConfigFromFile(projectConfig, rootConfigPath);
    } else {
        throw new Error(
            `Error in extending project config. Invalid extends name, config location ${currentConfigFile} -> ${configErrorLocation}.`
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

    if (clonedBaseProject._config) {
        delete clonedBaseProject._config;
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
        projectConfig._config === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._config;
    const configErrorLocation = `projects[${projectConfig._projectName}].extends`;

    const projectNameToExtend = projectConfig.extends.substr('project:'.length).trim();
    if (!projectNameToExtend) {
        throw new Error(
            `Error in extending project config. Invalid extends name, config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    const foundBaseProject = projectCollection[projectNameToExtend];
    if (!foundBaseProject) {
        throw new Error(
            `Error in extending project config. No base project config exists with name '${projectNameToExtend}', config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    if (foundBaseProject._projectName === projectConfig._projectName) {
        throw new Error(
            `Error in extending project config. Base project name must not be the same as current project name, config location ${currentConfigFile} -> ${configErrorLocation}.`
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
        projectConfig._config === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._config;
    const configErrorLocation = `projects[${projectConfig._projectName}].extends`;

    const parts = projectConfig.extends.split(':');
    if (parts.length !== 3) {
        throw new Error(
            `Error in extending project config. Invalid extends name, config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    const extendsFilePath = path.isAbsolute(parts[1])
        ? path.resolve(parts[1])
        : path.resolve(path.dirname(projectConfig._config || rootConfigPath), parts[1]);

    if (!(await pathExists(extendsFilePath))) {
        throw new Error(
            `Error in extending project config. No file exists at ${extendsFilePath}, config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    try {
        const projectNameToExtend = parts[2];
        const workflowConfig = await readWorkflowConfig(extendsFilePath);
        const foundBaseProject = workflowConfig.projects[projectNameToExtend];
        if (!foundBaseProject) {
            throw new Error(
                `Error in extending project config. No base project config exists with name '${projectNameToExtend}', config location ${currentConfigFile} -> ${configErrorLocation}.`
            );
        }

        const workflowConfigInternal = toWorkflowConfigInternal(
            workflowConfig,
            extendsFilePath,
            projectConfig._workspaceRoot
        );
        const foundBaseProjectInternal = workflowConfigInternal.projects[projectNameToExtend];

        if (foundBaseProjectInternal._projectName === projectConfig._projectName) {
            throw new Error(
                `Error in extending project config. Base project name must not be the same as current project name, config location ${currentConfigFile} -> ${configErrorLocation}.`
            );
        }

        return {
            ...foundBaseProjectInternal,
            _config: extendsFilePath,
            _workspaceRoot: projectConfig._workspaceRoot,
            _projectName: projectConfig._projectName,
            _projectRoot: projectConfig._projectRoot
        };
    } catch (err) {
        throw new Error(
            `Error in extending project config, could not read file '${extendsFilePath}'. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }
}
