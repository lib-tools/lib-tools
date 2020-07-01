import * as webpack from 'webpack';

import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { performRollupBundles } from './rollup-bundles';

export interface RollupBundlesWebpackPluginebpackPluginOptions {
    projectBuildConfig: ProjectBuildConfigInternal;
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
            performRollupBundles(this.options.projectBuildConfig, this.logger)
        );
    }

    // private async performBuildTask(): Promise<void> {
    //     const projectBuildConfig = this.options.projectBuildConfig;

    //     // await preformTsTranspilations(projectBuildConfig, this.logger);

    //     // if (projectBuildConfig.styles) {
    //     //     await processStyles(projectBuildConfig, logger);
    //     // }

    //     await performBundles(projectBuildConfig, this.logger);
    //     // await copyPackageJsonFile(projectBuildConfig, this.logger);
    // }
}
