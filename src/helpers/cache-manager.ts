import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as ts from 'typescript';

import { InvalidConfigError } from '../models/errors';
import { PackageJsonLike } from '../models/internals';
import { findUp, formatTsDiagnostics, readJson } from '../utils';

export class CacheManager {
    private static _nodeModulesPath: string | null = null;
    private static _libConfigSchema: { [key: string]: unknown } | null = null;
    private static _projectConfigSchema: { [key: string]: unknown } | null = null;
    private static _packageJsonPathMap = new Map<string, string>();
    private static _packageJsonMap = new Map<string, PackageJsonLike>();
    private static _tsConfigJsonMap = new Map<string, { [key: string]: unknown }>();
    private static _tsCompilerConfig = new Map<string, ts.ParsedCommandLine>();

    static async getLibConfigSchema(): Promise<{ [key: string]: unknown }> {
        if (CacheManager._libConfigSchema != null) {
            return CacheManager._libConfigSchema;
        }

        const schemaRootPath = path.resolve(__dirname, '../schemas');
        const schema = await readJson(path.resolve(schemaRootPath, 'schema.json'));

        if (schema.$schema) {
            delete schema.$schema;
        }

        CacheManager._libConfigSchema = schema;

        return CacheManager._libConfigSchema;
    }

    static async getProjectConfigSchema(): Promise<{ [key: string]: unknown }> {
        if (CacheManager._projectConfigSchema != null) {
            return CacheManager._projectConfigSchema;
        }

        const schemaRootPath = path.resolve(__dirname, '../schemas');
        const schema = await readJson(path.resolve(schemaRootPath, 'project-config-schema.json'));

        if (schema.$schema) {
            delete schema.$schema;
        }

        CacheManager._projectConfigSchema = schema;

        return CacheManager._projectConfigSchema;
    }

    static async getNodeModulesPath(workspaceRoot: string): Promise<string | null> {
        if (CacheManager._nodeModulesPath != null) {
            return CacheManager._nodeModulesPath ? CacheManager._nodeModulesPath : null;
        }

        const foundNodeModulesPath = await findUp('node_modules', workspaceRoot, path.parse(workspaceRoot).root);

        if (foundNodeModulesPath) {
            CacheManager._nodeModulesPath = foundNodeModulesPath;
        } else {
            CacheManager._nodeModulesPath = '';
        }

        return CacheManager._nodeModulesPath;
    }

    static async findPackageJsonPath(workspaceRoot: string, projectRoot?: string): Promise<string | null> {
        if (projectRoot) {
            const cachedPath = CacheManager._packageJsonPathMap.get(projectRoot);
            if (cachedPath) {
                return cachedPath;
            }

            const foundPackageJsonPath = await findUp('package.json', projectRoot, workspaceRoot);
            if (foundPackageJsonPath) {
                CacheManager._packageJsonPathMap.set(projectRoot, foundPackageJsonPath);
            }

            return foundPackageJsonPath;
        } else {
            const cachedPath = CacheManager._packageJsonPathMap.get(workspaceRoot);
            if (cachedPath) {
                return cachedPath;
            }

            const rootPackageJsonPath = path.resolve(workspaceRoot, 'package.json');
            if (await pathExists(rootPackageJsonPath)) {
                CacheManager._packageJsonPathMap.set(workspaceRoot, rootPackageJsonPath);
            }

            return rootPackageJsonPath;
        }
    }

    static async getPackageJson(packageJsonPath: string): Promise<PackageJsonLike> {
        const cachedPackageJson = CacheManager._packageJsonMap.get(packageJsonPath);
        if (cachedPackageJson) {
            return cachedPackageJson;
        }

        const packageJson = (await readJson(packageJsonPath)) as PackageJsonLike;
        CacheManager._packageJsonMap.set(packageJsonPath, packageJson);

        return packageJson;
    }

    static readTsConfigFile(tsConfigPath: string): { [key: string]: unknown } {
        const cachedTsConfigJson = CacheManager._tsConfigJsonMap.get(tsConfigPath);
        if (cachedTsConfigJson) {
            return cachedTsConfigJson;
        }

        // eslint-disable-next-line @typescript-eslint/unbound-method
        const jsonConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
        if (jsonConfigFile.error && jsonConfigFile.error.length) {
            const formattedMsg = formatTsDiagnostics(jsonConfigFile.error);
            if (formattedMsg) {
                throw new InvalidConfigError(formattedMsg);
            }
        }

        CacheManager._tsConfigJsonMap.set(tsConfigPath, jsonConfigFile.config);

        return jsonConfigFile.config;
    }

    static getTsCompilerConfig(tsConfigPath: string): ts.ParsedCommandLine {
        const cachedTsCompilerConfig = CacheManager._tsCompilerConfig.get(tsConfigPath);
        if (cachedTsCompilerConfig) {
            return cachedTsCompilerConfig;
        }

        const tsConfigJson = this.readTsConfigFile(tsConfigPath);

        const tsCompilerConfig = ts.parseJsonConfigFileContent(
            tsConfigJson,
            ts.sys,
            path.dirname(tsConfigPath),
            undefined,
            tsConfigPath
        );

        CacheManager._tsCompilerConfig.set(tsConfigPath, tsCompilerConfig);

        return tsCompilerConfig;
    }
}
