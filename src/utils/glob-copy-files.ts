import * as fs from 'fs/promises';
import * as path from 'path';

import { glob } from 'glob';

export async function globCopyFiles(
    fromPath: string,
    pattern: string,
    toPath: string,
    forMove?: boolean
): Promise<void> {
    const files = await glob(pattern, { cwd: fromPath });
    for (const relFileName of files) {
        const sourceFilePath = path.join(fromPath, relFileName);
        const destFilePath = path.join(toPath, relFileName);

        if (forMove) {
            await fs.rename(sourceFilePath, destFilePath);
        } else {
            await fs.copyFile(sourceFilePath, destFilePath);
        }
    }
}
