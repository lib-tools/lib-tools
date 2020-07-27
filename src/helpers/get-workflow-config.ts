import * as path from 'path';

import * as Ajv from 'ajv';
import { pathExists } from 'fs-extra';

import { SharedCommandOptions, WorkflowConfig } from '../models';
import { WorkflowConfigInternal } from '../models/internals';
import { findUp, readJsonWithComments } from '../utils';

import { detectWorkflowConfig } from './detect-workflow-config';
import { getCachedWorkflowConfigSchema } from './get-cached-workflow-config-schema';
import { toWorkflowConfigInternal } from './to-workflow-config-internal';

const ajv = new Ajv();

export async function getWorkflowConfig(commandOptions: SharedCommandOptions): Promise<WorkflowConfigInternal> {
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
        const workflowConfig = (await readJsonWithComments(foundConfigPath)) as WorkflowConfig;
        const schema = await getCachedWorkflowConfigSchema();
        if (!ajv.getSchema('workflowSchema')) {
            ajv.addSchema(schema, 'workflowSchema');
        }
        const valid = ajv.validate('workflowSchema', workflowConfig);
        if (!valid) {
            throw new Error(`Invalid configuration. ${ajv.errorsText()}`);
        }

        const workspaceRoot = path.extname(foundConfigPath) ? path.dirname(foundConfigPath) : foundConfigPath;
        return toWorkflowConfigInternal(workflowConfig, foundConfigPath, workspaceRoot);
    } else {
        if (commandOptions.workflow !== 'auto') {
            throw new Error(`Workflow configuration file could not be detected.`);
        }

        const workflowConfig = await detectWorkflowConfig(commandOptions);

        if (workflowConfig == null) {
            throw new Error(`Workflow configuration could not be detected automatically.`);
        }

        return workflowConfig;
    }
}
