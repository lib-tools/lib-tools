import { TestConfigInternal } from '../../../models';
import { LogLevelString, Logger, colorize } from '../../../utils';

if (!global.testCounter) {
    global.testCounter = { count: 0 };
}

const testCounter = global.testCounter || { count: 0 };

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
        if (testCounter.count > 0) {
            this.logger.info('\n');
        }
        ++testCounter.count;
        const msg = `Running test for ${colorize(this.options.testConfig._projectName, 'cyan')}`;
        this.logger.info(msg);
    }
}
