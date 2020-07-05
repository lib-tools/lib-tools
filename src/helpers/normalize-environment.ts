/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

function normalizeEnvName(envName: string): string {
    const envLower = envName.toLowerCase();
    switch (envLower) {
        case 'prod':
        case 'production':
            return 'prod';
        case 'dev':
        case 'development':
            return 'dev';
        case 'dll':
            return 'dll';
        default:
            return envName;
    }
}

function toBooleanOrString(value: string | boolean | null | undefined): boolean | string {
    if (value == null) {
        return false;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (value.toLowerCase() === 'false') {
        return false;
    }

    if (value.toLowerCase() === 'true') {
        return true;
    }

    return value;
}

function toBoolean(value: string | boolean | null | undefined): boolean {
    if (value == null) {
        return false;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (value.toLowerCase() === 'false' || value === '0') {
        return false;
    }

    return value ? true : false;
}

export function normalizeEnvironment(
    rawEnvironment: string | { [key: string]: boolean | string } | null,
    prod?: boolean
): { [key: string]: boolean | string } {
    if (!rawEnvironment) {
        return {};
    }

    const environment: { [key: string]: boolean | string } = {};

    if (typeof rawEnvironment === 'string') {
        const normalizedKey = normalizeEnvName(rawEnvironment);
        environment[normalizedKey] = true;
    } else if (rawEnvironment && typeof rawEnvironment === 'object') {
        Object.keys(rawEnvironment).forEach((key: string) => {
            const normalizedKey = normalizeEnvName(key);
            if (normalizedKey === 'prod' && !prod) {
                environment.prod = toBoolean(rawEnvironment[key]);
            } else {
                environment[normalizedKey] = toBooleanOrString(rawEnvironment[key]);
            }
        });
    }

    // dll
    if (environment.dll != null) {
        if (environment.dll) {
            environment.dll = true;
        } else {
            delete environment.dll;
        }
    }

    // aot
    if (environment.aot != null) {
        if (environment.aot) {
            environment.aot = true;
        } else {
            delete environment.aot;
        }
    }

    // prod
    if (prod) {
        environment.prod = true;
    }

    if (environment.prod != null) {
        if (environment.prod) {
            environment.prod = true;
            environment.production = true;
        } else {
            delete environment.prod;
            if (typeof environment.production != null) {
                delete environment.production;
            }
        }
    } else if (environment.production != null) {
        if (environment.production) {
            environment.prod = true;
            environment.production = true;
        } else {
            delete environment.production;
            if (environment.prod != null) {
                delete environment.prod;
            }
        }
    } else {
        if (environment.prod != null) {
            delete environment.prod;
        }
        if (environment.production != null) {
            delete environment.production;
        }
    }

    // dev
    if (environment.prod) {
        if (environment.dev != null) {
            delete environment.dev;
        }
        if (environment.development != null) {
            delete environment.development;
        }
    } else {
        if (environment.dev == null && environment.development == null) {
            environment.dev = true;
            environment.development = true;
        } else if (environment.dev != null) {
            if (environment.dev) {
                environment.dev = true;
                environment.development = true;
            } else {
                delete environment.dev;
                if (environment.development != null) {
                    delete environment.development;
                }
            }
        } else if (environment.development != null) {
            if (environment.development) {
                environment.dev = true;
                environment.development = true;
            } else {
                delete environment.development;
                if (environment.dev != null) {
                    delete environment.dev;
                }
            }
        }
    }

    return environment;
}
