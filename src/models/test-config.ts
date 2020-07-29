import { OverridableConfig } from './overridable-config';

/**
 * @additionalProperties false
 */
export interface TestConfigBase {
    entry?: string;
    tsConfig?: string;
    polyfills?: string | string[];
    karmaConfig?: string;
    browsers?: string[];
    reporters?: string[];
    /**
     * If true, extract and include source maps from existing vendor module source map files.
     */
    vendorSourceMap?: boolean;
    sourceMap?: boolean;
    codeCoverage?: boolean;
    codeCoverageExclude?: string[];

    /**
     * Set true to skip the action for test.
     */
    skip?: boolean;
}

/**
 * The build action.
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
