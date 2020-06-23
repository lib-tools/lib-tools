import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { LibBundleOptions } from '../project-config';

export interface LibBundleOptionsInternal extends LibBundleOptions {
    _index: number;
    _entryFilePath: string;
    _outputFilePath: string;

    _tsConfigPath?: string;
    _tsConfigJson?: { [key: string]: unknown };
    _tsCompilerConfig?: ParsedCommandLine;

    _sourceScriptTarget?: ScriptTarget;
    _destScriptTarget?: ScriptTarget;
    _ecmaVersion?: number;
    _supportES2015?: boolean;

    _nodeResolveFields?: string[];
}
