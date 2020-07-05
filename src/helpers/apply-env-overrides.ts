/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { OverridableAction } from '../models';

export function applyEnvOverrides<TConfigBase>(
    overridableAction: OverridableAction<TConfigBase>,
    env: { [key: string]: boolean | string }
): void {
    if (!overridableAction.envOverrides || !Object.keys(overridableAction.envOverrides).length) {
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

    Object.keys(overridableAction.envOverrides).forEach((buildTargetKey: string) => {
        const targetName = buildTargetKey;
        const targets = targetName.split(',');
        targets.forEach((t) => {
            t = t.trim();
            if (buildTargets.indexOf(t) > -1 && overridableAction.envOverrides) {
                const newConfig = overridableAction.envOverrides[t];
                if (newConfig && typeof newConfig === 'object') {
                    overrideActionConfig(overridableAction as { [key: string]: unknown }, newConfig);
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
