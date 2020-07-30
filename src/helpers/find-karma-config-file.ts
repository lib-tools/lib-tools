import * as path from 'path';

import { findUp } from '../utils';

export function findKarmaConfigFile(projectRoot: string, workspaceRoot: string): Promise<string | null> {
    return findUp(
        ['karma.conf.ts', 'karma.conf.js', '.config/karma.conf.ts', '.config/karma.conf.js'],
        [path.resolve(projectRoot, 'test'), path.resolve(projectRoot, 'src')],
        workspaceRoot
    );
}
