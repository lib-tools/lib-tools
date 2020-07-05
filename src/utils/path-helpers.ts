/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

function removeEndingSlash(p: string): string {
    if (!p) {
        return '';
    }

    return p.replace(/(\/|\\)+$/, '');
}

export function normalizeRelativePath(p: string): string {
    if (!p) {
        return '';
    }
    p = p
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/(\/|\\)+$/, '');
    if (p === '.' || p === './') {
        return '';
    }

    return p;
}

export function isSamePaths(p1: string, p2: string): boolean {
    if (p1 === p2) {
        return true;
    }

    p1 = removeEndingSlash(path.normalize(p1));
    p2 = removeEndingSlash(path.normalize(p2));

    return p1 === p2;
}

export function isInFolder(parentDir: string, checkDir: string): boolean {
    parentDir = removeEndingSlash(path.normalize(parentDir));
    checkDir = removeEndingSlash(path.normalize(checkDir));

    if (!checkDir || parentDir === checkDir) {
        return false;
    }

    const checkDirHome = path.parse(checkDir).root;
    if (
        checkDir === checkDirHome ||
        checkDir === removeEndingSlash(checkDirHome) ||
        checkDir === '.' ||
        checkDir === './'
    ) {
        return false;
    }

    let tempCheckDir = checkDir;
    let prevTempCheckDir = '';
    while (tempCheckDir && tempCheckDir !== checkDirHome && tempCheckDir !== '.' && tempCheckDir !== prevTempCheckDir) {
        prevTempCheckDir = tempCheckDir;
        tempCheckDir = path.dirname(tempCheckDir);
        if (tempCheckDir === parentDir || removeEndingSlash(tempCheckDir) === parentDir) {
            return true;
        }
    }

    return false;
}
