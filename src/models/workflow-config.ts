import { ProjectConfig } from './project-config';

/**
 * Workflow configuration.
 * @additionalProperties true
 */
export interface WorkflowConfig {
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
