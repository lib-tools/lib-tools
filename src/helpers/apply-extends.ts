import * as path from 'path';

import { pathExists } from 'fs-extra';

import { readProjectConfigSchema, readSchema } from '../helpers';
import { LibConfig, LibProjectConfig, ProjectConfigBase } from '../models';
import { InvalidConfigError } from '../models/errors';
import { LibProjectConfigInternal } from '../models/internals';
import { findUp, formatValidationError, normalizeRelativePath, readJson, validateSchema } from '../utils';

export async function applyProjectConfigExtends(
    projectConfig: LibProjectConfigInternal,
    projects: LibProjectConfigInternal[] = [],
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

        let baseProjectConfig: LibProjectConfigInternal | null | undefined = null;

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

        const clonedBaseProject = JSON.parse(JSON.stringify(baseProjectConfig)) as LibProjectConfigInternal;
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
    projectConfig: LibProjectConfigInternal,
    workspaceRoot: string
): Promise<LibProjectConfigInternal> {
    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath
        ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.`
        : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const extendsConfigNotFoundErrMsg = `${errPrefix}, could not found built-in project config to be extended, extends name: ${extendsName}${errSuffix}`;

    const builtInConfigFileName = extendsName.substr('lib:'.length).trim();

    if (!builtInConfigFileName) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const buildInConfigsRootPath = path.resolve(__dirname, '../../configs');
    const builtInConfigPath = path.resolve(buildInConfigsRootPath, `lib-${builtInConfigFileName}.json`);

    if (!(await pathExists(builtInConfigPath))) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let config = await readJson(builtInConfigPath);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    config._configPath = builtInConfigPath;

    if (projectConfig._configPath && projectConfig.root) {
        const configRootPath = path.dirname(projectConfig._configPath);
        const projectRootPath = path.resolve(path.dirname(projectConfig._configPath), projectConfig.root);

        const newProdOptions: ProjectConfigBase = {};

        const bannerFilePath = await findUp(['banner.txt'], projectRootPath, configRootPath);
        if (bannerFilePath) {
            newProdOptions.banner = normalizeRelativePath(path.relative(projectRootPath, bannerFilePath));
        }

        const readmeFilePath = await findUp(['README.md'], projectRootPath, configRootPath);
        const licenseFilePath = await findUp(['LICENSE', 'LICENSE.txt'], projectRootPath, configRootPath);

        if (readmeFilePath || licenseFilePath) {
            newProdOptions.copy = [];
            if (readmeFilePath) {
                newProdOptions.copy.push(normalizeRelativePath(path.relative(projectRootPath, readmeFilePath)));
            }
            if (licenseFilePath) {
                newProdOptions.copy.push(normalizeRelativePath(path.relative(projectRootPath, licenseFilePath)));
            }
        }

        const newConfig = {
            envOverrides: {
                prod: {
                    bundles: true,
                    packageJsonCopy: true,
                    ...newProdOptions
                }
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        config = { ...config, ...newConfig };
    }

    return (config as unknown) as LibProjectConfigInternal;
}

export async function getBaseProjectConfigForFileExtends(
    extendsName: string,
    projectConfig: LibProjectConfigInternal,
    workspaceRoot: string
): Promise<LibProjectConfigInternal | null> {
    let baseProjectConfig: LibProjectConfig | null = null;
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

            const libConfigSchema = await readSchema();
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
        const projectConfigSchema = await readProjectConfigSchema();
        const errors = validateSchema(projectConfigSchema, config as { [key: string]: unknown });
        if (errors.length) {
            const errMsg = errors.map((err) => formatValidationError(projectConfigSchema, err)).join('\n');
            throw new InvalidConfigError(`${errPrefix}, invalid configuration.\n\n${errMsg}`);
        }

        baseProjectConfig = config as LibProjectConfigInternal;
    }

    if (baseProjectConfig) {
        (baseProjectConfig as LibProjectConfigInternal)._configPath = extendsFilePath;
    }

    return baseProjectConfig as LibProjectConfigInternal;
}

export function getBaseProjectConfigForProjectExtends(
    extendsName: string,
    projectConfig: LibProjectConfigInternal,
    projects: LibProjectConfigInternal[] = [],
    workspaceRoot: string
): LibProjectConfigInternal | null {
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
