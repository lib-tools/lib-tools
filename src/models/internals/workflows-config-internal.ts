import { WorkflowsConfig } from '../workflows-config';

import { ProjectConfigInternal } from './project-config-internal';

export interface WorkflowsConfigInternal extends WorkflowsConfig {
    _configPath: string | null;
    _workspaceRoot: string;
    projects: {
        [key: string]: ProjectConfigInternal;
    };
}
