/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { BuildAction } from './build-action';

/**
 * The project configuration.
 * @additionalProperties false
 */
export interface ProjectConfig {
    /**
     * Path to base configuration file or name of the base project to inherit from.
     */
    extends?: string;

    /**
     * Root folder of the project files.
     */
    root?: string;

    /**
     * Set true for skipping actions.
     */
    skip?: boolean;

    /**
     * The action configurations.
     */
    actions?: {
        build?: BuildAction;
    };
}
