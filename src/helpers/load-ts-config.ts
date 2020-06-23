import * as path from 'path';

import * as ts from 'typescript';

import { JsonObject } from '../models';
import { InvalidConfigError } from '../models/errors';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../models/internals';
import { formatTsDiagnostics } from '../utils';

export function loadTsConfig(tsConfigPath: string,
    config: {
        _tsConfigPath?: string;
        _tsConfigJson?: JsonObject;
        _tsCompilerConfig?: ts.ParsedCommandLine;
        _angularCompilerOptions?: JsonObject;
    },
    projectConfig: AppProjectConfigInternal | LibProjectConfigInternal): void {
    config._tsConfigPath = tsConfigPath;
    if (!config._tsConfigJson || !config._tsCompilerConfig) {
        const sameAsProjectTsConfig = projectConfig.tsConfig &&
            projectConfig._tsConfigPath &&
            tsConfigPath === projectConfig._tsConfigPath;

        if (sameAsProjectTsConfig && projectConfig._tsConfigJson && projectConfig._tsCompilerConfig) {
            config._tsConfigJson = projectConfig._tsConfigJson;
            config._tsCompilerConfig = projectConfig._tsCompilerConfig;
            config._angularCompilerOptions = projectConfig._angularCompilerOptions;
        } else {
            const jsonConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
            if (jsonConfigFile.error && jsonConfigFile.error.length) {
                const formattedMsg = formatTsDiagnostics(jsonConfigFile.error);
                if (formattedMsg) {
                    throw new InvalidConfigError(formattedMsg);
                }
            }

            // _tsConfigJson
            config._tsConfigJson = jsonConfigFile.config as JsonObject;
            if (sameAsProjectTsConfig && !projectConfig._tsConfigJson) {
                // tslint:disable-next-line: no-unsafe-any
                projectConfig._tsConfigJson = config._tsConfigJson;
            }

            // _tsCompilerConfig
            config._tsCompilerConfig = ts.parseJsonConfigFileContent(
                config._tsConfigJson,
                ts.sys,
                path.dirname(tsConfigPath),
                undefined,
                tsConfigPath);

            if (sameAsProjectTsConfig && !projectConfig._tsCompilerConfig) {
                projectConfig._tsCompilerConfig = config._tsCompilerConfig;
            }

            // _angularCompilerOptions
            config._angularCompilerOptions =
                config._tsConfigJson.angularCompilerOptions as JsonObject;
            if (sameAsProjectTsConfig && config._angularCompilerOptions && !projectConfig._angularCompilerOptions) {
                projectConfig._angularCompilerOptions = config._angularCompilerOptions;
            }
        }
    }
}
