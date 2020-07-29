import * as webpack from 'webpack';

import { BuildConfigInternal } from '../../../models';
import { LogLevelString, Logger } from '../../../utils';

export interface StylesWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
    logLevel?: LogLevelString;
}

export class StylesWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'styles-webpack-plugin';
    }

    constructor(private readonly options: StylesWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => {
            await this.processStyles();
        });
    }

    private async processStyles(): Promise<void> {
        const buildConfig = this.options.buildConfig;

        if (!buildConfig._styleEntries || !buildConfig._styleEntries.length) {
            return;
        }

        const stylesModule = await import('./process-styles');
        await stylesModule.processStyles(buildConfig, this.logger);
    }
}
