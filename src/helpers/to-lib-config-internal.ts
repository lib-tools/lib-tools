import * as path from 'path';

import { LibConfig } from '../models';
import { LibConfigInternal, ProjectConfigInternal } from '../models/internals';

export function toLibConfigInternal(
    libConfig: LibConfig,
    configPath: string,
    workspaceRoot: string
): LibConfigInternal {
    const libConfigInternal: LibConfigInternal = {
        _configPath: configPath,
        projects: {}
    };

    const projects = libConfig.projects;
    const keys = Object.keys(projects);

    for (const key of keys) {
        const project = projects[key];

        if (project.root && path.isAbsolute(project.root)) {
            throw new Error(`The 'projects[${key}].root' must be relative path.`);
        }

        const projectRoot = path.resolve(workspaceRoot, project.root || '');

        const projectInternal: ProjectConfigInternal = {
            ...project,
            _configPath: configPath,
            _workspaceRoot: workspaceRoot,
            _projectName: key,
            _projectRoot: projectRoot
        };

        libConfigInternal.projects[key] = projectInternal;
    }

    return libConfigInternal;
}
