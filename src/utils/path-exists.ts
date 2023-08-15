import * as fs from 'fs/promises';

export async function pathExists(path: string) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}
