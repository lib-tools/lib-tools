import * as webpack from 'webpack';

import { BuildConfigInternal } from '../../../models';
import { LogLevelString, Logger } from '../../../utils';

import { performScriptBundles } from './script-bundles';

export interface ScriptBundlesWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
    logLevel?: LogLevelString;
}

export class ScriptBundlesWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'script-bundles-webpack-plugin';
    }

    constructor(private readonly options: ScriptBundlesWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => this.performBundles());
    }

    private async performBundles(): Promise<void> {
        const buildConfig = this.options.buildConfig;

        if (!buildConfig._script || !buildConfig._script._bundles.length) {
            return;
        }

        await performScriptBundles(buildConfig, this.logger);
    }
}
