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
     * The task configurations.
     */
    tasks?: {
        build: ProjectBuildConfig;
    };
}

/**
 * @additionalProperties false
 */
export interface ProjectConfigStandalone extends ProjectConfig {
    /**
     * Link to schema.
     */
    $schema?: string;
}
