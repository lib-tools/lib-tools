import { ProjectConfig } from './project-config';

/**
 * @additionalProperties true
 */
export interface LibConfig {
    /**
     * Link to schema.
     */
    $schema?: string;
    /**
     * The library project configurations.
     */
    projects: ProjectConfig[];
}
