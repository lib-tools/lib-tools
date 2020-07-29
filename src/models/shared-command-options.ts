export interface SharedCommandOptions {
    /**
     * The workflow configuration file location or set `auto` to analyze project structure automatically.
     */
    workflow?: string | 'auto';

    /**
     * Environment name to override the task configuration with `envOverrides[environment]` options.
     */
    environment?: { [key: string]: boolean | string };

    /**
     * Shortcut flag to set environment to `production`.
     */
    prod?: boolean;

    /**
     * Filter the project(s) by project name(s).
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
