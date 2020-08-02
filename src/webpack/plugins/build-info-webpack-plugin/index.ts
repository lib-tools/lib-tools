import { BuildConfigInternal } from '../../../models';
import { LogLevelString, Logger } from '../../../utils';

let counter = 0;

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
        if (counter > 0) {
            this.logger.info('\n');
        }
        ++counter;
        const msg = `Preparing project ${this.options.buildConfig._projectName} for build`;
        this.logger.info(msg);
    }
}
