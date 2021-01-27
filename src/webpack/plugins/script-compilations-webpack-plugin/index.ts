import * as webpack from 'webpack';

import { BuildConfigInternal } from '../../../models';
import { LogLevelString, Logger } from '../../../utils';

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
        compiler.hooks.emit.tapAsync(this.name, (_, cb: (err?: Error) => void) => {
            if (!this.options.buildConfig._script || !this.options.buildConfig._script._compilations.length) {
                cb();

                return;
            }

            performScriptCompilations(this.options.buildConfig, this.logger)
                .then(() => {
                    cb();

                    return;
                })
                .catch((err) => {
                    cb(err);

                    return;
                });
        });
    }
}
