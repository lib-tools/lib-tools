/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { ParsedCommandLine, ScriptTarget } from 'typescript';

import {
    AssetEntry,
    AutoPrefixerOptions,
    BuildAction,
    CleanCSSOptions,
    ScriptBundleEntry,
    ScriptTranspilationEntry,
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

export interface ScriptTranspilationEntryInternal extends ScriptTranspilationEntry {
    _index: number;

    _tsConfigPath: string;
    _tsConfigJson: TsConfigJsonOptions;
    _tsCompilerConfig: ParsedCommandLine;
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;

    _detectedEntryName: string | null;
    _customTsOutDir: string | null;
}

export interface ScriptBundleEntryInternal extends ScriptBundleEntry {
    _index: number;
    _entryFilePath: string;
    _outputFilePath: string;

    _tsConfigPath: string | null;
    _sourceScriptTarget: ScriptTarget | null;
    _destScriptTarget: ScriptTarget | null;
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
    _copyAssets: (AssetEntry | string)[];

    // styles
    _styleEntries: StyleEntryInternal[];

    // tsconfig
    _tsConfigPath?: string;
    _tsConfigJson?: TsConfigJsonOptions;
    _tsCompilerConfig?: ParsedCommandLine;

    // Script transpilations
    _scriptTranspilationEntries?: ScriptTranspilationEntryInternal[];

    // Script bundles
    _scriptBundleEntries?: ScriptBundleEntryInternal[];
    _bannerText?: string;

    // package.json
    _packageJsonOutDir: string;
    _packageJsonEntryPoint: { [key: string]: string };
}
