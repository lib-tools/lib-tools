import { Compiler } from 'webpack';

export class TurnOffWatchWebpackPlugin {
    apply(compiler: Compiler): void {
        // tslint:disable-line:no-any
        compiler.hooks.afterEnvironment.tap('karma', () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            (compiler as any).watchFileSystem = {
                watch: () => {
                    // Do nothing
                }
            };
        });
    }
}
