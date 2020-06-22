import * as webpack from 'webpack';

import { LibProjectConfigInternal } from '../../../../models/internals';
import { LoggerBase } from '../../../../utils';

import { performLibBundles } from './perform-lib-bundles';
import { performPackageJsonCopy } from './perform-package-json-copy';
import { performTsTranspile } from './perform-ts-transpile';

// import { processStyles } from './process-styles';

export interface LibBundleWebpackPluginOptions {
    libConfig: LibProjectConfigInternal;
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
        const libConfig = this.options.libConfig;
        const logger = this.options.logger;

        if (libConfig.tsTranspilations) {
            await performTsTranspile(libConfig, logger);
        }

        // if (libConfig.styles) {
        //     await processStyles(libConfig, logger);
        // }

        if (libConfig.bundles) {
            await performLibBundles(libConfig, logger);
        }

        if (libConfig.packageJsonCopy) {
            await performPackageJsonCopy(libConfig, logger);
        }
    }
}
