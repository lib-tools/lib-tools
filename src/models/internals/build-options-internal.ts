import { BuildOptions } from '../build-options';

export interface BuildOptionsInternal extends BuildOptions {
    environment: { [key: string]: boolean | string };
}
