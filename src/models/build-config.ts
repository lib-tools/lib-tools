import { OverridableConfig } from './overridable-config.js';

/**
 * @additionalProperties false
 */
export interface BeforeBuildCleanOptions {
    /**
     * If true, delete output directory before build. Default is `true`.
     */
    cleanOutDir?: boolean;
    /**
     * Custom file or directory paths to delete.
     */
    paths?: string[];
    /**
     * Exclude list of minimatch patterns.
     */
    exclude?: string[];
}

/**
 * @additionalProperties false
 */
export interface AfterEmitCleanOptions {
    /**
     * File or directory paths to delete after build emit assets.
     */
    paths?: string[];
    /**
     * Exclude list of minimatch patterns.
     */
    exclude?: string[];
}

/**
 * @additionalProperties false
 */
export interface CleanOptions {
    /**
     * Before build clean options.
     */
    beforeBuild?: BeforeBuildCleanOptions;
    /**
     * After emit clean options.
     */
    afterEmit?: AfterEmitCleanOptions;
    /**
     * If trye, allow cleaning outside of the output directory.
     */
    allowOutsideOutDir?: boolean;
    /**
     * If true, allow cleaning outside of the workspace root directory.
     */
    allowOutsideWorkspaceRoot?: boolean;
}

/**
 * @additionalProperties false
 */
export interface AssetEntry {
    /**
     * The source file, folder path or minimatch pattern.
     */
    from: string;
    /**
     * Custom output file or folder name.
     */
    to?: string;
    /**
     * Exclude list of minimatch patterns.
     */
    exclude?: string[];
}

/**
 * @additionalProperties false
 */
export interface AutoPrefixerOptions {
    /**
     * The environment for `Browserslist.
     */
    env?: string;
    /**
     * Should Autoprefixer use Visual Cascade, if CSS is uncompressed.
     */
    cascade?: boolean;
    /**
     * Should Autoprefixer add prefixes.
     */
    add?: boolean;
    /**
     * Should Autoprefixer [remove outdated] prefixes.
     */
    remove?: boolean;
    /**
     * Should Autoprefixer add prefixes for @supports parameters.
     */
    supports?: boolean;
    /**
     * Should Autoprefixer add prefixes for flexbox properties.
     */
    flexbox?: boolean | 'no-2009';
    /**
     * Should Autoprefixer add IE 10-11 prefixes for Grid Layout properties.
     */
    grid?: false | 'autoplace' | 'no-autoplace';
    /**
     * Do not raise error on unknown browser version in `Browserslist` config..
     */
    ignoreUnknownVersions?: boolean;
}

/**
 * @additionalProperties false
 */
export interface CleanCSSFormatOptions {
    /**
     *  Controls where to insert breaks.
     */
    breaks?: {
        /**
         * Controls if a line break comes after an at-rule; e.g. `@charset`.
         */
        afterAtRule?: boolean;

        /**
         * Controls if a line break comes after a block begins; e.g. `@media`.
         */
        afterBlockBegins?: boolean;

        /**
         * Controls if a line break comes after a block ends.
         */
        afterBlockEnds?: boolean;

        /**
         * Controls if a line break comes after a comment.
         */
        afterComment?: boolean;

        /**
         * Controls if a line break comes after a property.
         */
        afterProperty?: boolean;

        /**
         * Controls if a line break comes after a rule begins.
         */
        afterRuleBegins?: boolean;

        /**
         * Controls if a line break comes after a rule ends.
         */
        afterRuleEnds?: boolean;

        /**
         * Controls if a line break comes before a block ends.
         */
        beforeBlockEnds?: boolean;

        /**
         * Controls if a line break comes between selectors.
         */
        betweenSelectors?: boolean;
    };
    /**
     * Controls the new line character, can be `'\r\n'` or `'\n'`(aliased as `'windows'` and `'unix'` or `'crlf'` and `'lf'`).
     */
    breakWith?: string;

    /**
     * Controls number of characters to indent with.
     */
    indentBy?: number;

    /**
     * Controls a character to indent with, can be `'space'` or `'tab'`.
     */
    indentWith?: 'space' | 'tab';

    /**
     * Controls where to insert spaces.
     */
    spaces?: {
        /**
         * Controls if spaces come around selector relations; e.g. `div > a`.
         */
        aroundSelectorRelation?: boolean;

        /**
         * Controls if a space comes before a block begins.
         */
        beforeBlockBegins?: boolean;

        /**
         * Controls if a space comes before a value.
         */
        beforeValue?: boolean;
    };
    /**
     * Controls maximum line length.
     */
    wrapAt?: false | number;

    /**
     * Controls removing trailing semicolons in rule.
     */
    semicolonAfterLastProperty?: boolean;
}

/**
 * @additionalProperties false
 */
export interface CssMinimizerPresetOptions {
    preset?: { [key: string]: { [key: string]: boolean } | boolean };
}

/**
 * @additionalProperties false
 */
export interface StyleEntry {
    /**
     * The input style file. Supported formats are .scss, .sass or .css.
     */
    input: string;
    /**
     * The output file for bundled css. The output can be directory or css file name relative to project `outputPath`.
     */
    output?: string;
    /**
     * If true, enable the outputing of sourcemap. Default is `true`.
     */
    sourceMap?: boolean;
    /**
     * If true, enable the outputing of sources in the generated source map. Default is `true`.
     */
    sourceMapIncludeSources?: boolean;
    /**
     * Paths in which to look for stylesheets loaded by rules like @use and @import.
     */
    loadPaths?: string[];
    /**
     * Set autoprefixer options or boolean value to add vendor prefixes to css rules. Default is `true`.
     */
    vendorPrefixes?: boolean | AutoPrefixerOptions;
    /**
     * Set cssnano preset options or boolean value to generate minify file. Default is `true`.
     */
    minify?: boolean | CssMinimizerPresetOptions;
}

/**
 * @additionalProperties false
 */
export interface StyleOptions {
    /**
     * List of style entries.
     */
    compilations?: StyleEntry[];
    /**
     * Default sourceMap option to all entries. If true, enable the outputing of sourcemap. Default is `true`.
     */
    sourceMap?: boolean;
    /**
     * Default sourceMapIncludeSources option to all entries. If true, enable the outputing of sources in the generated source map. Default is `true`.
     */
    sourceMapIncludeSources?: boolean;
    /**
     * Default loadPaths option to all entries. Paths in which to look for stylesheets loaded by rules like @use and @import.
     */
    loadPaths?: string[];

    /**
     * Default minify option to all entries. Set cssnano preset options or boolean value to generate minify file. Default is `true`.
     */
    minify?: boolean | CssMinimizerPresetOptions;
    /**
     * Default vendorPrefixes option to all entries. Set autoprefixer options or boolean value to add vendor prefixes to css rules. Default is `true`.
     */
    vendorPrefixes?: boolean | AutoPrefixerOptions;

    /**
     * If true, automatically add `style` entry to package.json file. By default, the first entry will be added.
     */
    addToPackageJson?: boolean;
}

/**
 * @additionalProperties false
 */
export interface CommonJsOptions {
    /**
     * Array of minimatch patterns which specifies the files in the build the plugin should ignore. By default non-CommonJS modules are ignored.
     */
    exclude?: string[];
    /**
     * Array of minimatch patterns, which specifies the files in the build the plugin should operate on. By default CommonJS modules are targeted.
     */
    include?: string[];
    /**
     * Search for files other than .js files.
     */
    extensions?: string[];
    /**
     * If true, uses of global won't be deal.
     */
    ignoreGlobal?: boolean;
    /**
     * If false, skip sourceMap generation for CommonJS modules.
     */
    sourceMap?: boolean;
    /**
     * Instructs the plugin whether or not to enable mixed module transformations. This is useful in scenarios with mixed ES and CommonJS modules. Set to `true` if it's known that `require` calls should be transformed, or `false` if the code contains env detection and the `require` should survive a transformation.
     */
    transformMixedEsModules?: boolean;
    /**
     * Sometimes you have to leave require statements unconverted. Pass an array containing the IDs.
     */
    ignore?: string[];
    /**
     * Some modules contain dynamic require calls, or require modules that contain circular dependencies, which are not handled well by static imports. Including those modules as dynamicRequireTargets will simulate a CommonJS (NodeJS-like) environment for them with support for dynamic and circular dependencies.
     */
    dynamicRequireTargets?: string[];
}

export type ScriptTargetString =
    | 'es5'
    | 'ES5'
    | 'es2015'
    | 'ES2015'
    | 'es2016'
    | 'ES2016'
    | 'es2017'
    | 'ES2017'
    | 'es2018'
    | 'ES2018'
    | 'es2019'
    | 'ES2019'
    | 'es2020'
    | 'ES2020'
    | 'esnext'
    | 'ESNext'
    | 'latest'
    | 'Latest';

export type ScriptBundleModuleKind = 'cjs' | 'umd' | 'es';

/**
 * @additionalProperties false
 */
export interface ScriptBundleSharedOptions {
    /**
     * Custom bundle output file.
     */
    outputFile?: string;

    /**
     * If true, minify file will be generated.
     */
    minify?: boolean;

    /**
     *  If true, sourcemap file will be generated.
     */
    sourceMap?: boolean;

    /**
     * CommonJS options or boolean value to convert commonjs modules to es module and include in bundle.
     */
    commonjs?: CommonJsOptions | boolean;

    /**
     * External id and global variable name mapping for bundling options.
     */
    externals?: { [key: string]: string };

    /**
     * If true, 'dependencies' keys in package.json are marked as externals and not included in bundle. Default to 'true'.
     */
    dependenciesAsExternals?: boolean;

    /**
     * If true, 'peerDependenciesAsExternals' keys in package.json are marked as externals and not included in bundle. Default to 'true'.
     */
    peerDependenciesAsExternals?: boolean;
}

/**
 * @additionalProperties false
 */
export interface ScriptBundleOptions extends ScriptBundleSharedOptions {
    /**
     * Specify the format of the generated bundle.
     */
    moduleFormat: ScriptBundleModuleKind;
}

/**
 * @additionalProperties false
 */
export interface ScriptCompilationOptions {
    /**
     * Override custom script target.
     */
    target: ScriptTargetString;
    /**
     * Custom output directory.
     */
    outDir?: string;
    /**
     * Override declaration option. Default `true` to first entry.
     */
    declaration?: boolean;
    /**
     * Set true to bundle compilation output to esm module format.
     */
    esBundle?: boolean | ScriptBundleSharedOptions;
    /**
     * Set true to bundle compilation output to umd module format.
     */
    umdBundle?: boolean | ScriptBundleSharedOptions;
    /**
     * Set true to bundle compilation output to commonjs module format.
     */
    cjsBundle?: boolean | ScriptBundleSharedOptions;
    /**
     * If true, compilation outputs (non-bundle outputs) are deleted after bundle(s) are generated.
     */
    deleteNonBundleOutputs?: boolean;
}

/**
 * @additionalProperties false
 */
export interface ScriptOptions {
    /**
     * List of compilation options or `auto` for automatic compilations based on project structure.
     */
    compilations?: 'auto' | ScriptCompilationOptions[];

    /**
     * List of bundle options.
     */
    bundles?: ScriptBundleOptions[];

    /**
     * Typescript configuration file to be used.
     */
    tsConfig?: string;

    /**
     * If true, automatically add entry points to package.json file.
     */
    addToPackageJson?: boolean;

    /**
     * Entry file to bundle or entry point name to add to package.json. By default it will be automatically detected.
     */
    entry?: string;

    /**
     * If true, search version placeholders in compiled files and replace with package version.
     */
    replaceVersionPlaceholder?: boolean;

    /**
     * Define module id for umd bundle.
     */
    umdId?: string;

    /**
     * External id and global variable name mapping for bundling options.
     */
    externals?: { [key: string]: string };

    /**
     * If true, 'dependencies' keys in package.json are marked as externals and not included in bundle. Default to 'true'.
     */
    dependenciesAsExternals?: boolean;

    /**
     * If true, 'peerDependenciesAsExternals' keys in package.json are marked as externals and not included in bundle. Default to 'true'.
     */
    peerDependenciesAsExternals?: boolean;

    /**
     * What export mode to use.
     */
    exports?: 'default' | 'named' | 'none' | 'auto';
}

/**
 * @additionalProperties false
 */
export interface PackageJsonOptions {
    /**
     * Boolean value whether to update package.json file fields.
     */
    updateFields?: boolean;

    /**
     * Boolean value whether to remove scripts field in package.json file.
     */
    scriptsField?: boolean;
}

/**
 * @additionalProperties false
 */
export interface BuildConfigBase {
    /**
     * The output directory for build results. Default to `[WorkspaceRoot]/dist/packages/[PackageName]`.
     */
    outputPath?: string;

    /**
     * Clean options or boolean value for deleting build output files. By default, output directory will be deleted when build command started. Set `false` to disable cleaning of output directory.
     */
    clean?: CleanOptions | boolean;

    /**
     * List of asset entries to copy to output directory. By default README, LICENSE/LICENCE, CHANGELOG/CHANGES/HISTORY, NOTICE files are copied automatically to output directory.
     */
    copy?: (string | AssetEntry)[];

    /**
     * Style compilation options for sass, scss or css files.
     */
    style?: StyleOptions;

    /**
     * Script compilation and bundle options for javascript and typescript files.
     */
    script?: ScriptOptions;

    /**
     * Options for updating package.json file. Set `false` to disable package.json file copying.
     */
    packageJson?: PackageJsonOptions | boolean;

    /**
     * Banner text to add at the top of each generated files. It can be file path or raw text.
     */
    banner?: string;

    /**
     * Set true to skip the task.
     */
    skip?: boolean;
}

/**
 * The build task.
 * @additionalProperties false
 */
export interface BuildConfig extends BuildConfigBase, OverridableConfig<BuildConfigBase> {
    /**
     * To override properties based on build environment.
     */
    envOverrides?: {
        [name: string]: Partial<BuildConfigBase>;
    };
}
