import * as webpack from 'webpack';

import { BuildOptionsInternal, ProjectConfigBuildInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

export interface ProjectBuildInfoWebpackPluginOptions {
    projectConfig: ProjectConfigBuildInternal;
    buildOptions: BuildOptionsInternal;
    logger: LoggerBase;
}

export class ProjectBuildInfoWebpackPlugin {
    get name(): string {
        return 'project-build-info-webpack-plugin';
    }

    constructor(private readonly options: ProjectBuildInfoWebpackPluginOptions) {}

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

        this.options.logger.info(msg);
    }
}
