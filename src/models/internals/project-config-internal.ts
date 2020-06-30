import { ProjectConfig } from '../project-config';

export interface ProjectConfigInternal extends ProjectConfig {
    _name: string;
    _configPath: string;
}
