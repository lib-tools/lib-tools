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
