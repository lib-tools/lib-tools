import { BuildOptionsInternal, ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

export interface ProjectBuildInfoWebpackPluginOptions {
    projectConfig: ProjectBuildConfigInternal;
    buildOptions: BuildOptionsInternal;
    logLevel?: LogLevelString;
}

export class ProjectBuildInfoWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'project-build-info-webpack-plugin';
    }

    constructor(private readonly options: ProjectBuildInfoWebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(): void {
        let msg = `Processing ${this.options.projectConfig._name}`;
        const envStr = Object.keys(this.options.buildOptions.environment).length
            ? JSON.stringify(this.options.buildOptions.environment)
            : '';
        if (envStr) {
            msg += `env: ${envStr}`;
        }

        this.logger.info(msg);
    }
}
