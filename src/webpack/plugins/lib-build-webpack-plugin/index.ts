import * as webpack from 'webpack';

import { BuildOptionsInternal, ProjectConfigBuildInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { copyPackageJsonFile, performBundles, preformTsTranspilations } from '../../../helpers';

// import { processStyles } from './process-styles';

export interface LibBuildWebpackPluginOptions {
    projectConfig: ProjectConfigBuildInternal;
    buildOptions: BuildOptionsInternal;
    logLevel?: LogLevelString;
}

export class LibBuildWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'lib-build-webpack-plugin';
    }

    constructor(private readonly options: LibBuildWebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => {
            return this.performBuildTask();
        });
    }

    private async performBuildTask(): Promise<void> {
        const projectConfig = this.options.projectConfig;

        await preformTsTranspilations(projectConfig, this.logger);

        // if (projectConfig.styles) {
        //     await processStyles(projectConfig, logger);
        // }

        await performBundles(projectConfig, this.logger);
        await copyPackageJsonFile(projectConfig, this.logger);
    }
}
