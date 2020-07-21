import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { remoteConfig } from 'firebase/app';

import { EMPTY, Observable, of } from 'rxjs';
import { filter, map, observeOn, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';

import { ConfigProvider, ConfigSection } from '@lib-tools-demo/ng-config';

import {
    FIREBASE_REMOTE_CONFIG_PROVIDER_OPTIONS,
    FirebaseRemoteConfigProviderOptions
} from './firebase-remote-config-provider-options';
import { firebaseAppFactory } from './firebase-app-factory';
import { ZoneScheduler } from './zone-helpers';

declare let Zone: { current: unknown };

interface NestedConfigSection {
    [key: string]: string | NestedConfigSection;
}

const doubleUnderscoreRegExp = /__/g;
const validKeyRegExp = /^[_]?[a-zA-Z]/;

const isValidKeys = (keys: string[]): boolean => {
    for (const key of keys) {
        if (!validKeyRegExp.test(key)) {
            return false;
        }
    }

    return true;
};

@Injectable({
    providedIn: 'any'
})
export class FirebaseRemoteConfigProvider implements ConfigProvider {
    get name(): string {
        return 'FirebaseRemoteConfigProvider';
    }

    private readonly isBrowser: boolean;
    private readonly rc: Observable<remoteConfig.RemoteConfig>;

    constructor(
        @Inject(FIREBASE_REMOTE_CONFIG_PROVIDER_OPTIONS)
        private readonly options: FirebaseRemoteConfigProviderOptions,
        // eslint-disable-next-line @typescript-eslint/ban-types
        @Inject(PLATFORM_ID) platformId: Object,
        private readonly ngZone: NgZone
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        const rc$ = of(undefined).pipe(
            observeOn(this.ngZone.runOutsideAngular(() => new ZoneScheduler(Zone.current))),
            switchMap(() => (this.isBrowser ? import('firebase/remote-config') : EMPTY)),
            map(() => firebaseAppFactory(this.options.firebaseConfig, this.ngZone, this.options.appName)),
            map((app) => app.remoteConfig()),
            tap((rc) => {
                if (this.options.remoteConfigSettings) {
                    rc.settings = this.options.remoteConfigSettings as remoteConfig.Settings;
                }
            }),
            startWith((undefined as unknown) as remoteConfig.RemoteConfig),
            shareReplay({ bufferSize: 1, refCount: false })
        );

        this.rc = rc$.pipe(filter<remoteConfig.RemoteConfig>((rc) => !!rc));
    }

    load(): Observable<ConfigSection> {
        return this.rc.pipe(
            switchMap((rc) =>
                this.ngZone.runOutsideAngular(async () => {
                    if (!this.isBrowser) {
                        return {};
                    }

                    await rc.activate();

                    try {
                        await rc.fetch();
                        await rc.activate();
                    } catch (fetchError) {
                        if (this.options.throwIfLoadError) {
                            throw fetchError;
                        }
                    }

                    await rc.ensureInitialized();

                    return rc.getAll();
                })
            ),
            map((config) => {
                const allkeys = Object.keys(config);
                const mappedConfig: ConfigSection = {};
                for (const key of allkeys) {
                    const valueStr = config[key].asString();
                    let normalizedKey = key;

                    if (this.options.prefix) {
                        if (!key.toLowerCase().startsWith(this.options.prefix.toLowerCase())) {
                            continue;
                        } else {
                            normalizedKey = key.substr(this.options.prefix.length);
                        }
                    }

                    const nestedKeys = normalizedKey.split(doubleUnderscoreRegExp);
                    if (nestedKeys.length > 1 && isValidKeys(nestedKeys)) {
                        const firstKey = nestedKeys[0];
                        if (!mappedConfig[firstKey] || typeof mappedConfig[firstKey] !== 'object') {
                            mappedConfig[firstKey] = {};
                        }

                        let accObj = mappedConfig[firstKey] as NestedConfigSection;

                        for (let i = 1; i < nestedKeys.length; i++) {
                            const currentKey = nestedKeys[i];
                            if (i === nestedKeys.length - 1) {
                                accObj[currentKey] = valueStr;
                                break;
                            }

                            if (!accObj[currentKey] || typeof accObj[currentKey] !== 'object') {
                                accObj[currentKey] = {};
                            }

                            accObj = accObj[currentKey] as NestedConfigSection;
                        }
                    } else {
                        mappedConfig[normalizedKey] = valueStr;
                    }
                }

                return mappedConfig;
            })
        );
    }
}
