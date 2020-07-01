import { ProjectConfig } from '../project-config';

export interface ProjectConfigInternal extends ProjectConfig {
    _workspaceRoot: string;
    _configPath: string;
    _projectRoot: string;
    _projectName: string;
}
