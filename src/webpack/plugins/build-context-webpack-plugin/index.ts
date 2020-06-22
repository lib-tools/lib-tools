import * as webpack from 'webpack';

import { BuildOptionsInternal, LibProjectConfigInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

export interface BuildContextWebpackPluginOptions {
    projectConfig: LibProjectConfigInternal;
    buildOptions: BuildOptionsInternal;
    logger: LoggerBase;
}

export class BuildContextWebpackPlugin {
    get name(): string {
        return 'build-context-webpack-plugin';
    }

    constructor(private readonly options: BuildContextWebpackPluginOptions) {}

    apply(compiler: webpack.Compiler): void {
        let configName: string;

        if (this.options.projectConfig.name) {
            configName = this.options.projectConfig.name;
        } else if (compiler.options.name) {
            configName = compiler.options.name;
        } else if (this.options.projectConfig._index != null) {
            configName = `project[${this.options.projectConfig._index}]`;
        } else {
            configName = `project`;
        }

        const msg = '';
        this.options.logger.info(`Processing ${configName} for build`);
    }
}
