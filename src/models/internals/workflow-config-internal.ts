import { WorkflowConfig } from '../workflow-config';

import { ProjectConfigInternal } from './project-config-internal';

export interface WorkflowConfigInternal extends WorkflowConfig {
    _workspaceRoot: string;
    _auto: boolean;
    _configPath: string | null;
    projects: {
        [key: string]: ProjectConfigInternal;
    };
}
