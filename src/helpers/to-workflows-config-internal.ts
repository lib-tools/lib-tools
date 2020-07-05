/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { WorkflowsConfig } from '../models';
import { ProjectConfigInternal, WorkflowsConfigInternal } from '../models/internals';

export function toWorkflowsConfigInternal(
    workflowsConfig: WorkflowsConfig,
    configPath: string,
    workspaceRoot: string
): WorkflowsConfigInternal {
    const workflowsConfigInternal: WorkflowsConfigInternal = {
        _configPath: configPath,
        projects: {}
    };

    const projects = workflowsConfig.projects;
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

        workflowsConfigInternal.projects[key] = projectInternal;
    }

    return workflowsConfigInternal;
}
