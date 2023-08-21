import { SharedCommandOptions } from './shared-command-options';

export interface TestCommandOptions extends SharedCommandOptions {
    /**
     * A list of browsers to launch and capture.
     */
    browsers?: string | string[];

    /**
     * A list of reporters to use.
     */
    reporters?: string | string[];

    /**
     * A list of minimatch pattern to exclude files from code coverage report.
     */
    codeCoverageExclude?: string | string[];

    /**
     * If true, test runner will stop watching and exit when run completed.
     */
    singleRun?: boolean;
}
