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
     * Custom karma.conf.js file path.
     */
    karmaConfig?: string;
}
