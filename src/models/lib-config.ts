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
     * The project configurations.
     */
    projects: {
        [key: string]: ProjectConfig;
    };
}
