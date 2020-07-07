/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { ProjectConfig } from '../project-config';

export interface ProjectConfigInternal extends ProjectConfig {
    _configPath: string | null;
    _workspaceRoot: string;
    _projectRoot: string;
    _projectName: string;
}
