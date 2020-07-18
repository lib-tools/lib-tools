import * as path from 'path';

import { WorkflowConfig } from '../models';
import { ProjectConfigInternal, WorkflowConfigInternal } from '../models/internals';

export function toWorkflowConfigInternal(
    workflowConfig: WorkflowConfig,
    configPath: string,
    workspaceRoot: string
): WorkflowConfigInternal {
    const workflowConfigInternal: WorkflowConfigInternal = {
        projects: {}
    };

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
            _config: configPath,
            _projectName: key,
            _projectRoot: projectRoot
        };

        workflowConfigInternal.projects[key] = projectInternal;
    }

    return workflowConfigInternal;
}
