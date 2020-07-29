import { TestConfig } from './test-config';

export interface TestConfigInternal extends TestConfig {
    _workspaceRoot: string;
    _config: 'auto' | string;
    _projectName: string;
    _projectRoot: string;
}
