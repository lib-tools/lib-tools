import { findUp } from '../utils';

export async function findTestTsconfigFile(projectRoot: string, workspaceRoot: string): Promise<string | null> {
    return findUp(
        ['tsconfig.test.json', 'tsconfig-test.json', 'tsconfig.spec.json', 'tsconfig-spec.json'],
        projectRoot,
        workspaceRoot
    );
}
