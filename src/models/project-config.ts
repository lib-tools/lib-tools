import { BuildAction } from './build-action';

/**
 * The project configuration.
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
     * Set true for skipping actions.
     */
    skip?: boolean;

    /**
     * The action configurations.
     */
    actions?: {
        build?: BuildAction;
    };
}
