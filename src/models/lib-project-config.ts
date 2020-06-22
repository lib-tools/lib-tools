/**
 * @additionalProperties false
 */
export interface BeforeBuildCleanOptions {
    /**
     * If true, delete output directory before build.
     */
    cleanOutDir?: boolean;
    /**
     * If true, delete cache directories before build.
     */
    cleanCache?: boolean;
    /**
     * Paths to be deleted.
     */
    paths?: string[];
    /**
     * Path array to exclude from deleting.
     */
    excludes?: string[];
}

/**
 * @additionalProperties false
 */
export interface AfterEmitCleanOptions {
    /**
     * Paths to be deleted.
     */
    paths?: string[];
    /**
     * Path array to exclude from deleting.
     */
    excludes?: string[];
}

/**
 * @additionalProperties false
 */
export interface CleanOptions {
    /**
     * Before build clean option.
     */
    beforeBuild?: BeforeBuildCleanOptions;
    /**
     * After emit clean option.
     */
    afterEmit?: AfterEmitCleanOptions;
    /**
     * Allows cleaning outside of output directory.
     */
    allowOutsideOutDir?: boolean;
    /**
     * Allows cleaning outside of workspace root.
     */
    allowOutsideWorkspaceRoot?: boolean;
}

/**
 * @additionalProperties false
 */
export interface AssetEntry {
    /**
     * The source file, it can be absolute or relative path or glob pattern.
     */
    from: string;
    /**
     * The output file name.
     */
    to?: string;
    /**
     * The ignore list.
     */
    exclude?: string[];
}

/**
 * @additionalProperties false
 */
export interface GlobalEntry {
    /**
     * The file to include.
     */
    input: string | string[];
    /**
     * The bundle name for this extra entry point.
     */
    bundleName?: string;
    /**
     * If the bundle will be lazy loaded.
     */
    lazy?: boolean;
}

/**
 * @additionalProperties false
 */
export interface StylePreprocessorOptions {
    /**
     * An array of paths that LibSass can look in to attempt to resolve your @import declarations.
     */
    includePaths: string[];
}

export interface ExternalsObjectElement {
    [key: string]:
        | string
        | {
              [key: string]: string;
              commonjs: string;
              amd: string;
              root: string;
          };
}

export type ExternalsEntry = string | ExternalsObjectElement;

/**
 * @additionalProperties false
 */
export interface CommonJsOptions {
    /**
     * Some modules contain dynamic require calls, or require modules that contain circular dependencies, which are not handled well by static imports. Including those modules as dynamicRequireTargets will simulate a CommonJS (NodeJS-like) environment for them with support for dynamic and circular dependencies.
     */
    dynamicRequireTargets?: string[];
    /**
     * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should ignore. By default non-CommonJS modules are ignored.
     */
    exclude?: string[];
    /**
     * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should operate on. By default CommonJS modules are targeted.
     */
    include?: string[];
    /**
     * If true, uses of global won't be dealt with by this plugin.
     */
    ignoreGlobal?: boolean;
}

/**
 * @additionalProperties false
 */
export interface TsTranspilationOptions {
    /**
     * Typescript configuration file for this transpilation.
     */
    tsConfig?: string;
    /**
     * Custom output directory for this transpilation.
     */
    outDir?: string;
    /**
     * Override script target for this transpilation.
     */
    target?: 'es5' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020' | 'esnext';
    /**
     * Override declaration option for this transpilation.
     */
    declaration?: boolean;
    /**
     * If true, templateUrl and styleUrls resources are inlined.
     */
    enableResourceInlining?: boolean;
}

/**
 * @additionalProperties false
 */
export interface LibBundleOptions {
    /**
     * Bundle module format.
     */
    libraryTarget?: 'cjs' | 'umd' | 'esm';
    /**
     * The entry file to be bundled.
     */
    entry?: string;
    /**
     * The typescript configuration file to be used.
     */
    tsConfig?: string;
    /**
     * Entry root directory resolution.
     */
    entryRoot?: 'root' | 'tsTranspilationOutput' | 'prevBundleOutput';
    /**
     * Array index for entry root tsTranspilationResult.
     */
    tsTranspilationIndex?: number;
    /**
     * Custom bundle output file path.
     */
    outputFilePath?: string;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * If true, the bundle system will automatically mark 'dependencies' in package.json to be externals. Default is 'true'.
     */
    dependenciesAsExternals?: boolean;
    /**
     * If true, the bundle system will automatically mark 'peerDependencies' in package.json to be externals. Default is 'true'.
     */
    peerDependenciesAsExternals?: boolean;
    /**
     * If true or options object, commonjs modules are converted to ES6 and included in bundle.
     */
    includeCommonJs?: boolean | CommonJsOptions;
    /**
     * If true, minify file will be generated.
     */
    minify?: boolean;
}

/**
 * @additionalProperties false
 */
export interface LibProjectConfigBase {
    /**
     * The output directory for build results.
     */
    outputPath?: string;
    /**
     * Tell the build system which platform environment the application is targeting.
     */
    platformTarget?: 'web' | 'node';
    /**
     * Clean options.
     */
    clean?: CleanOptions | boolean;
    /**
     * Copy options.
     */
    copy?: (string | AssetEntry)[];
    /**
     * List of global style entries.
     */
    styles?: (string | GlobalEntry)[];
    /**
     * Options to pass to style preprocessors.
     */
    stylePreprocessorOptions?: StylePreprocessorOptions;
    /**
     * The typescript configuration file to be used.
     */
    tsConfig?: string;
    /**
     * Banner text to add at the top of each generated files. It can be text file name or raw text.
     */
    banner?: string;
    /**
     * If true, sourcemaps will be generated.
     */
    sourceMap?: boolean;
    /**
     * If true, this project config will be skipped by the build process.
     */
    skip?: boolean;

    /**
     * Typescript transpilation options.
     */
    tsTranspilations?: TsTranspilationOptions[] | boolean;
    /**
     * The main entry point file for package.json.
     */
    main?: string;
    /**
     * Represents your umd module id.
     */
    libraryName?: string;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * If true or options object, commonjs modules are converted to ES6 and included in bundle.
     */
    includeCommonJs?: boolean | CommonJsOptions;
    /**
     * If true, the bundle system will automatically mark 'dependencies' in package.json to be externals. Default is 'true'.
     */
    dependenciesAsExternals?: boolean;
    /**
     * If true, the bundle system will automatically mark 'peerDependencies' in package.json to be externals. Default is 'true'.
     */
    peerDependenciesAsExternals?: boolean;
    /**
     * Bundle target options.
     */
    bundles?: LibBundleOptions[] | boolean;
    /**
     * The output root directory for package.json file.
     */
    packageJsonOutDir?: string;
    /**
     * Copy package.json file to output path.
     */
    packageJsonCopy?: boolean;
    /**
     * If true, replaces version placeholder with package version.
     */
    replaceVersionPlaceholder?: boolean;
}

export interface LibEnvOverridesOptions {
    [name: string]: LibProjectConfigBase;
}

/**
 * @additionalProperties false
 */
export interface LibProjectConfig extends LibProjectConfigBase {
    /**
     * Link to schema.
     */
    $schema?: string;
    /**
     * The name of this configuration.
     */
    name?: string;
    /**
     * The name of build-in configuration preset, or path(s) to other configuration files which are extended by this configuration.
     */
    extends?: 'lib:default' | string | string[];
    /**
     * The project root folder.
     */
    root?: string;

    /**
     * To override properties based on build environment.
     */
    envOverrides?: LibEnvOverridesOptions;
}
