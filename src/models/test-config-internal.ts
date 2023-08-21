import { TestConfig } from './test-config';

import { PackageJsonLike } from './package-jon-like';

export interface TestConfigInternal extends TestConfig {
    _workspaceRoot: string;
    _config: 'auto' | string;
    _projectName: string;
    _projectRoot: string;
    _packageJson: PackageJsonLike | null;
    _testIndexFilePath: string | null;
    _tsConfigPath: string | null;
    _karmaConfigPath: string | null;
}
