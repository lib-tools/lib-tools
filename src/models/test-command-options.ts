import { SharedCommandOptions } from './shared-command-options';

/**
 * @additionalProperties true
 */
export interface TestCommandOptions extends SharedCommandOptions {
    browsers?: string | string[];
    reporters?: string | string[];
    codeCoverage?: boolean;
}
