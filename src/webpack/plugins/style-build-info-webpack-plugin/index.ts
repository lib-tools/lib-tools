import { Compiler } from 'webpack';

import { LogLevelString, Logger } from '../../../utils/index.js';

export interface StyleBuildInfoWebpackPluginOptions {
    styleEntryName: string;
    logLevel?: LogLevelString;
}

export class StyleBuildInfoWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'style-build-info-webpack-plugin';
    }

    constructor(private readonly options: StyleBuildInfoWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: Compiler): void {
        compiler.hooks.beforeRun.tapAsync(this.name, (_, cb: (err?: Error) => void) => {
            this.logger.info(`Processing styles ${this.options.styleEntryName}`);
            cb();
        });
    }
}
