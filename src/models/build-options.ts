import { CommandOptions } from './command-options';

/**
 * @additionalProperties false
 */
export interface BuildOptions extends CommandOptions {
    /**
     * Set the version to override the version fields of the package.json files.
     */
    version?: string;
}
