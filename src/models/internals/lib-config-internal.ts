import { LibConfig } from '../lib-config';

import { LibProjectConfigInternal } from './project-config-internal';

export interface LibConfigInternal extends LibConfig {
    projects: LibProjectConfigInternal[];
    _schema?: { [key: string]: unknown };
    _configPath: string;
}
