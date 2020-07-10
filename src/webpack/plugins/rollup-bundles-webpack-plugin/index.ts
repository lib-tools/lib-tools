import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { performRollupBundles } from './rollup-bundles';

export interface RollupBundlesWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class RollupBundlesWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'rollup-bundles-webpack-plugin';
    }

    constructor(private readonly options: RollupBundlesWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            performRollupBundles(this.options.buildAction, this.logger)
        );
    }
}
