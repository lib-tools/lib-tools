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
     * Output code coverage report.
     */
    codeCoverage?: boolean;

    /**
     * A list of minimatch pattern to exclude files from code coverage report.
     */
    codeCoverageExclude?: string | string[];
}
