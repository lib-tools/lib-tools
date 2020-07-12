import { ProjectConfig } from '../project-config';

export interface ProjectConfigInternal extends ProjectConfig {
    _auto: boolean;
    _configPath: string | null;
    _workspaceRoot: string;
    _projectRoot: string;
    _projectName: string;
}
