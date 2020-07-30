import { findUp } from '../utils';

export async function findTsconfigTestFile(workspaceRoot: string, projectRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig.test.json', 'tsconfig-test.json', 'tsconfig.spec.json', 'tsconfig-spec.json'],
        projectRoot,
        workspaceRoot
    );
}
