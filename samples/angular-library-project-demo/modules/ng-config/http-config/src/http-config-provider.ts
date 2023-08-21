import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, Injector } from '@angular/core';

import { Observable } from 'rxjs';

import { ConfigProvider, ConfigSection } from '@lib-tools-demo/ng-config';

import { HTTP_CONFIG_PROVIDER_OPTIONS, HttpConfigProviderOptions } from './http-config-provider-options';

/**
 * Implements an HTTP client API for HttpConfigProvider that relies on the Angular HttpClient.
 */
@Injectable({
    providedIn: 'any'
})
export class HttpConfigProvider implements ConfigProvider {
    get name(): string {
        return 'HttpConfigProvider';
    }

    get endpoint(): string {
        return this.configEndpoint;
    }

    private readonly configEndpoint: string;

    constructor(
        private readonly httpClient: HttpClient,
        injector: Injector,
        @Inject(HTTP_CONFIG_PROVIDER_OPTIONS) options: HttpConfigProviderOptions
    ) {
        if (typeof options.endpoint === 'string') {
            this.configEndpoint = options.endpoint;
        } else {
            this.configEndpoint = injector.get(options.endpoint);
        }
    }

    load(): Observable<ConfigSection> {
        return this.httpClient.get<ConfigSection>(this.configEndpoint);
    }
}
