import { OverridableConfig } from './overridable-config';

/**
 * @additionalProperties false
 */
export interface TestConfigBase {
    /**
     * Index file for test.
     */
    testIndexFile?: string;

    /**
     * Polyfill entries.
     */
    polyfills?: string | string[];

    /**
     * Typescript configuration file.
     */
    tsConfig?: string;

    /**
     * Karma configuration file.
     */
    karmaConfig?: string;

    /**
     * A list of browsers to launch and capture.
     */
    browsers?: string[];

    /**
     * A list of reporters to use.
     */
    reporters?: string[];

    /**
     * Output code coverage report.
     */
    codeCoverage?: boolean;

    /**
     * A list of minimatch pattern to exclude files from code coverage report.
     */
    codeCoverageExclude?: string[];

    /**
     * If true, extract and include source maps from existing vendor module source map files.
     */
    vendorSourceMap?: boolean;

    /**
     * Set true to skip the task.
     */
    skip?: boolean;
}

/**
 * The test task.
 * @additionalProperties false
 */
export interface TestConfig extends TestConfigBase, OverridableConfig<TestConfigBase> {
    /**
     * To override properties based on build environment.
     */
    envOverrides?: {
        [name: string]: Partial<TestConfigBase>;
    };
}
