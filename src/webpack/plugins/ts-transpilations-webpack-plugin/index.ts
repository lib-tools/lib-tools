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

import { preformTsTranspilations } from './ts-transpilations';

export interface TsTranspilationsWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class TsTranspilationsWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'ts-transpilations-webpack-plugin';
    }

    constructor(private readonly options: TsTranspilationsWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            debugPrefix: `[${this.name}]`,
            infoPrefix: ''
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () =>
            preformTsTranspilations(this.options.buildAction, this.logger)
        );
    }
}
