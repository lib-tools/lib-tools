import { Compiler } from 'webpack';

export class FailureKarmaWebpackPlugin {
    constructor(private callback: (error: string | undefined, errors: string[]) => void) {}

    apply(compiler: Compiler): void {
        compiler.hooks.done.tap('failure-karma-webpack-plugin', (stats) => {
            if (stats.compilation.errors.length > 0) {
                this.callback(
                    undefined,
                    stats.compilation.errors.map((error: Error) => (error.message ? error.message : error.toString()))
                );
            }
        });
    }
}
