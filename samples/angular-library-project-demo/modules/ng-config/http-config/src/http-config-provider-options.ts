import { InjectionToken } from '@angular/core';

/**
 * The options for `HttpConfigProvider`.
 */
export interface HttpConfigProviderOptions {
    /**
     * The endpoint url string or InjectionToken.
     */
    endpoint: string | InjectionToken<string>;
}

export const HTTP_CONFIG_PROVIDER_OPTIONS = new InjectionToken<HttpConfigProviderOptions>('HttpConfigProviderOptions');
