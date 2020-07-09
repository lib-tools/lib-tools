/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as webpack from 'webpack';

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

import { performRollupBundles } from './rollup-bundles';

export interface RollupBundlesWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class RollupBundlesWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'rollup-bundles-webpack-plugin';
    }

    constructor(private readonly options: RollupBundlesWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            debugPrefix: `[${this.name}]`,
            infoPrefix: ''
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            performRollupBundles(this.options.buildAction, this.logger)
        );
    }
}
