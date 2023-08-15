import chalk from 'chalk';

import { BuildConfigInternal } from '../../../models/index.js';
import { LogLevelString, Logger } from '../../../utils/index.js';

export interface ProjectBuildInfoWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
    currentProjectNumber: number;
    totalProjectCount: number;
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
        const newLine = this.options.currentProjectNumber > 1 ? '\n' : '';
        this.logger.info(
            `${newLine}Running build #[${this.options.currentProjectNumber}/${
                this.options.totalProjectCount
            }] - ${chalk.cyan(this.options.buildConfig._projectName)}`
        );
    }
}
