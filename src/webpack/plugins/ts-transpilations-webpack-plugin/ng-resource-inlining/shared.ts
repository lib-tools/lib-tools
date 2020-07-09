/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';

import { pathExists } from 'fs-extra';

export interface TemplateUrlInfo {
    url: string;
    start: number;
    end: number;
    resourceId: string;
}

export interface StyleUrlsInfo {
    urls: string[];
    start: number;
    end: number;
    resourceId: string;
}

export interface MagicStringInstance {
    overwrite(start: number, end: number, content: string): void;
}

export interface MetaDataByKey {
    decorators?: {
        arguments?: { templateUrl?: string; template?: string; styleUrls?: string[]; styles?: string[] }[];
    }[];
}

export interface MetaDataJson {
    importAs?: string;
    origins?: { [key: string]: string };
    metadata?: { [key: string]: MetaDataByKey };
}

export async function findResourcePath(
    url: string,
    resourceId: string,
    srcDir: string,
    rootOutDir: string
): Promise<string> {
    const dir = path.parse(resourceId).dir;
    const relOutPath = path.relative(rootOutDir, dir);
    const filePath = path.resolve(srcDir, relOutPath, url);
    const filePathExists = await pathExists(filePath);
    if (filePathExists) {
        return filePath;
    } else if (/\.(s[ac]ss|css)$/i.test(filePath)) {
        const failbackExts = ['.css', '.scss', '.sass'];
        const curExt = path.parse(filePath).ext;
        for (const ext of failbackExts) {
            if (ext === curExt) {
                continue;
            }
            const tempNewFilePath = filePath.substr(0, filePath.length - curExt.length) + ext;
            const tempNewFilePathExists = await pathExists(tempNewFilePath);

            if (tempNewFilePathExists) {
                return tempNewFilePath;
            }
        }
    }

    return filePath;
}
