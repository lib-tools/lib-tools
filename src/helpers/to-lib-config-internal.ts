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

    const keys = Object.keys(libConfig);

    for (const key of keys) {
        const project = libConfig.projects[key];

        const projectInternal: ProjectConfigInternal = {
            ...project,
            _configPath: configPath,
            _workspaceRoot: workspaceRoot,
            _name: key
        };

        libConfigInternal.projects[key] = projectInternal;
    }

    return libConfigInternal;
}
