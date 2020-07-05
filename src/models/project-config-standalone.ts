import { ProjectConfig } from './project-config';

/**
 * Standalone project configuration.
 * @additionalProperties false
 */
export interface ProjectConfigStandalone extends ProjectConfig {
    /**
     * Link to schema.
     */
    $schema?: string;
}
