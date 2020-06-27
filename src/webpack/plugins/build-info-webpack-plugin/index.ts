import * as webpack from 'webpack';

import { BuildOptionsInternal, ProjectConfigInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

export interface BuildInfoWebpackPluginOptions {
    projectConfig: ProjectConfigInternal;
    buildOptions: BuildOptionsInternal;
    logger: LoggerBase;
}

export class BuildInfoWebpackPlugin {
    get name(): string {
        return 'build-info-webpack-plugin';
    }

    constructor(private readonly options: BuildInfoWebpackPluginOptions) {}

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
