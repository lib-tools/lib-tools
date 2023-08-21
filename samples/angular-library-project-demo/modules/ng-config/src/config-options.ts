import { InjectionToken } from '@angular/core';

/**
 * Options interface for `ConfigService`.
 */
export interface ConfigOptions {
    /**
     * Set true to log debug information.
     */
    debug?: boolean;
}

export const CONFIG_OPTIONS = new InjectionToken<ConfigOptions>('ConfigOptions');
