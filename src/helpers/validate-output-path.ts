import * as path from 'path';

import { ProjectBuildConfigInternal } from '../models/internals';
import { isInFolder, isSamePaths } from '../utils';

export function validateOutputPath(projectConfig: ProjectBuildConfigInternal): void {
    const workspaceRoot = path.dirname(projectConfig._configPath);
    const projectRoot = projectConfig._projectRoot;
    const outputPath = projectConfig._outputPath;
    const configErrorLocation = `projects[${projectConfig._name}].outputPath`;

    if (path.isAbsolute(outputPath)) {
        throw new Error(`The '${configErrorLocation}' must be relative path.`);
    }

    if (isSamePaths(workspaceRoot, outputPath)) {
        throw new Error(`The '${configErrorLocation}' must not be the same as workspace root directory.`);
    }

    if (isSamePaths(projectRoot, outputPath) || outputPath === '.') {
        throw new Error(`The '${configErrorLocation}' must not be the same as project root directory.`);
    }

    if (outputPath === path.parse(outputPath).root) {
        throw new Error(`The '${configErrorLocation}' must not be the same as system root directory.`);
    }

    const srcDirHomeRoot = path.parse(projectRoot).root;
    if (outputPath === srcDirHomeRoot) {
        throw new Error(`The '${configErrorLocation}' must not be the same as system root directory.`);
    }

    if (isInFolder(outputPath, workspaceRoot)) {
        throw new Error(`The workspace folder must not be inside '${configErrorLocation}' directory.`);
    }

    if (isInFolder(outputPath, projectRoot)) {
        throw new Error(`The project root folder must not be inside '${configErrorLocation}' directory.`);
    }
}
