/**
 * @additionalProperties true
 */
export interface SharedCommandOptions {
    /**
     * The workflow configuration file location or set `auto` to analyze project structure and build automatically.
     */
    workflow?: string | 'auto';

    /**
     * Environment name to override the build configuration with `envOverrides[environment]` options.
     */
    environment?: { [key: string]: boolean | string };

    /**
     * Shortcut flag to set environment to `production`.
     */
    prod?: boolean;

    /**
     * Build the specific project(s) filtered by project name(s).
     */
    filter?: string | string[];

    /**
     * Logging level for output information.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'none';

    /**
     * Shortcut flag to set logLevel to `debug`.
     */
    verbose?: boolean;

    /**
     * Run in watch mode.
     */
    watch?: boolean;
}
