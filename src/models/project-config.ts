import { BuildAction } from './build-action';
import { TestAction } from './test-action';

/**
 * @additionalProperties false
 */
export interface ProjectConfig {
    /**
     * Path to base configuration file or name of the base project to inherit from.
     */
    extends?: string;

    /**
     * Root folder of the project files.
     */
    root?: string;

    /**
     * The action configurations.
     */
    actions?: {
        /**
         * Build action configuration.
         */
        build?: BuildAction;
        /**
         * Test action configuration.
         */
        test?: TestAction;
    };
}
