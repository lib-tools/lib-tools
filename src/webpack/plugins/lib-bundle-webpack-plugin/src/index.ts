import * as webpack from 'webpack';

import { BuildOptionsInternal, ProjectConfigInternal } from '../../../../models/internals';
import { LoggerBase } from '../../../../utils';

import { performLibBundles } from './perform-lib-bundles';
import { performPackageJsonCopy } from './perform-package-json-copy';
import { performTsTranspile } from './perform-ts-transpile';

// import { processStyles } from './process-styles';

export interface LibBundleWebpackPluginOptions {
    projectConfig: ProjectConfigInternal;
    buildOptions: BuildOptionsInternal;
    logger: LoggerBase;
}

export class LibBundleWebpackPlugin {
    get name(): string {
        return 'lib-bundle-webpack-plugin';
    }

    constructor(private readonly options: LibBundleWebpackPluginOptions) {}

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => {
            return this.performBundleTask();
        });
    }

    private async performBundleTask(): Promise<void> {
        const projectConfig = this.options.projectConfig;
        const logger = this.options.logger;

        if (projectConfig.tsTranspilations) {
            await performTsTranspile(projectConfig, logger);
        }

        // if (projectConfig.styles) {
        //     await processStyles(projectConfig, logger);
        // }

        if (projectConfig.bundles) {
            await performLibBundles(projectConfig, logger);
        }

        if (projectConfig.packageJsonCopy) {
            await performPackageJsonCopy(projectConfig, logger);
        }
    }
}
