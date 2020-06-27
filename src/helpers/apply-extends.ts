import * as path from 'path';

import { pathExists } from 'fs-extra';

import { LibConfig, ProjectConfig } from '../models';
import { InvalidConfigError } from '../models/errors';
import { ProjectConfigInternal } from '../models/internals';
import { findUp, formatValidationError, normalizeRelativePath, readJson, validateSchema } from '../utils';

import { getLibConfigSchema } from './get-lib-config-schema';
import { getProjectConfigSchema } from './get-project-config-schema';

export async function applyProjectConfigExtends(
    projectConfig: ProjectConfigInternal,
    projects: ProjectConfigInternal[] = [],
    workspaceRoot: string
): Promise<void> {
    if (!projectConfig.extends) {
        return;
    }

    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath
        ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.`
        : '';

    const extendArray = Array.isArray(projectConfig.extends) ? projectConfig.extends : [projectConfig.extends];

    for (const extendsName of extendArray) {
        if (!extendsName) {
            continue;
        }

        let baseProjectConfig: ProjectConfigInternal | null | undefined = null;

        if (extendsName.startsWith('lib:')) {
            baseProjectConfig = await getBaseProjectConfigForBuiltInExtends(extendsName, projectConfig, workspaceRoot);
        } else if (extendsName.startsWith('project:')) {
            baseProjectConfig = getBaseProjectConfigForProjectExtends(
                extendsName,
                projectConfig,
                projects,
                workspaceRoot
            );
        } else if (extendsName.startsWith('file:')) {
            baseProjectConfig = await getBaseProjectConfigForFileExtends(extendsName, projectConfig, workspaceRoot);
        } else {
            throw new InvalidConfigError(`${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`);
        }

        if (!baseProjectConfig) {
            continue;
        }

        const clonedBaseProject = JSON.parse(JSON.stringify(baseProjectConfig)) as ProjectConfigInternal;
        if (clonedBaseProject.extends) {
            await applyProjectConfigExtends(clonedBaseProject, projects, workspaceRoot);

            delete clonedBaseProject.extends;
        }

        if (clonedBaseProject.name) {
            delete clonedBaseProject.name;
        }

        if (clonedBaseProject.$schema) {
            delete clonedBaseProject.$schema;
        }

        const extendedConfig = { ...clonedBaseProject, ...projectConfig };
        Object.assign(projectConfig, extendedConfig);
    }
}

export async function getBaseProjectConfigForBuiltInExtends(
    extendsName: string,
    projectConfig: ProjectConfigInternal,
    workspaceRoot: string
): Promise<ProjectConfigInternal> {
    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath
        ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.`
        : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const extendsConfigNotFoundErrMsg = `${errPrefix}, could not found built-in project config to be extended, extends name: ${extendsName}${errSuffix}`;

    const builtInConfigFileName = extendsName.trim();

    if (!builtInConfigFileName) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const buildInConfigsRootPath = path.resolve(__dirname, '../../configs');
    const builtInConfigPath = path.resolve(buildInConfigsRootPath, `${builtInConfigFileName}.json`);

    if (!(await pathExists(builtInConfigPath))) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    const builtinProjectConfig = ((await readJson(builtInConfigPath)) as unknown) as ProjectConfig;
    const config: ProjectConfigInternal = {
        ...builtinProjectConfig,
        _index: projectConfig._index,
        _configPath: builtInConfigPath,
        _workspaceRoot: projectConfig._workspaceRoot
    };

    if (projectConfig._configPath && projectConfig.root) {
        const configRootPath = path.dirname(projectConfig._configPath);
        const projectRootPath = path.resolve(path.dirname(projectConfig._configPath), projectConfig.root);

        let banner: string | undefined;
        const foundBannerFilePath = await findUp(['banner.txt'], projectRootPath, configRootPath);
        if (foundBannerFilePath) {
            banner = normalizeRelativePath(path.relative(projectRootPath, foundBannerFilePath));
        }

        const foundReadMeFilePath = await findUp(['README.md'], projectRootPath, configRootPath);
        const foundLicenseFilePath = await findUp(['LICENSE', 'LICENSE.txt'], projectRootPath, configRootPath);
        let copyAssets: string[] | undefined;
        if (foundReadMeFilePath || foundLicenseFilePath) {
            copyAssets = [];

            if (foundReadMeFilePath) {
                copyAssets.push(normalizeRelativePath(path.relative(projectRootPath, foundReadMeFilePath)));
            }

            if (foundLicenseFilePath) {
                copyAssets.push(normalizeRelativePath(path.relative(projectRootPath, foundLicenseFilePath)));
            }
        }

        config.envOverrides = {
            prod: {
                banner,
                copy: copyAssets,
                bundles: true,
                packageJsonCopy: true
            }
        };
    }

    return config;
}

export async function getBaseProjectConfigForFileExtends(
    extendsName: string,
    projectConfig: ProjectConfigInternal,
    workspaceRoot: string
): Promise<ProjectConfigInternal | null> {
    let baseProjectConfig: ProjectConfig | null = null;
    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath
        ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.`
        : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const extendsFileNotFoundErrMsg = `${errPrefix}, could not found project config file to be extended, extends name: ${extendsName}${errSuffix}`;

    if (!projectConfig._configPath) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const parts = extendsName.split(':');
    if (parts.length < 1 || parts.length > 3) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const extendsFilePath = path.isAbsolute(parts[1])
        ? path.resolve(parts[1])
        : path.resolve(path.dirname(projectConfig._configPath), parts[1]);
    const projectName = parts.length >= 3 ? parts[2] : null;

    if (!(await pathExists(extendsFilePath))) {
        throw new InvalidConfigError(extendsFileNotFoundErrMsg);
    }

    let config: unknown | null = null;

    try {
        config = (await readJson(extendsFilePath)) as { [key: string]: unknown };
    } catch (jsonErr2) {
        throw new InvalidConfigError(
            `Error in reading extend file: ${path.relative(
                workspaceRoot,
                extendsFilePath
            )}, extends name: ${extendsName}${errSuffix}`
        );
    }

    if (!config) {
        throw new InvalidConfigError(
            `Error in reading extend file: ${path.relative(
                workspaceRoot,
                extendsFilePath
            )}, extends name: ${extendsName}${errSuffix}`
        );
    }

    if (projectName) {
        const libConfig = config as LibConfig;

        if (projectConfig._configPath !== extendsFilePath) {
            if (libConfig.$schema) {
                delete libConfig.$schema;
            }

            const libConfigSchema = await getLibConfigSchema();
            const errors = validateSchema(libConfigSchema, (libConfig as unknown) as { [key: string]: unknown });
            if (errors.length) {
                const errMsg = errors.map((err) => formatValidationError(libConfigSchema, err)).join('\n');
                throw new InvalidConfigError(`${errPrefix}, invalid configuration.\n\n${errMsg}`);
            }
        }

        // Set config defaults
        const libConfigInternal = libConfig;
        libConfigInternal.projects = libConfigInternal.projects || [];

        // extends
        for (const project of libConfigInternal.projects) {
            if (project.name === projectName) {
                baseProjectConfig = project;
                break;
            }
        }
    } else {
        const projectConfigSchema = await getProjectConfigSchema();
        const errors = validateSchema(projectConfigSchema, config as { [key: string]: unknown });
        if (errors.length) {
            const errMsg = errors.map((err) => formatValidationError(projectConfigSchema, err)).join('\n');
            throw new InvalidConfigError(`${errPrefix}, invalid configuration.\n\n${errMsg}`);
        }

        baseProjectConfig = config as ProjectConfigInternal;
    }

    if (baseProjectConfig) {
        (baseProjectConfig as ProjectConfigInternal)._configPath = extendsFilePath;
    }

    return baseProjectConfig as ProjectConfigInternal;
}

export function getBaseProjectConfigForProjectExtends(
    extendsName: string,
    projectConfig: ProjectConfigInternal,
    projects: ProjectConfigInternal[] = [],
    workspaceRoot: string
): ProjectConfigInternal | null {
    if (projects.length < 1) {
        return null;
    }

    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath
        ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.`
        : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const sameExtendNameErrMsg = `${errPrefix}, extend project name must not be the same as current project name, extends name: ${extendsName}${errSuffix}`;
    const extendsConfigNotFoundErrMsg = `${errPrefix}, could not found project config to be extended, extends name: ${extendsName}${errSuffix}`;

    const projectName = extendsName.substr('project:'.length).trim();
    if (!projectName) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const foundProject = projects.find((project) => project.name === projectName);

    if (!foundProject) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    if (projectConfig.name && foundProject.name === projectConfig.name) {
        throw new InvalidConfigError(sameExtendNameErrMsg);
    }

    return foundProject;
}
