import { ProjectConfig } from './project-config.js';

export interface ProjectConfigInternal extends ProjectConfig {
    _config: 'auto' | string;
    _workspaceRoot: string;
    _projectRoot: string;
    _projectName: string;
}
