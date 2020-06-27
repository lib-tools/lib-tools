import { CleanOptions } from '../models';
import { ProjectConfigBuildInternal } from '../models/internals';

export function prepareCleanOptions(projectConfig: ProjectConfigBuildInternal): CleanOptions {
    let cleanOptions: CleanOptions = {};
    if (typeof projectConfig.clean === 'object') {
        cleanOptions = { ...cleanOptions, ...projectConfig.clean };
    }

    cleanOptions.beforeBuild = cleanOptions.beforeBuild || {};
    const beforeBuildOption = cleanOptions.beforeBuild;

    let skipCleanOutDir = false;

    if (projectConfig._nestedPackage && beforeBuildOption.cleanOutDir) {
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
