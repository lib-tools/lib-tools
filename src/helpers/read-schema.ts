import * as path from 'path';

import { readJson } from '../utils';

export async function readSchema(): Promise<{ [key: string]: unknown }> {
    if (((global as unknown) as { [key: string]: unknown }).libConfigSchema) {
        return ((global as unknown) as { [key: string]: unknown }).libConfigSchema as { [key: string]: unknown };
    }

    const schemaRootPath = path.resolve(__dirname, '../schemas');
    const schema = await readJson(path.resolve(schemaRootPath, 'schema.json'));

    if (schema.$schema) {
        delete schema.$schema;
    }

    ((global as unknown) as { [key: string]: unknown }).libConfigSchema = schema;

    return schema;
}
