import { BuildOptions, ShortcutBuildOptions } from '../build-options';

export interface BuildOptionsInternal extends BuildOptions {
    environment: { [key: string]: boolean | string };
}

export interface BuildCommandOptions extends BuildOptions, ShortcutBuildOptions {
    config?: string;

    _startTime?: number;
    _fromBuiltInCli?: boolean;
    _cliIsGlobal?: boolean;
    _cliIsLink?: boolean;
    _cliRootPath?: string;
    _cliVersion?: string;
}
