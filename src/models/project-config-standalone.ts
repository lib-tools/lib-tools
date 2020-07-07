/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { ProjectConfig } from './project-config';

/**
 * Standalone project configuration.
 * @additionalProperties false
 */
export interface ProjectConfigStandalone extends ProjectConfig {
    /**
     * Link to schema.
     */
    $schema?: string;
}
