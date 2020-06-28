import { BuildOptions } from './build-options';

/**
 * @additionalProperties true
 */
export interface BuildShortcutOptions {
    /**
     * Shortcut flag to set build environment to 'production'.
     */
    prod?: boolean;
    /**
     * Shortcut flag to set logLevel to 'debug'.
     */
    verbose?: boolean;
}

export interface BuildCommandOptions extends BuildOptions, BuildShortcutOptions {
    config?: string;
}
