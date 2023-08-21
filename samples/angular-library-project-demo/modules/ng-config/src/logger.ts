import { InjectionToken } from '@angular/core';

/**
 * Custom logger interface for debug information.
 */
export interface Logger {
    debug(message: string, data?: { [key: string]: unknown }): void;
}

export const NG_CONFIG_LOGGER = new InjectionToken<Logger>('NG-CONFIG Logger');
