import * as webpack from 'webpack';

import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { preformTsTranspilations } from './ts-transpilations';

export interface TsTranspilationsWebpackPluginOptions {
    projectConfig: ProjectBuildConfigInternal;
    logLevel?: LogLevelString;
}

export class TsTranspilationsWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'ts-transpilations-webpack-plugin';
    }

    constructor(private readonly options: TsTranspilationsWebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            preformTsTranspilations(this.options.projectConfig, this.logger)
        );
    }
}
