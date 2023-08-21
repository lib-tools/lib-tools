import { BuildConfig } from './build-config';
import { TestConfig } from './test-config';

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
     * The task configurations.
     */
    tasks?: {
        /**
         * Build task configuration.
         */
        build?: BuildConfig;
        /**
         * Test task configuration.
         */
        test?: TestConfig;
    };
}
