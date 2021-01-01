import * as path from 'path';

import Ajv from 'ajv';
import { readJson } from 'fs-extra';

import { WorkflowConfig } from '../models';
import { readJsonWithComments } from '../utils';

const ajv = new Ajv();

let workflowConfig: WorkflowConfig | null = null;

const schemaCache: { schema: { [key: string]: unknown } | null } = {
    schema: null
};

export async function readWorkflowConfig(configPath: string): Promise<WorkflowConfig> {
    if (workflowConfig) {
        return workflowConfig;
    }

    workflowConfig = (await readJsonWithComments(configPath)) as WorkflowConfig;
    const schema = await getWorkflowConfigSchema();
    if (!ajv.getSchema('workflowSchema')) {
        ajv.addSchema(schema, 'workflowSchema');
    }
    const valid = ajv.validate('workflowSchema', workflowConfig);
    if (!valid) {
        throw new Error(`Invalid workflow configuration. ${ajv.errorsText()}`);
    }

    return workflowConfig;
}

export async function getWorkflowConfigSchema(): Promise<{ [key: string]: unknown }> {
    if (schemaCache.schema != null) {
        return schemaCache.schema;
    }

    const schemaRootPath = path.resolve(__dirname, '../schemas');
    const schema = (await readJson(path.resolve(schemaRootPath, 'schema.json'))) as { [key: string]: unknown };

    if (schema.$schema) {
        delete schema.$schema;
    }

    schemaCache.schema = schema;

    return schema;
}
