import * as path from 'path';

import { readJson } from 'fs-extra';

const schemaRootPath = path.resolve(__dirname, '../schemas');

const cache: { schema: { [key: string]: unknown } | null } = {
    schema: null
};

export async function getCachedProjectConfigSchema(): Promise<{ [key: string]: unknown }> {
    if (cache.schema != null) {
        return cache.schema;
    }

    const schema = (await readJson(path.resolve(schemaRootPath, 'project-config-schema.json'))) as {
        [key: string]: unknown;
    };

    if (schema.$schema) {
        delete schema.$schema;
    }

    cache.schema = schema;

    return schema;
}
