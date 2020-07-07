/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

/**
 * @additionalProperties true
 */
export interface BuildOptions {
    /**
     * Detect project structure and build without configuration file.
     */
    auto?: boolean;
    /**
     * The workflows configuration file path.
     */
    config?: string;
    /**
     * Define the build environment.
     */
    environment?: { [key: string]: boolean | string };
    /**
     * Filter projects by name(s) for build processing.
     */
    filter?: string | string[];
    /**
     * Logging level for output debugging.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'none';
    /**
     * Build with watch mode.
     */
    watch?: boolean;
    /**
     * Beep when build completed.
     */
    beep?: boolean;
    /**
     * Set version to override versions of the project packages.
     */
    version?: string;
}
