import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { BundleOptions, TsTranspilationOptions } from '../project-config';
import { ProjectConfigInternal } from './project-config-internal';

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
    _nodeModulesPath?: string | null;

    _projectRoot: string;
    _outputPath: string;

    _bannerText?: string;

    _packageConfigPath: string;
    _rootPackageConfigPath?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _packageJson: { [key: string]: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _rootPackageJson?: { [key: string]: any };

    _packageName: string;
    _packageNameWithoutScope: string;

    _projectVersion?: string;
    _projectDescription?: string;
    _projectAuthor?: string;
    _projectHomePage?: string;
    _packageScope?: string;

    _isPackagePrivate?: boolean;

    _tsConfigPath?: string;
    _tsConfigJson?: { [key: string]: unknown };
    _tsCompilerConfig?: ParsedCommandLine;

    _isNestedPackage?: boolean;
    _styleParsedEntries?: GlobalScriptStyleParsedEntry[];

    _tsTranspilations?: TsTranspilationOptionsInternal[];
    _prevTsTranspilationVersionReplaced?: boolean;
    _prevTsTranspilationResourcesInlined?: boolean;

    _bundles?: LibBundleOptionsInternal[];

    _packageJsonOutDir?: string;
    _packageEntryPoints?: PackageEntrypoints;
}
