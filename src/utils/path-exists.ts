import * as fs from 'fs/promises';

export async function pathExists(path: string) {
    return fs
        .access(path)
        .then(() => true)
        .catch(() => false);
}
