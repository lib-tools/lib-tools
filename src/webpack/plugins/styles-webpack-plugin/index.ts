import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

export interface StylesWebpackPluginOptions {
    buildAction: BuildActionInternal;
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
        const buildAction = this.options.buildAction;

        if (!buildAction._styleEntries || !buildAction._styleEntries.length) {
            return;
        }

        const processStylesModule = await import('./process-styles');
        await processStylesModule.processStyles(buildAction, this.logger);
    }
}
