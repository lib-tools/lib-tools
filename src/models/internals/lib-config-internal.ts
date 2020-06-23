import { LibConfig } from '../lib-config';

import { ProjectConfigInternal } from './project-config-internal';

export interface LibConfigInternal extends LibConfig {
    projects: ProjectConfigInternal[];
    _configPath: string;
}
