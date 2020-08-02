import { TestConfigInternal } from '../../../models';
import { LogLevelString, Logger } from '../../../utils';

let counter = 0;

export interface TestInfoWebpackPluginOptions {
    testConfig: TestConfigInternal;
    logLevel?: LogLevelString;
}

export class TestInfoWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'test-info-webpack-plugin';
    }

    constructor(private readonly options: TestInfoWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(): void {
        if (counter > 0) {
            this.logger.info('\n');
        }
        ++counter;
        const msg = `Running test for project ${this.options.testConfig._projectName}`;
        this.logger.info(msg);
    }
}
