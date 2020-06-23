import * as path from 'path';

import { pathExists } from 'fs-extra';

import { GlobalEntry } from '../models';
import { GlobalScriptStyleParsedEntry } from '../models/internals';

export async function parseScriptStyleEntries(
    extraEntries: string | (string | GlobalEntry)[],
    defaultEntry: string,
    workspaceRoot: string,
    nodeModulesPath: string | null | undefined,
    projectRoot: string
): Promise<GlobalScriptStyleParsedEntry[]> {
    if (!extraEntries || !extraEntries.length) {
        return [];
    }

    const entries = Array.isArray(extraEntries) ? extraEntries : [extraEntries];
    const clonedEntries = entries.map((entry) => (typeof entry === 'object' ? { ...entry } : entry));

    const mappedEntries = clonedEntries.map((extraEntry: string | GlobalEntry) =>
        typeof extraEntry === 'object' ? extraEntry : { input: extraEntry }
    );

    const parsedEntries: GlobalScriptStyleParsedEntry[] = [];

    for (const extraEntry of mappedEntries) {
        const parsedEntry: GlobalScriptStyleParsedEntry = {
            paths: [],
            entry: '',
            lazy: extraEntry.lazy
        };

        const inputs = Array.isArray(extraEntry.input) ? extraEntry.input : [extraEntry.input];
        parsedEntry.paths = [];
        for (const input of inputs) {
            let resolvedPath = path.resolve(projectRoot, input);

            if (
                nodeModulesPath &&
                !(await pathExists(resolvedPath)) &&
                input.startsWith('~node_modules') &&
                (await pathExists(path.resolve(workspaceRoot, input.substr(1))))
            ) {
                resolvedPath = path.resolve(workspaceRoot, input.substr(1));
            } else if (
                nodeModulesPath &&
                !(await pathExists(resolvedPath)) &&
                input.startsWith('~') &&
                (await pathExists(path.resolve(nodeModulesPath, input.substr(1))))
            ) {
                resolvedPath = path.resolve(nodeModulesPath, input.substr(1));
            } else if (
                !(await pathExists(resolvedPath)) &&
                input.startsWith('~') &&
                (await pathExists(path.resolve(workspaceRoot, input.substr(1))))
            ) {
                resolvedPath = path.resolve(workspaceRoot, input.substr(1));
            }

            parsedEntry.paths.push(resolvedPath);
        }

        if (extraEntry.bundleName) {
            if (
                /(\\|\/)$/.test(extraEntry.bundleName) &&
                !Array.isArray(extraEntry.input) &&
                typeof extraEntry.input === 'string'
            ) {
                parsedEntry.entry =
                    extraEntry.bundleName +
                    path.basename(extraEntry.input).replace(/\.(ts|js|less|sass|scss|styl|css)$/i, '');
            } else {
                parsedEntry.entry = extraEntry.bundleName.replace(/\.(js|css)$/i, '');
            }
        } else if (extraEntry.lazy && !Array.isArray(extraEntry.input) && typeof extraEntry.input === 'string') {
            parsedEntry.entry = path.basename(extraEntry.input).replace(/\.(js|ts|css|scss|sass|less|styl)$/i, '');
        } else {
            parsedEntry.entry = defaultEntry;
        }

        parsedEntries.push(parsedEntry);
    }

    return parsedEntries;
}
