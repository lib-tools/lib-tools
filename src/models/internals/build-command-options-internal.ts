import { BuildCommandOptions } from '../build-command-options';

export interface BuildCommandOptionsInternal extends BuildCommandOptions {
    environment: { [key: string]: boolean | string };
}
