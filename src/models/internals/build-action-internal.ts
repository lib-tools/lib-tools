import { ParsedCommandLine, ScriptTarget } from 'typescript';

import {
    AssetEntry,
    AutoPrefixerOptions,
    BuildAction,
    CleanCSSOptions,
    ScriptBundleOptions,
    ScriptCompilationOptions,
    ScriptOptions,
    StyleEntry
} from '../build-action';
import { PackageJsonLike } from './package-jon-like';

export interface StyleEntryInternal extends StyleEntry {
    _inputFilePath: string;
    _outputFilePath: string;
    _includePaths: string[];
    _sourceMap: boolean;
    _sourceMapContents: boolean;
    _vendorPrefixes: boolean | AutoPrefixerOptions;
    _minify: boolean | CleanCSSOptions;
    _minOutputFilePath: string;
}

export interface AngularCompilerJsonOptions {
    [key: string]: string | boolean | undefined;
    flatModuleOutFile?: string;
    flatModuleId?: string;
}

export interface TsConfigInfo {
    tsConfigPath: string;
    tsConfigJson: TsConfigJsonOptions;
    tsCompilerConfig: ParsedCommandLine;
}

export interface TsConfigJsonOptions {
    extends?: string;
    compilerOptions?: {
        [key: string]: unknown;
    };
    files?: string[];
    angularCompilerOptions?: AngularCompilerJsonOptions;
}

export interface ScriptBundleOptionsInternal extends ScriptBundleOptions {
    _entryFilePath: string;
    _outputFilePath: string;
    _externals: string[];
    _globals: { [key: string]: string };
}

export interface ScriptCompilationOptionsInternal extends ScriptCompilationOptions {
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;
    _customTsOutDir: string | null;
    _tsConfigInfo: TsConfigInfo;
    _entryName: string;
    _bundles: ScriptBundleOptionsInternal[];
}

export interface ScriptOptionsInternal extends ScriptOptions {
    _tsConfigInfo: TsConfigInfo | null;
    _projectTypescriptModulePath: string | null;
    _entryName: string | null;
    _compilations: ScriptCompilationOptionsInternal[];
    _bundles: ScriptBundleOptionsInternal[];
}

export interface BuildActionInternal extends BuildAction {
    _workspaceRoot: string;
    _config: 'auto' | string;
    _nodeModulesPath: string | null;
    _projectName: string;
    _projectRoot: string;
    _outputPath: string;
    _packageJsonPath: string;
    _packageJson: PackageJsonLike;
    _packageName: string;
    _packageNameWithoutScope: string;
    _packageVersion: string;
    _nestedPackage: boolean;
    _packageScope: string | null;
    _rootPackageJsonPath: string | null;
    _rootPackageJson: PackageJsonLike | null;

    // Assets
    _assetEntries: AssetEntry[];

    // styles
    _styleEntries: StyleEntryInternal[];

    // scripts
    _script?: ScriptOptionsInternal;

    _bannerText?: string;

    // package.json
    _packageJsonOutDir: string;
    _packageJsonEntryPoint: { [key: string]: string };
}
