import * as path from 'path';
import { promisify } from 'util';

import { readFile, writeFile } from 'fs-extra';

import * as glob from 'glob';

import { LoggerBase } from '../../../utils';

const globPromise = promisify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;
const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'gi');

export async function replaceVersion(
    searchRootDir: string,
    projectVersion: string,
    searchPattern: string,
    logger: LoggerBase
): Promise<boolean> {
    let replaced = false;

    if (searchPattern.indexOf('*') < 0) {
        searchPattern = path.join(searchPattern, '**', '*');
    }

    let files = await globPromise(searchPattern, { cwd: searchRootDir, nodir: true, dot: true });
    files = files.filter((name) => /\.js$/i.test(name));

    for (const filePath of files) {
        let content = await readFile(filePath, 'utf-8');
        if (versionPlaceholderRegex.test(content)) {
            if (!replaced) {
                logger.debug('Updating version placeholder');
            }

            content = content.replace(versionPlaceholderRegex, projectVersion);
            await writeFile(filePath, content);

            replaced = true;
        }
    }

    return replaced;
}
