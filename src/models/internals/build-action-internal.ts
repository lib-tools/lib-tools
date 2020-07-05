import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { AssetEntry, BuildAction, BundleOptions, StyleEntry, TsTranspilationOptions } from '../actions/build-action';
import { PackageJsonLike } from './package-jon-like';

export interface StyleParsedEntry extends StyleEntry {
    _inputFilePath: string;
    _outputFilePath: string;
    _includePaths?: string[];
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

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _index: number;
    _tsConfigPath: string;
    _tsConfigJson: TsConfigJsonOptions;
    _tsCompilerConfig: ParsedCommandLine;
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;

    _detectedEntryName?: string;
    _typingsOutDir?: string;
    _customTsOutDir?: string;
}

export interface BundleOptionsInternal extends BundleOptions {
    _index: number;
    _entryFilePath: string;
    _outputFilePath: string;

    _tsConfigPath?: string;
    _tsConfigJson?: TsConfigJsonOptions;
    _tsCompilerConfig?: ParsedCommandLine;

    _sourceScriptTarget?: ScriptTarget;
    _destScriptTarget?: ScriptTarget;
    _ecmaVersion?: number;
    _supportES2015?: boolean;
}

export interface BuildActionInternal extends BuildAction {
    _workspaceRoot: string;
    _configPath: string;
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

    _bannerText: string | null;

    _tsConfigPath?: string;
    _tsConfigJson?: TsConfigJsonOptions;
    _tsCompilerConfig?: ParsedCommandLine;
    _tsTranspilations?: TsTranspilationOptionsInternal[];
    _prevTsTranspilationVersionReplaced?: boolean;

    // styles
    _styleParsedEntries?: StyleParsedEntry[];

    _bundles?: BundleOptionsInternal[];

    _copyAssets: (string | AssetEntry)[] | null;

    // package.json
    _packageJsonOutDir: string;
    _packageEntryPoints?: { [key: string]: string };
}
