/**
 * @additionalProperties true
 */
export interface BuildOptions {
    /**
     * Detect project structure and build without configuration file.
     */
    auto?: boolean;
    /**
     * Define the build environment.
     */
    environment?: { [key: string]: boolean | string } | string;
    /**
     * Filter projects by name(s) for build processing.
     */
    filter?: string | string[];
    /**
     * Logging level for output debugging.
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
     * Set version to override versions of the project packages.
     */
    version?: string;
}
