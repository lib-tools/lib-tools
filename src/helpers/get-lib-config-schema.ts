import * as path from 'path';

import { readJson } from '../utils';

const cache: { libConfigSchema: { [key: string]: unknown } | null } = {
    libConfigSchema: null
};

export async function getLibConfigSchema(): Promise<{ [key: string]: unknown }> {
    if (cache.libConfigSchema != null) {
        return cache.libConfigSchema;
    }

    const schemaRootPath = path.resolve(__dirname, '../schemas');
    const schema = await readJson(path.resolve(schemaRootPath, 'schema.json'));

    if (schema.$schema) {
        delete schema.$schema;
    }

    cache.libConfigSchema = schema;

    return schema;
}
