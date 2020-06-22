/**
 * @additionalProperties true
 */
export interface ShortcutBuildOptions {
    /**
     * Shortcut flag to set build environment to 'production'.
     */
    prod?: boolean;
    /**
     * Shortcut flag to set logLevel to 'debug'.
     */
    verbose?: boolean;
}

/**
 * @additionalProperties true
 */
export interface BuildOptions {
    /**
     * Define the build environment.
     */
    environment?: { [key: string]: boolean | string } | string;
    /**
     * Filter config by name(s).
     */
    filter?: string | string[];
    /**
     * Display compilation progress in percentage.
     */
    progress?: boolean;
    /**
     * Logging level for output logging.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'none';
    /**
     * Build with watch mode.
     */
    watch?: boolean;
    /**
     * Beep when build completed.
     */
    beep?: boolean;
    /**
     * Set or override library package(s) version.
     */
    version?: string;
}
