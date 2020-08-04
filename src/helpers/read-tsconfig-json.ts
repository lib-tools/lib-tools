import * as ts from 'typescript';

import { formatTsDiagnostics } from './format-ts-diagnostics';

export interface TsConfigFileSchema {
    [key: string]: unknown;
    files?: string[];
}

const cache = new Map<string, TsConfigFileSchema>();

export function readTsconfigJson(tsConfigPath: string): TsConfigFileSchema {
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

    return jsonConfigFile.config as TsConfigFileSchema;
}
