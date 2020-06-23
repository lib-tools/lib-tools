import { pathExists } from 'fs-extra';
import { Configuration } from 'webpack';

import { InvalidConfigError } from '../../models/errors';
import { BuildCommandOptions } from '../../models/internals';

export async function getWebpackBuildConfig(
    configPath: string,
    env?: string | { [key: string]: boolean | string },
    argv?: BuildCommandOptions,
    logger?: Logger
): Promise<Configuration> {
    const startTime = argv && argv._startTime && typeof argv._startTime === 'number' ? argv._startTime : Date.now();
    if (!configPath || !configPath.length) {
        throw new InvalidConfigError("The 'configPath' is required.");
    }

    if (!/\.json$/i.test(configPath)) {
        throw new InvalidConfigError(`Invalid config file, path: ${configPath}.`);
    }

    if (!(await pathExists(configPath))) {
        throw new InvalidConfigError(`The config file does not exist at ${configPath}.`);
    }
}
