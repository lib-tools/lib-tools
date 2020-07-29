import * as path from 'path';

import { readJson } from 'fs-extra';

const cache: { schema: { [key: string]: unknown } | null } = {
    schema: null
};

export async function getCachedWorkflowConfigSchema(): Promise<{ [key: string]: unknown }> {
    if (cache.schema != null) {
        return cache.schema;
    }

    const schemaRootPath = path.resolve(__dirname, '../schemas');
    const schema = (await readJson(path.resolve(schemaRootPath, 'schema.json'))) as { [key: string]: unknown };

    if (schema.$schema) {
        delete schema.$schema;
    }

    cache.schema = schema;

    return schema;
}
