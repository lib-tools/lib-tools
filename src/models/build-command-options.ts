import { SharedCommandOptions } from './shared-command-options';

/**
 * @additionalProperties true
 */
export interface BuildCommandOptions extends SharedCommandOptions {
    /**
     * Set the version to override the version field of the package.json file.
     */
    version?: string;

    /**
     * Run in watch mode.
     */
    watch?: boolean;
}
