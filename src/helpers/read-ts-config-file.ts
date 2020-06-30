import * as ts from 'typescript';

import { formatTsDiagnostics } from '../utils';

const tsConfigJsonMap = new Map<string, { [key: string]: unknown }>();

export function readTsConfigFile(tsConfigPath: string): { [key: string]: unknown } {
    const cachedTsConfigJson = tsConfigJsonMap.get(tsConfigPath);
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

    tsConfigJsonMap.set(tsConfigPath, jsonConfigFile.config);

    return jsonConfigFile.config;
}
