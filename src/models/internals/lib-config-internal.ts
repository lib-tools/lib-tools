import { LibConfig } from '../lib-config';

import { ProjectConfigInternal } from './project-config-internal';

export interface LibConfigInternal extends LibConfig {
    _configPath: string;
    projects: {
        [key: string]: ProjectConfigInternal;
    };
}
