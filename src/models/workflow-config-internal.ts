import { WorkflowConfig } from './workflow-config.js';

import { ProjectConfigInternal } from './project-config-internal.js';

export interface WorkflowConfigInternal extends WorkflowConfig {
    projects: {
        [key: string]: ProjectConfigInternal;
    };
}
