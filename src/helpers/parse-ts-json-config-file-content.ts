/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import * as ts from 'typescript';

import { readTsConfigFile } from './read-ts-config-file';

const cache = new Map<string, ts.ParsedCommandLine>();

export function parseTsJsonConfigFileContent(tsConfigPath: string): ts.ParsedCommandLine {
    const cachedTsCompilerConfig = cache.get(tsConfigPath);
    if (cachedTsCompilerConfig) {
        return cachedTsCompilerConfig;
    }

    const tsConfigJson = readTsConfigFile(tsConfigPath);

    const tsCompilerConfig = ts.parseJsonConfigFileContent(
        tsConfigJson,
        ts.sys,
        path.dirname(tsConfigPath),
        undefined,
        tsConfigPath
    );

    cache.set(tsConfigPath, tsCompilerConfig);

    return tsCompilerConfig;
}
