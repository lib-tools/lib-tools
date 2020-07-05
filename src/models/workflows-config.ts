import { ProjectConfig } from './project-config';

/**
 * The main workflows configuration.
 * @additionalProperties true
 */
export interface WorkflowsConfig {
    /**
     * Link to schema.
     */
    $schema?: string;

    /**
     * The workflow configurations for projects.
     */
    projects: {
        [key: string]: ProjectConfig;
    };
}
