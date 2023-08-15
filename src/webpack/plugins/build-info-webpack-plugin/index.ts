import chalk from 'chalk';

import { BuildConfigInternal } from '../../../models/index.js';
import { LogLevelString, Logger } from '../../../utils/index.js';

if (!global.buildCounter) {
    global.buildCounter = { count: 0 };
}

const buildCounter = global.buildCounter || { count: 0 };

export interface BuildInfoWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
    logLevel?: LogLevelString;
}

export class BuildInfoWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'build-info-webpack-plugin';
    }

    constructor(private readonly options: BuildInfoWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(): void {
        if (buildCounter.count > 0) {
            this.logger.info('\n');
        }
        ++buildCounter.count;
        this.logger.info(`Running build for ${chalk.cyan(this.options.buildConfig._projectName)}`);
    }
}
