/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

export interface ProjectBuildInfoWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class ProjectBuildInfoWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'project-build-info-webpack-plugin';
    }

    constructor(private readonly options: ProjectBuildInfoWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            infoPrefix: ''
        });
    }

    apply(): void {
        const msg = `Preparing project ${this.options.buildAction._projectName} for build`;
        this.logger.info(msg);
    }
}
