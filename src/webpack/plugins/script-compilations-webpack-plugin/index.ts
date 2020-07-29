import * as webpack from 'webpack';

import { BuildConfigInternal } from '../../../models';
import { LogLevelString, Logger, LoggerBase } from '../../../utils';

import { performScriptCompilations } from './script-compilations';

export interface ScriptCompilationsWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
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
            this.performCompilations(this.options.buildConfig, this.logger)
        );
    }

    private async performCompilations(buildConfig: BuildConfigInternal, logger: LoggerBase): Promise<void> {
        if (!buildConfig._script || !buildConfig._script._compilations.length) {
            return;
        }

        await performScriptCompilations(buildConfig, logger);
    }
}
