/**
 * @additionalProperties true
 */
export interface CommandOptions {
    /**
     * The workflow configuration file location for set `auto` to determine and run workflow actions for the project structure automatically.
     */
    workflow?: string | 'auto';
    /**
     * Define the environment.
     */
    environment?: { [key: string]: boolean | string };
    /**
     * Shortcut flag to set environment to `production`.
     */
    prod?: boolean;
    /**
     * Run specific project(s) filtering by project name(s).
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
     * Beep when all workflow actions completed.
     */
    beep?: boolean;
}
