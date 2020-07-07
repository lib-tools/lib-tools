/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

export interface PackageJsonLike {
    [key: string]: string | boolean | { [key: string]: string | undefined } | string[] | undefined;
    name: string;
    version?: string;
    author?: string | { [key: string]: string };
    keywords?: string[];
    license?: string;
    homepage?: string;
    repository?: string | { [key: string]: string };
    bugs?: string | { [key: string]: string };
    main?: string;
    module?: string;
    es2015?: string;
    esm5?: string;
    fesm2015?: string;
    fesm5?: string;
    typings?: string;
    browser?: string;
    sass?: string;
    style?: string;
    sideEffects?: string[] | boolean;
    files?: string[];
    scripts?: { [key: string]: string };
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
    peerDependencies?: { [key: string]: string };
}
