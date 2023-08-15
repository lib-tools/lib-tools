import webpack from 'webpack';

import { BuildCommandOptions } from '../../models/index.js';
import { runWebpack } from '../../helpers/index.js';
import { Logger } from '../../utils/index.js';

import { getWebpackBuildConfig } from '../../webpack/configs/index.js';

export async function cliBuild(argv: BuildCommandOptions & { [key: string]: unknown }): Promise<number> {
    const startTime = Date.now();
    let env: { [key: string]: boolean | string } | undefined;

    if (argv.environment) {
        env = argv.environment as { [key: string]: boolean | string };
        delete argv.environment;
    }

    if (argv.env) {
        if (!env) {
            env = argv.env as { [key: string]: boolean | string };
        }

        delete argv.env;
    }

    const logLevel = argv.logLevel ? argv.logLevel : 'info';
    const logger = new Logger({
        logLevel
    });

    const watch = argv.watch ? true : false;
    let webpackConfigs: webpack.Configuration[] = [];

    try {
        webpackConfigs = await getWebpackBuildConfig(env, argv);
    } catch (err) {
        if (logLevel === 'debug') {
            throw err;
        }

        logger.error(`${(err as Error).message || err}\n`);

        return -1;
    }

    if (!webpackConfigs.length) {
        logger.error('No project is available to build.\n');

        return -1;
    }

    let hasError = false;

    try {
        if (watch) {
            await runWebpack(webpackConfigs, watch, logger);
        } else {
            for (const wpConfig of webpackConfigs) {
                await runWebpack(wpConfig, false, logger);
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`\nBuild all completed in [${duration}ms]\n`);
    } catch (err) {
        hasError = true;
        if (err) {
            logger.error(`${toErrorString(err as Error)}\n`);
        }
    }

    if (argv.beep && process.stdout.isTTY) {
        process.stdout.write('\x07');
    }

    return hasError ? -1 : 0;
}

function toErrorString(err: Error & { details?: string }): string {
    let errMsg = '\n';
    if (err.message && err.message.length && err.message !== err.stack) {
        errMsg += err.message;
    }

    if (err.details && err.details.length && err.details !== err.stack && err.details !== err.message) {
        if (errMsg.trim()) {
            errMsg += '\nError Details:\n';
        }
        errMsg += err.details;
    } else if (err.stack && err.stack.length && err.stack !== err.message) {
        if (errMsg.trim()) {
            errMsg += '\nCall Stack:\n';
        }
        errMsg += err.stack;
    }

    return errMsg;
}
