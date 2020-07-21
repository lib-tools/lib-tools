import { ModuleWithProviders, NgModule } from '@angular/core';

import { CONFIG_PROVIDER } from '@lib-tools-demo/ng-config';

import { HttpConfigProvider } from './http-config-provider';
import { HTTP_CONFIG_PROVIDER_OPTIONS, HttpConfigProviderOptions } from './http-config-provider-options';

/**
 * The `NGMODULE` for providing `HttpConfigProvider`.
 */
@NgModule({
    providers: [
        {
            provide: CONFIG_PROVIDER,
            useClass: HttpConfigProvider,
            multi: true
        }
    ]
})
export class HttpConfigProviderModule {
    /**
     * Call this method to provide options for configuring the `HttpConfigProvider`.
     * @param options An option object for `HttpConfigProvider`.
     */
    static configure(options: HttpConfigProviderOptions): ModuleWithProviders<HttpConfigProviderModule> {
        return {
            ngModule: HttpConfigProviderModule,
            providers: [
                {
                    provide: HTTP_CONFIG_PROVIDER_OPTIONS,
                    useValue: options
                }
            ]
        };
    }
}
