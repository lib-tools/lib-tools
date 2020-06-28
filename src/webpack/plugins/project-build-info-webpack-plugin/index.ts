import * as webpack from 'webpack';

import { BuildOptionsInternal, ProjectConfigBuildInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

export interface ProjectBuildInfoWebpackPluginOptions {
    projectConfig: ProjectConfigBuildInternal;
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

    apply(compiler: webpack.Compiler): void {
        let configName: string;

        if (this.options.projectConfig.name) {
            configName = this.options.projectConfig.name;
        } else if (compiler.options.name) {
            configName = compiler.options.name;
        } else {
            configName = this.options.projectConfig._packageNameWithoutScope;
        }

        let msg = `Processing ${configName}`;
        const envStr = Object.keys(this.options.buildOptions.environment).length
            ? JSON.stringify(this.options.buildOptions.environment)
            : '';
        if (envStr) {
            msg += `env: ${envStr}`;
        }

        this.logger.info(msg);
    }
}
