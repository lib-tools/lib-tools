import { APP_INITIALIZER, ModuleWithProviders, NgModule } from '@angular/core';

import { ConfigService } from './config.service';
import { CONFIG_OPTIONS, ConfigOptions } from './config-options';

export function configAppInitializerFactory(configService: ConfigService): () => Promise<boolean> {
    const res = async () => configService.ensureInitialized().toPromise();

    return res;
}

/**
 * The `NGMODULE` for providing `ConfigService`. Call `configure` method to provide options for `ConfigService`.
 */
@NgModule({
    providers: [ConfigService]
})
export class ConfigModule {
    /**
     * Call this method in root module to provide options for `ConfigService`.
     * @param loadOnStartUp If `true` configuration values are loaded at app starts. Default is `true`.
     * @param options Option object for `ConfigService`.
     */
    static configure(loadOnStartUp = true, options: ConfigOptions = {}): ModuleWithProviders<ConfigModule> {
        return {
            ngModule: ConfigModule,
            providers: [
                {
                    provide: CONFIG_OPTIONS,
                    useValue: options
                },
                loadOnStartUp
                    ? {
                          provide: APP_INITIALIZER,
                          useFactory: configAppInitializerFactory,
                          deps: [ConfigService],
                          multi: true
                      }
                    : []
            ]
        };
    }
}
