import * as webpack from 'webpack';

import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { processStyles } from './process-styles';

export interface StyleBundleWebpackPluginOptions {
    projectBuildConfig: ProjectBuildConfigInternal;
    logLevel?: LogLevelString;
}

export class StyleBundleWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'styles-bundle-webpack-plugin';
    }

    constructor(private readonly options: StyleBundleWebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            processStyles(this.options.projectBuildConfig, this.logger)
        );
    }
}
