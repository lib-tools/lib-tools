import * as path from 'path';

import { InvalidConfigError } from '../models/errors';
import { isInFolder, isSamePaths } from '../utils';

export function validateOutputPath(
    workspaceRoot: string,
    projectRoot: string,
    outputPath: string,
    projectIndexName: string
): void {
    if (path.isAbsolute(outputPath)) {
        throw new InvalidConfigError(`The 'projects[${projectIndexName}].outputPath' must be relative path.`);
    }

    if (isSamePaths(workspaceRoot, outputPath)) {
        throw new InvalidConfigError(
            `The 'projects[${projectIndexName}].outputPath' must not be the same as workspace root directory.`
        );
    }

    if (isSamePaths(projectRoot, outputPath) || outputPath === '.') {
        throw new InvalidConfigError(
            `The 'projects[${projectIndexName}].outputPath' must not be the same as project root directory.`
        );
    }

    if (outputPath === path.parse(outputPath).root) {
        throw new InvalidConfigError(
            `The 'projects[${projectIndexName}].outputPath' must not be the same as system root directory.`
        );
    }

    const srcDirHomeRoot = path.parse(projectRoot).root;
    if (outputPath === srcDirHomeRoot) {
        throw new InvalidConfigError(
            `The 'projects[${projectIndexName}].outputPath' must not be the same as system root directory.`
        );
    }

    if (isInFolder(outputPath, workspaceRoot)) {
        throw new InvalidConfigError(
            `The workspace folder must not be inside 'projects[${projectIndexName}].outputPath' directory.`
        );
    }

    if (isInFolder(outputPath, projectRoot)) {
        throw new InvalidConfigError(
            `The project root folder must not be inside 'projects[${projectIndexName}].outputPath' directory.`
        );
    }
}
