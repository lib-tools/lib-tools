import * as ts from 'typescript';

import { InvalidConfigError } from '../models/errors';
import { formatTsDiagnostics } from '../utils';

const tsConfigJsonMap = new Map<string, { [key: string]: unknown }>();

export function readTsConfigFile(
    tsConfigPath: string,
    configPath: string,
    configErrorLocation: string
): { [key: string]: unknown } {
    const cachedTsConfigJson = tsConfigJsonMap.get(tsConfigPath);
    if (cachedTsConfigJson) {
        return cachedTsConfigJson;
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const jsonConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (jsonConfigFile.error && jsonConfigFile.error.length) {
        let formattedMsg = formatTsDiagnostics(jsonConfigFile.error);
        if (formattedMsg) {
            formattedMsg += `\nConfig location ${configErrorLocation}.`;
            throw new InvalidConfigError(formattedMsg, configPath, configErrorLocation);
        }
    }

    tsConfigJsonMap.set(tsConfigPath, jsonConfigFile.config);

    return jsonConfigFile.config;
}
