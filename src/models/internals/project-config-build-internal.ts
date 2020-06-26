import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { BundleOptions, TsTranspilationOptions } from '../project-config';
import { ProjectConfigInternal } from './project-config-internal';
import { PackageJsonLike } from './package-jon-like';

export interface GlobalScriptStyleParsedEntry {
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

export interface LibBundleOptionsInternal extends BundleOptions {
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

export interface PackageEntrypoints {
    main?: string;
    module?: string;
    es2015?: string;
    esm5?: string;
    // It is deprecated as of v9, might be removed in the future.
    esm2015?: string;
    fesm2015?: string;
    fesm5?: string;
    typings?: string;
}

export interface ProjectConfigBuildInternal extends ProjectConfigInternal {
    _projectRoot: string;
    _outputPath: string;

    _packageJsonPath: string;
    _rootPackageJsonPath: string | null;
    _packageJson: PackageJsonLike;
    _rootPackageJson: PackageJsonLike | null;
    _packageName: string;
    _packageNameWithoutScope: string;
    _packageVersion: string | null;
    _packageScope: string | null;
    _packagePrivate: boolean | null;
    _nestedPackage: boolean | null;

    _nodeModulesPath: string | null;
    _bannerText: string | null;

    _tsConfigPath?: string;
    _tsConfigJson?: { [key: string]: unknown };
    _tsCompilerConfig?: ParsedCommandLine;

    _tsTranspilations?: TsTranspilationOptionsInternal[];
    _prevTsTranspilationVersionReplaced?: boolean;
    _prevTsTranspilationResourcesInlined?: boolean;

    _styleParsedEntries?: GlobalScriptStyleParsedEntry[];

    _bundles?: LibBundleOptionsInternal[];

    _packageJsonOutDir?: string;
    _packageEntryPoints?: PackageEntrypoints;
}
