import * as webpack from 'webpack';

import { ProjectConfigBuildInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { performRollupBundles } from './rollup-bundles';

export interface RollupBundlesWebpackPluginebpackPluginOptions {
    projectConfig: ProjectConfigBuildInternal;
    logLevel?: LogLevelString;
}

export class RollupBundlesWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'rollup-bundles-webpack-plugin';
    }

    constructor(private readonly options: RollupBundlesWebpackPluginebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            performRollupBundles(this.options.projectConfig, this.logger)
        );
    }

    // private async performBuildTask(): Promise<void> {
    //     const projectConfig = this.options.projectConfig;

    //     // await preformTsTranspilations(projectConfig, this.logger);

    //     // if (projectConfig.styles) {
    //     //     await processStyles(projectConfig, logger);
    //     // }

    //     await performBundles(projectConfig, this.logger);
    //     // await copyPackageJsonFile(projectConfig, this.logger);
    // }
}
