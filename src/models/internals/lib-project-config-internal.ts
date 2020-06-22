import { LibProjectConfig } from '../lib-project-config';

import { GlobalScriptStyleParsedEntry } from './global-script-style-parsed-entry';
import { LibBundleOptionsInternal } from './lib-bundle-options-internal';
import { PackageEntrypoints } from './package-entrypoints';

import { TsTranspilationOptionsInternal } from './ts-transpilation-options-internal';

export interface LibProjectConfigInternal extends LibProjectConfig {
    _workspaceRoot: string;

    _configPath?: string;
    _nodeModulesPath?: string | null;

    _projectRoot: string;
    _outputPath: string;

    _index: number;

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
    _tsCompilerConfig?: { [key: string]: unknown };

    _isNestedPackage?: boolean;
    _styleParsedEntries?: GlobalScriptStyleParsedEntry[];

    _tsTranspilations?: TsTranspilationOptionsInternal[];
    _prevTsTranspilationVersionReplaced?: boolean;
    _prevTsTranspilationResourcesInlined?: boolean;

    _bundles?: LibBundleOptionsInternal[];

    _packageJsonOutDir?: string;
    _packageEntryPoints?: PackageEntrypoints;
}
