import { ParsedCommandLine, ScriptTarget } from 'typescript';

import {
    AssetEntry,
    AutoPrefixerOptions,
    BuildAction,
    CleanCSSOptions,
    ScriptBundleEntry,
    ScriptCompilationEntry,
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

export interface TsConfigJsonOptions {
    extends?: string;
    compilerOptions?: {
        [key: string]: unknown;
    };
    files?: string[];
    angularCompilerOptions?: AngularCompilerJsonOptions;
}

export interface ScriptBundleEntryInternal extends ScriptBundleEntry {
    _entryFilePath: string;
    _outputFilePath: string;
}

export interface ScriptCompilationEntryInternal extends ScriptCompilationEntry {
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;
    _customTsOutDir: string | null;
    _bundle: ScriptBundleEntryInternal | null;
}

export interface TsConfigInfo {
    tsConfigPath: string;
    tsConfigJson: TsConfigJsonOptions;
    tsCompilerConfig: ParsedCommandLine;
}

export interface ScriptOptionsInternal extends ScriptOptions {
    _tsConfigInfo: TsConfigInfo | null;
    _entryNameRel: string | null;
    _bannerText: string | null;
    _compilations: ScriptCompilationEntryInternal[];
    _bundles: ScriptBundleEntryInternal[];
}

export interface BuildActionInternal extends BuildAction {
    _workspaceRoot: string;
    _configPath: string | null;
    _nodeModulesPath: string | null;
    _projectName: string;
    _projectRoot: string;
    _outputPath: string;
    _packageJsonPath: string;
    _packageJson: PackageJsonLike;
    _packageName: string;
    _packageNameWithoutScope: string;
    _packageVersion: string;
    _privatePackage: boolean;
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

    // package.json
    _packageJsonOutDir: string;
    _packageJsonEntryPoint: { [key: string]: string };
}
