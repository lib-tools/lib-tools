import * as path from 'path';

import { InvalidConfigError } from '../models/errors';
import { isInFolder, isSamePaths } from '../utils';

export function validateOutputPath(
    outputPath: string,
    workspaceRoot: string,
    projectRoot: string,
    configPath: string,
    configErrorLocation: string
): void {
    if (path.isAbsolute(outputPath)) {
        throw new InvalidConfigError(
            `The '${configErrorLocation}' must be relative path.`,
            configPath,
            configErrorLocation
        );
    }

    if (isSamePaths(workspaceRoot, outputPath)) {
        throw new InvalidConfigError(
            `The '${configErrorLocation}' must not be the same as workspace root directory.`,
            configPath,
            configErrorLocation
        );
    }

    if (isSamePaths(projectRoot, outputPath) || outputPath === '.') {
        throw new InvalidConfigError(
            `The '${configErrorLocation}' must not be the same as project root directory.`,
            configPath,
            configErrorLocation
        );
    }

    if (outputPath === path.parse(outputPath).root) {
        throw new InvalidConfigError(
            `The '${configErrorLocation}' must not be the same as system root directory.`,
            configPath,
            configErrorLocation
        );
    }

    const srcDirHomeRoot = path.parse(projectRoot).root;
    if (outputPath === srcDirHomeRoot) {
        throw new InvalidConfigError(
            `The '${configErrorLocation}' must not be the same as system root directory.`,
            configPath,
            configErrorLocation
        );
    }

    if (isInFolder(outputPath, workspaceRoot)) {
        throw new InvalidConfigError(
            `The workspace folder must not be inside '${configErrorLocation}' directory.`,
            configPath,
            configErrorLocation
        );
    }

    if (isInFolder(outputPath, projectRoot)) {
        throw new InvalidConfigError(
            `The project root folder must not be inside '${configErrorLocation}' directory.`,
            configPath,
            configErrorLocation
        );
    }
}
