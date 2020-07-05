import { ProjectBuildConfig } from './project-build-config';

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
     * Set true to skip for processing tasks.
     */
    skip?: boolean;

    /**
     * The task configurations.
     */
    tasks?: {
        build?: ProjectBuildConfig;
    };
}
