import { ProjectConfigBuild } from './project-config-build';

/**
 * @additionalProperties false
 */
export interface ProjectConfig {
    /**
     * Path to base configuration file(s) or name of build-in configuration preset(s) to inherit from.
     */
    extends?: 'lib:default' | string | string[];

    /**
     * Root folder of the project files.
     */
    root?: string;

    /**
     * The task configurations.
     */
    task: {
        build: ProjectConfigBuild;
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
