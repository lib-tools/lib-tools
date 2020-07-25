import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

let counter = 0;

export interface ProjectBuildInfoWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class ProjectBuildInfoWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'project-build-info-webpack-plugin';
    }

    constructor(private readonly options: ProjectBuildInfoWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(): void {
        if (counter > 0) {
            this.logger.info('\n');
        }
        ++counter;
        const msg = `Preparing project ${this.options.buildAction._projectName} for build`;
        this.logger.info(msg);
    }
}
