/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { readJson } from 'fs-extra';

const cache: { projectConfigSchema: { [key: string]: unknown } | null } = {
    projectConfigSchema: null
};

export async function readProjectConfigSchema(): Promise<{ [key: string]: unknown }> {
    if (cache.projectConfigSchema != null) {
        return cache.projectConfigSchema;
    }

    const schemaRootPath = path.resolve(__dirname, '../../schemas');
    const schema = (await readJson(path.resolve(schemaRootPath, 'project-config-schema.json'))) as {
        [key: string]: unknown;
    };

    if (schema.$schema) {
        delete schema.$schema;
    }

    cache.projectConfigSchema = schema;

    return schema;
}
