export function getEnvironment(
    env: { [key: string]: boolean | string } | null | undefined,
    argv: { [key: string]: unknown } | null | undefined
): { [key: string]: boolean | string } {
    const environment: { [key: string]: boolean | string } = {};

    let envObj: { [key: string]: unknown } = {
        ...env
    };

    if (argv && (argv.environment || argv.env)) {
        const argvEnv = (argv.environment || argv.env) as { [key: string]: unknown };
        envObj = {
            ...envObj,
            ...argvEnv
        };
    }

    Object.keys(envObj).forEach((key: string) => {
        const normalizedKey = normalizeEnvName(key);
        environment[normalizedKey] = toBooleanOrString(envObj[key]);
    });

    // production override
    if (argv && typeof argv.prod === 'boolean') {
        environment.production = argv.prod;
    } else if (
        environment.production == null &&
        typeof process.env.NODE_ENV === 'string' &&
        process.env.NODE_ENV.toLowerCase() === 'production'
    ) {
        environment.production = true;
    }

    // ci override
    if (argv && typeof argv.ci === 'boolean') {
        environment.ci = argv.ci;
    } else if (environment.ci == null && process.env.ci) {
        environment.ci = true;
    }

    return environment;
}

function normalizeEnvName(envName: string): string {
    const envLower = envName.toLowerCase();
    switch (envLower) {
        case 'prod':
        case 'production':
            return 'production';
        case 'dev':
        case 'development':
            return 'development';
        case 'ci':
            return 'ci';
        default:
            return envName;
    }
}

function toBooleanOrString(value: unknown): boolean | string {
    if (value == null) {
        return false;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        if (value.toLowerCase() === 'false') {
            return false;
        } else if (value.toLowerCase() === 'true') {
            return true;
        }
    }

    return `${value}`;
}
