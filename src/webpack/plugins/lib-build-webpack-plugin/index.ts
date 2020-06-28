import * as webpack from 'webpack';

import { BuildOptionsInternal, ProjectConfigBuildInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

import { copyPackageJsonFile, performBundles, preformTsTranspilations } from '../../../helpers';

// import { processStyles } from './process-styles';

export interface LibBuildWebpackPluginOptions {
    projectConfig: ProjectConfigBuildInternal;
    buildOptions: BuildOptionsInternal;
    logger: LoggerBase;
}

export class LibBuildWebpackPlugin {
    get name(): string {
        return 'lib-build-webpack-plugin';
    }

    constructor(private readonly options: LibBuildWebpackPluginOptions) {}

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => {
            return this.performBuildTask();
        });
    }

    private async performBuildTask(): Promise<void> {
        const projectConfig = this.options.projectConfig;
        const logger = this.options.logger;

        await preformTsTranspilations(projectConfig, logger);

        // if (projectConfig.styles) {
        //     await processStyles(projectConfig, logger);
        // }

        await performBundles(projectConfig, logger);
        await copyPackageJsonFile(projectConfig, logger);
    }
}
