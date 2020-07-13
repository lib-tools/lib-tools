import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger, LoggerBase } from '../../../utils';

export interface ScriptCompilationsWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class ScriptCompilationsWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'script-compilations-webpack-plugin';
    }

    constructor(private readonly options: ScriptCompilationsWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            this.performScriptCompilations(this.options.buildAction, this.logger)
        );
    }

    private async performScriptCompilations(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
        if (!buildAction._script || !buildAction._script._compilations.length) {
            return;
        }

        const scriptCompilationsModule = await import('./script-compilations');
        await scriptCompilationsModule.performScriptCompilations(buildAction, logger);
    }
}
