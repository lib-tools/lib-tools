export interface SharedCommandOptions {
    /**
     * The workflow configuration file location or `auto` to analyze project structure and run task automatically.
     */
    workflow?: string | 'auto';

    /**
     * Environment name to override the task configuration with `envOverrides[environment]` options.
     */
    environment?: { [key: string]: boolean | string };

    /**
     * Filter the project(s) by project name(s).
     */
    filter?: string | string[];

    /**
     * Logging level for output information.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'none' | 'disable';
}
