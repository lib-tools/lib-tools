import { ProjectBuildConfig } from './project-build-config';

/**
 * @additionalProperties false
 */
export interface ProjectConfig {
    /**
     * Name of build-in preset ('default') or path to base configuration file or name of the base project to inherit from.
     */
    extends?: 'default' | string;

    /**
     * Root folder of the project files.
     */
    root?: string;

    /**
     * The task configurations.
     */
    task?: {
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
