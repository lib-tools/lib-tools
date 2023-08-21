import { InjectionToken } from '@angular/core';

import { Observable } from 'rxjs';

import { ConfigSection } from './config-value';

/**
 * The ConfigProvider interface.
 */
export interface ConfigProvider {
    /**
     * The name of the provider.
     */
    readonly name: string;
    /**
     * Fetch method for loading configuration.
     */
    load(): Observable<ConfigSection>;
}

export const CONFIG_PROVIDER = new InjectionToken<ConfigProvider>('ConfigProvider');
