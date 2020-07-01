import * as path from 'path';

import { pathExists } from 'fs-extra';

import { LibConfig, ProjectConfigStandalone } from '../models';
import { ProjectConfigInternal } from '../models/internals';
import { formatValidationError, readJsonWithComments, validateSchema } from '../utils';

import { readLibConfigSchema } from './read-lib-config-schema';
import { readProjectConfigSchema } from './read-project-config-schema';
import { toLibConfigInternal } from './to-lib-config-internal';

export async function applyProjectConfigExtends(
    projectConfig: ProjectConfigInternal,
    projectCollection: { [key: string]: ProjectConfigInternal } = {}
): Promise<void> {
    if (!projectConfig.extends || !projectConfig.extends.trim().length) {
        return;
    }

    const rootConfigPath = projectConfig._configPath;

    applyProjectConfigExtendsInternal(projectConfig, projectCollection, rootConfigPath);
}

async function applyProjectConfigExtendsInternal(
    projectConfig: ProjectConfigInternal,
    projectCollection: { [key: string]: ProjectConfigInternal } = {},
    rootConfigPath: string
): Promise<void> {
    if (!projectConfig.extends) {
        return;
    }

    const currentConfigFile =
        projectConfig._configPath === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._configPath;
    const configErrorLocation = `projects[${projectConfig._name}].extends`;
    let baseProjectConfig: ProjectConfigInternal | null;

    if (projectConfig.extends.startsWith('project:')) {
        baseProjectConfig = getBaseProjectConfigForProjectExtends(projectConfig, projectCollection, rootConfigPath);
    } else if (projectConfig.extends.startsWith('file:')) {
        baseProjectConfig = await getBaseProjectConfigForFileExtends(projectConfig, rootConfigPath);
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
        await applyProjectConfigExtendsInternal(clonedBaseProject, projectCollection, rootConfigPath);

        delete clonedBaseProject.extends;
    }

    if (clonedBaseProject._name) {
        delete clonedBaseProject._name;
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

function getBaseProjectConfigForProjectExtends(
    projectConfig: ProjectConfigInternal,
    projectCollection: { [key: string]: ProjectConfigInternal } = {},
    rootConfigPath: string
): ProjectConfigInternal | null {
    if (!projectConfig.extends) {
        return null;
    }

    const currentConfigFile =
        projectConfig._configPath === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._configPath;
    const configErrorLocation = `projects[${projectConfig._name}].extends`;

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

    if (foundBaseProject._name === projectConfig._name) {
        throw new Error(
            `Error in extending project config, base project name must not be the same as current project name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    return foundBaseProject;
}

async function getBaseProjectConfigForFileExtends(
    projectConfig: ProjectConfigInternal,
    rootConfigPath: string
): Promise<ProjectConfigInternal | null> {
    if (!projectConfig.extends) {
        return null;
    }

    const currentConfigFile =
        projectConfig._configPath === rootConfigPath ? path.parse(rootConfigPath).base : projectConfig._configPath;
    const configErrorLocation = `projects[${projectConfig._name}].extends`;

    const parts = projectConfig.extends.split(':');
    if (parts.length < 2 || parts.length > 3) {
        throw new Error(
            `Error in extending project config, invalid extends name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    const extendsFilePath = path.isAbsolute(parts[1])
        ? path.resolve(parts[1])
        : path.resolve(path.dirname(projectConfig._configPath), parts[1]);

    if (!(await pathExists(extendsFilePath))) {
        throw new Error(
            `Error in extending project config, no file exists at ${extendsFilePath}. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }

    try {
        const projectNameToExtend = parts.length === 3 ? parts[2] : null;
        if (projectNameToExtend) {
            const libConfig = (await readJsonWithComments(extendsFilePath)) as LibConfig;
            const foundBaseProject = libConfig.projects[projectNameToExtend];
            if (!foundBaseProject) {
                throw new Error(
                    `Error in extending project config, no base project config exists with name '${projectNameToExtend}'. Config location ${currentConfigFile} -> ${configErrorLocation}.`
                );
            }

            const libConifgInternal = toLibConfigInternal(libConfig, extendsFilePath);
            const foundBaseProjectInternal = libConifgInternal.projects[projectNameToExtend];

            if (foundBaseProjectInternal._name === projectConfig._name) {
                throw new Error(
                    `Error in extending project config, base project name must not be the same as current project name. Config location ${currentConfigFile} -> ${configErrorLocation}.`
                );
            }

            const skipValidate = extendsFilePath === rootConfigPath || extendsFilePath === projectConfig._configPath;
            if (!skipValidate) {
                if (libConfig.$schema) {
                    delete libConfig.$schema;
                }

                const libConfigSchema = await readLibConfigSchema();
                const errors = validateSchema(libConfigSchema, (libConfig as unknown) as { [key: string]: unknown });
                if (errors.length) {
                    const errMsg = errors.map((err) => formatValidationError(libConfigSchema, err)).join('\n');
                    throw new Error(
                        `Error in extending project config, invalid configuration:\n\n${errMsg}\nConfig file location ${currentConfigFile}.`
                    );
                }
            }

            return {
                ...foundBaseProjectInternal,
                _name: '',
                _configPath: extendsFilePath
            };
        } else {
            // Standalone project config
            const foundBaseProject = (await readJsonWithComments(extendsFilePath)) as ProjectConfigStandalone;
            if (foundBaseProject.$schema) {
                delete foundBaseProject.$schema;
            }

            const projectConfigSchema = await readProjectConfigSchema();
            const errors = validateSchema(projectConfigSchema, foundBaseProject as { [key: string]: unknown });
            if (errors.length) {
                const errMsg = errors.map((err) => formatValidationError(projectConfigSchema, err)).join('\n');
                throw new Error(
                    `Error in extending project config, invalid configuration:\n\n${errMsg}\nConfig file location ${currentConfigFile}.`
                );
            }

            return {
                ...foundBaseProject,
                _name: '',
                _configPath: extendsFilePath,
                _workspaceRoot: projectConfig._workspaceRoot
            };
        }
    } catch (err) {
        throw new Error(
            `Error in extending project config, could not read file '${extendsFilePath}'. Config location ${currentConfigFile} -> ${configErrorLocation}.`
        );
    }
}
