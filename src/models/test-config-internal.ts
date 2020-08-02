import { TestConfig } from './test-config';

import { PackageJsonLike } from './package-jon-like';

export interface TestConfigInternal extends TestConfig {
    _workspaceRoot: string;
    _config: 'auto' | string;
    _projectName: string;
    _projectRoot: string;
    _packageJson: PackageJsonLike | null;

    _entryFilePath?: string | null;
    _tsConfigPath?: string | null;
    _karmaConfigPath?: string | null;
    _codeCoverage?: boolean;
}
