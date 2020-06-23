import * as path from 'path';

import { InvalidConfigError } from '../models/errors';
import { LibProjectConfigInternal } from '../models/internals';
import { isInFolder, isSamePaths } from '../utils';

export function validateOutputPath(workspaceRoot: string, projectConfig: LibProjectConfigInternal): void {
    if (!projectConfig.outputPath) {
        throw new InvalidConfigError(
            `The 'projects[${projectConfig.name || projectConfig._index}].outputPath' is required.`
        );
    }

    if (path.isAbsolute(projectConfig.outputPath)) {
        throw new InvalidConfigError(
            `The 'projects[${projectConfig.name || projectConfig._index}].outputPath' must be relative path.`
        );
    }

    const projectRoot = path.resolve(workspaceRoot, projectConfig.root || '');

    const outputPath = path.resolve(workspaceRoot, projectConfig.outputPath);

    if (isSamePaths(workspaceRoot, outputPath)) {
        throw new InvalidConfigError(
            `The 'projects[${
                projectConfig.name || projectConfig._index
            }].outputPath' must not be the same as workspace root directory.`
        );
    }
    if (isSamePaths(projectRoot, outputPath) || outputPath === '.') {
        throw new InvalidConfigError(
            `The 'projects[${
                projectConfig.name || projectConfig._index
            }].outputPath' must not be the same as project root directory.`
        );
    }
    if (outputPath === path.parse(outputPath).root) {
        throw new InvalidConfigError(
            `The 'projects[${
                projectConfig.name || projectConfig._index
            }].outputPath' must not be the same as system root directory.`
        );
    }

    const srcDirHomeRoot = path.parse(projectRoot).root;
    if (outputPath === srcDirHomeRoot) {
        throw new InvalidConfigError(
            `The 'projects[${
                projectConfig.name || projectConfig._index
            }].outputPath' must not be the same as system root directory.`
        );
    }
    if (isInFolder(outputPath, workspaceRoot)) {
        throw new InvalidConfigError(
            `The workspace folder must not be inside 'projects[${
                projectConfig.name || projectConfig._index
            }].outputPath' directory.`
        );
    }
    if (isInFolder(outputPath, projectRoot)) {
        throw new InvalidConfigError(
            `The project root folder must not be inside 'projects[${
                projectConfig.name || projectConfig._index
            }].outputPath' directory.`
        );
    }
}
