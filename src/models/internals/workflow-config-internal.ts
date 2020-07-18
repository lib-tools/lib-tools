import { WorkflowConfig } from '../workflow-config';

import { ProjectConfigInternal } from './project-config-internal';

export interface WorkflowConfigInternal extends WorkflowConfig {
    projects: {
        [key: string]: ProjectConfigInternal;
    };
}
