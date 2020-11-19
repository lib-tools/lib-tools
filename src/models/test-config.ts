import { OverridableConfig } from './overridable-config';

/**
 * @additionalProperties false
 */
export interface CoverageReporterOptions {
    /**
     * You can use multiple reporters, by providing array of options.
     */
    reporters?: { type: string; dir?: string }[];
    /**
     * This will be used to output coverage reports.
     */
    dir?: string;
    /**
     * This will be used in complement of the coverageReporter.dir option to generate the full output directory path.
     */
    subdir?: string;
    /**
     * If you use one of these reporters, cobertura, lcovonly, teamcity, text or text-summary,you may set the file option to specify the output file.
     */
    file?: string;
}

/**
 * @additionalProperties false
 */
export interface JunitReporterOptions {
    /**
     * Results will be saved as $outputDir/$browserName.xml.
     */
    outputDir?: string;

    /**
     * If included, results will be saved as $outputDir/$browserName/$outputFile.
     */
    outputFile?: string;

    /**
     * suite will become the package name attribute in xml testsuite element.
     */
    suite?: string;

    /**
     * Add browser name to report and classes names.
     */
    useBrowserName?: boolean;

    /**
     * Key value pair of properties to add to the <properties> section of the report.
     */
    properties?: { [key: string]: string };

    /**
     * Use '1' if reporting to be per SonarQube 6.2 XML format
     */
    xmlVersion?: string;
}

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
    polyfills?: string;

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
     * A list of minimatch pattern to exclude files from code coverage report.
     */
    codeCoverageExclude?: string[];

    /**
     * Options for karma-coverage reporter.
     */
    coverageReporter?: CoverageReporterOptions;

    /**
     * Options for karma-junit-reporter.
     */
    junitReporter?: JunitReporterOptions;

    /**
     * If true, extract and include source maps from existing vendor module source map files.
     */
    vendorSourceMap?: boolean;

    /**
     * If true, test runner will stop watching and exit when run completed.
     */
    singleRun?: boolean;

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
     * To override properties based on test environment.
     */
    envOverrides?: {
        [name: string]: Partial<TestConfigBase>;
    };
}
