import { CleanOptions } from '../models';
import { LibProjectConfigInternal } from '../models/internals';

export function prepareCleanOptions(projectConfig: LibProjectConfigInternal): CleanOptions {
    let cleanOptions: CleanOptions = {};
    if (typeof projectConfig.clean === 'object') {
        cleanOptions = { ...cleanOptions, ...projectConfig.clean };
    }

    cleanOptions.beforeBuild = cleanOptions.beforeBuild || {};
    const beforeBuildOption = cleanOptions.beforeBuild;

    let skipCleanOutDir = false;

    if (projectConfig._isNestedPackage && beforeBuildOption.cleanOutDir) {
        skipCleanOutDir = true;
    }

    if (skipCleanOutDir) {
        beforeBuildOption.cleanOutDir = false;
    } else if (beforeBuildOption.cleanOutDir == null) {
        beforeBuildOption.cleanOutDir = true;
    }

    if (beforeBuildOption.cleanCache == null) {
        beforeBuildOption.cleanCache = true;
    }

    cleanOptions.beforeBuild = beforeBuildOption;

    return cleanOptions;
}
