import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

import Ajv from 'ajv';

import { WorkflowConfig } from '../models/index.js';
import { readJsonWithComments } from '../utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: To review
const ajv = new Ajv.default();

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
    const content = await fs.readFile(path.resolve(schemaRootPath, 'schema.json'), { encoding: 'utf8' });
    const schema = JSON.parse(content) as { [key: string]: unknown };

    if (schema.$schema) {
        delete schema.$schema;
    }

    schemaCache.schema = schema;

    return schema;
}
