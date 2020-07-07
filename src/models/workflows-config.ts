/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { ProjectConfig } from './project-config';

/**
 * The main workflows configuration.
 * @additionalProperties true
 */
export interface WorkflowsConfig {
    /**
     * Link to schema.
     */
    $schema?: string;

    /**
     * The workflow configurations for projects.
     */
    projects: {
        [key: string]: ProjectConfig;
    };
}
