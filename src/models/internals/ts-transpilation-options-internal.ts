import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { TsTranspilationOptions } from '../project-config';

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _index: number;
    _tsConfigPath: string;
    _tsConfigJson: { [key: string]: unknown };
    _tsCompilerConfig: ParsedCommandLine;
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;

    _detectedEntryName?: string;
    _typingsOutDir?: string;
    _customTsOutDir?: string;
}
