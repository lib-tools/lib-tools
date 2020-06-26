import { ProjectConfig } from '../project-config';

export interface ProjectConfigInternal extends ProjectConfig {
    _index: number;
    _configPath: string;
    _workspaceRoot: string;
}
