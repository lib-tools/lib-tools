/**
 * @additionalProperties true
 */
export interface BuildCommandOptions {
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
     * Set the version to override the version field of the package.json file.
     */
    version?: string;
    /**
     * Beep when all build actions completed.
     */
    beep?: boolean;
}
