import { InjectionToken } from '@angular/core';

export interface FirebaseConfig {
    [key: string]: string | undefined;
    apiKey?: string;
    projectId?: string;
    appId?: string;
    authDomain?: string;
    databaseURL?: string;
    storageBucket?: string;
    messagingSenderId?: string;
}

export interface FirebaseRemoteConfigSettings {
    /**
     * Defines the maximum age in milliseconds of an entry in the config cache before
     * it is considered stale. Defaults to 43200000 (Twelve hours).
     */
    minimumFetchIntervalMillis?: number;

    /**
     * Defines the maximum amount of milliseconds to wait for a response when fetching
     * configuration from the Remote Config server. Defaults to 60000 (One minute).
     */
    fetchTimeoutMillis?: number;
}

export interface FirebaseRemoteConfigProviderOptions {
    firebaseConfig: FirebaseConfig;
    appName?: string;
    remoteConfigSettings?: FirebaseRemoteConfigSettings;
    throwIfLoadError?: boolean;
    prefix?: string;
}

export const FIREBASE_REMOTE_CONFIG_PROVIDER_OPTIONS = new InjectionToken<FirebaseRemoteConfigProviderOptions>(
    'FirebaseRemoteConfigProviderOptions'
);
