import { LibProjectConfig } from './lib-project-config';

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
    projects: LibProjectConfig[];
}
