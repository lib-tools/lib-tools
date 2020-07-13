import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger, LoggerBase } from '../../../utils';

export interface TsTranspilationsWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class TsTranspilationsWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'ts-transpilations-webpack-plugin';
    }

    constructor(private readonly options: TsTranspilationsWebpackPluginOptions) {
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
