import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { BundleOptions, TsTranspilationOptions } from '../project-config';
import { ProjectConfigInternal } from './project-config-internal';
import { PackageEntrypoints, PackageJsonLike } from './package-jon-like';

export interface GlobalStyleParsedEntry {
    paths: string[];
    entry: string;
    lazy?: boolean;
}

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _index: number;
    _tsConfigPath: string;
    _tsConfigJson: { [key: string]: unknown };
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
    _tsConfigJson?: { [key: string]: unknown };
    _tsCompilerConfig?: ParsedCommandLine;

    _sourceScriptTarget?: ScriptTarget;
    _destScriptTarget?: ScriptTarget;
    _ecmaVersion?: number;
    _supportES2015?: boolean;

    _nodeResolveFields?: string[];
}

export interface ProjectConfigBuildInternal extends ProjectConfigInternal {
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

    _nodeModulesPath: string | null;
    _bannerText: string | null;

    _tsConfigPath?: string;
    _tsConfigJson?: { [key: string]: unknown };
    _tsCompilerConfig?: ParsedCommandLine;

    _tsTranspilations?: TsTranspilationOptionsInternal[];
    _prevTsTranspilationVersionReplaced?: boolean;
    _prevTsTranspilationResourcesInlined?: boolean;

    _styleParsedEntries: GlobalStyleParsedEntry[] | null;

    _bundles?: BundleOptionsInternal[];

    _packageJsonOutDir: string;
    _packageEntryPoints?: PackageEntrypoints;
}
