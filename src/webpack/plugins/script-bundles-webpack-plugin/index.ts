import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

export interface ScriptBundlesWebpackPluginOptions {
    buildAction: BuildActionInternal;
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
        compiler.hooks.emit.tapPromise(this.name, async () => this.performScriptBundles());
    }

    async performScriptBundles(): Promise<void> {
        const buildAction = this.options.buildAction;

        if (!buildAction._script || !buildAction._script._bundles.length) {
            return;
        }

        const scriptBundlesModule = await import('./script-bundles');
        await scriptBundlesModule.performScriptBundles(buildAction, this.logger);
    }
}
