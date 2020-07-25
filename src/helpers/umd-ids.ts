import { dashCaseToCamelCase } from './dash-case-to-camel-case';

const predefinedUmdIds: { [key: string]: string } = {
    moment: 'moment',
    tslib: 'tslib',
    rxjs: 'rxjs',
    firebase: 'firebase'
};

export function getUmdGlobalVariable(moduleId: string, umdIds: { [key: string]: string } = {}): string {
    let foundName = umdIds[moduleId];
    if (foundName) {
        return foundName;
    }

    foundName = predefinedUmdIds[moduleId];
    if (foundName) {
        return foundName;
    }

    if (/\/?@angular\/.+/.test(moduleId)) {
        const normalizedValue = moduleId.replace(/@angular\//, 'ng.').replace(/\//g, '.');
        return dashCaseToCamelCase(normalizedValue);
    }

    if (/\/?rxjs\/.+/.test(moduleId)) {
        const normalizedValue = moduleId.replace(/\//g, '.');
        return dashCaseToCamelCase(normalizedValue);
    }

    if (/\/?firebase\/.+/.test(moduleId)) {
        const normalizedValue = moduleId.replace(/\//g, '.');
        return dashCaseToCamelCase(normalizedValue);
    }

    return '';
}

export function addPredefinedUmdIds(umdIds: { [key: string]: string }): void {
    const keys = Object.keys(umdIds);
    for (const key of keys) {
        predefinedUmdIds[key] = umdIds[key];
    }
}
