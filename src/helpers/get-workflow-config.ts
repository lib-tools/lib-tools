import * as path from 'path';

import { SharedCommandOptions, WorkflowConfigInternal } from '../models/index.js';
import { findUp, pathExists } from '../utils/index.js';

import { detectWorkflowConfig } from './detect-workflow-config.js';
import { readWorkflowConfig } from './read-workflow-config.js';
import { toWorkflowConfigInternal } from './to-workflow-config-internal.js';

export async function getWorkflowConfig(
    commandOptions: SharedCommandOptions,
    taskName: 'build' | 'test'
): Promise<WorkflowConfigInternal> {
    let foundConfigPath: string | null = null;
    if (commandOptions.workflow && commandOptions.workflow !== 'auto') {
        foundConfigPath = path.isAbsolute(commandOptions.workflow)
            ? commandOptions.workflow
            : path.resolve(process.cwd(), commandOptions.workflow);

        if (!(await pathExists(foundConfigPath))) {
            throw new Error(`Workflow configuration file ${foundConfigPath} doesn't exist.`);
        }
    }

    if (!commandOptions.workflow || commandOptions.workflow === 'auto') {
        foundConfigPath = await findUp(['workflow.json'], process.cwd(), path.parse(process.cwd()).root);
    }

    if (foundConfigPath) {
        const workflowConfig = await readWorkflowConfig(foundConfigPath);
        const workspaceRoot = path.extname(foundConfigPath) ? path.dirname(foundConfigPath) : foundConfigPath;
        return toWorkflowConfigInternal(workflowConfig, foundConfigPath, workspaceRoot);
    } else {
        if (commandOptions.workflow !== 'auto') {
            throw new Error(`Workflow configuration file could not be detected.`);
        }

        const workflowConfig = await detectWorkflowConfig(taskName);

        if (workflowConfig == null) {
            throw new Error(`Workflow configuration could not be detected automatically.`);
        }

        return workflowConfig;
    }
}
