import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger, LoggerBase } from '../../../utils';

import { performScriptCompilations } from './script-compilations';

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
            this.performCompilations(this.options.buildAction, this.logger)
        );
    }

    private async performCompilations(buildAction: BuildActionInternal, logger: LoggerBase): Promise<void> {
        if (!buildAction._script || !buildAction._script._compilations.length) {
            return;
        }

        await performScriptCompilations(buildAction, logger);
    }
}
