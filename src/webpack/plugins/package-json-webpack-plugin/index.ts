import * as webpack from 'webpack';

import { ProjectConfigBuildInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { copyPackageJsonFile } from './copy-package-json-file';

export interface PackageJsonFileWebpackPluginOptions {
    projectConfig: ProjectConfigBuildInternal;
    logLevel?: LogLevelString;
}

export class PackageJsonFileWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'package-json-webpack-plugin';
    }

    constructor(private readonly options: PackageJsonFileWebpackPluginOptions) {
        this.logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            copyPackageJsonFile(this.options.projectConfig, this.logger)
        );
    }
}
