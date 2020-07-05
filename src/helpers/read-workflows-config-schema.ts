/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { readJson } from 'fs-extra';

const cache: { libConfigSchema: { [key: string]: unknown } | null } = {
    libConfigSchema: null
};

export async function readWorkflowsConfigSchema(): Promise<{ [key: string]: unknown }> {
    if (cache.libConfigSchema != null) {
        return cache.libConfigSchema;
    }

    const schemaRootPath = path.resolve(__dirname, '../../schemas');
    const schema = await readJson(path.resolve(schemaRootPath, 'schema.json'));

    if (schema.$schema) {
        delete schema.$schema;
    }

    cache.libConfigSchema = schema;

    return schema;
}
