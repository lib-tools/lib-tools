/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as ts from 'typescript';

import { formatTsDiagnostics } from './format-ts-diagnostics';

const cache = new Map<string, { [key: string]: unknown }>();

export function readTsConfigFile(tsConfigPath: string): { [key: string]: unknown } {
    const cachedTsConfigJson = cache.get(tsConfigPath);
    if (cachedTsConfigJson) {
        return cachedTsConfigJson;
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const jsonConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (jsonConfigFile.error && jsonConfigFile.error.length) {
        const formattedMsg = formatTsDiagnostics(jsonConfigFile.error);
        if (formattedMsg) {
            throw new Error(formattedMsg);
        }
    }

    cache.set(tsConfigPath, jsonConfigFile.config);

    return jsonConfigFile.config;
}
