import { ModuleWithProviders, NgModule } from '@angular/core';

import { CONFIG_PROVIDER } from '@lib-tools-demo/ng-config';

import { FirebaseRemoteConfigProvider } from './firebase-remote-config-provider';
import {
    FIREBASE_REMOTE_CONFIG_PROVIDER_OPTIONS,
    FirebaseRemoteConfigProviderOptions
} from './firebase-remote-config-provider-options';

/**
 * The `NGMODULE` for providing `FirebaseRemoteConfigProvider`.
 */
@NgModule({
    providers: [
        {
            provide: CONFIG_PROVIDER,
            useClass: FirebaseRemoteConfigProvider,
            multi: true
        }
    ]
})
export class FirebaseRemoteConfigProviderModule {
    /**
     * Call this method to configure options for `FirebaseRemoteConfigProvider`.
     * @param options An option object for `FirebaseRemoteConfigProvider`.
     */
    static configure(
        options: FirebaseRemoteConfigProviderOptions
    ): ModuleWithProviders<FirebaseRemoteConfigProviderModule> {
        return {
            ngModule: FirebaseRemoteConfigProviderModule,
            providers: [
                {
                    provide: FIREBASE_REMOTE_CONFIG_PROVIDER_OPTIONS,
                    useValue: options
                }
            ]
        };
    }
}
