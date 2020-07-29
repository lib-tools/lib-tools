import { OverridableConfig } from '../models';

export function applyEnvOverrides<TConfigBase>(
    overridableConfig: OverridableConfig<TConfigBase>,
    env: { [key: string]: boolean | string }
): void {
    if (!overridableConfig.envOverrides || !Object.keys(overridableConfig.envOverrides).length) {
        return;
    }

    const buildTargets: string[] = [];

    if (env.production || env.prod) {
        if (!buildTargets.includes('prod')) {
            buildTargets.push('prod');
        }
        if (!buildTargets.includes('production')) {
            buildTargets.push('production');
        }
    } else if (env.dev || env.development) {
        buildTargets.push('dev');
        buildTargets.push('development');
    }

    const preDefinedKeys = ['prod', 'production', 'dev', 'development'];

    Object.keys(env)
        .filter(
            (key) =>
                !preDefinedKeys.includes(key.toLowerCase()) &&
                !buildTargets.includes(key) &&
                env[key] &&
                (typeof env[key] === 'boolean' || env[key] === 'true')
        )
        .forEach((key) => {
            buildTargets.push(key);
        });

    Object.keys(overridableConfig.envOverrides).forEach((buildTargetKey: string) => {
        const targetName = buildTargetKey;
        const targets = targetName.split(',');
        targets.forEach((t) => {
            t = t.trim();
            if (buildTargets.indexOf(t) > -1 && overridableConfig.envOverrides) {
                const newConfig = overridableConfig.envOverrides[t];
                if (newConfig && typeof newConfig === 'object') {
                    overrideActionConfig(overridableConfig as { [key: string]: unknown }, newConfig);
                }
            }
        });
    });
}

function overrideActionConfig(oldConfig: { [key: string]: unknown }, newConfig: { [key: string]: unknown }): void {
    Object.keys(newConfig)
        .filter((key: string) => key !== 'envOverrides')
        .forEach((key: string) => {
            oldConfig[key] = JSON.parse(JSON.stringify(newConfig[key])) as unknown;
        });
}
