import { NgZone } from '@angular/core';

import * as firebase from 'firebase/app';

import { FirebaseConfig } from './firebase-remote-config-provider-options';

export function firebaseAppFactory(options: FirebaseConfig, zone: NgZone, appName?: string): firebase.app.App {
    appName = appName || '[DEFAULT]';

    const existingApp = firebase.apps.filter((app) => app && app.name === appName)[0];

    return existingApp || zone.runOutsideAngular(() => firebase.initializeApp(options, appName));
}
