import * as path from 'path';

import * as webpack from 'webpack';

import { runWebpack } from '../../helpers';
import { LogLevelString, Logger } from '../../utils';

import { getWebpackBuildConfig } from '../../webpack/configs';

export async function cliBuild(argv: { [key: string]: unknown }): Promise<number> {
    const startTime = global.libCli && global.libCli.startTime > 0 ? global.libCli.startTime : Date.now();
    const commandArgv = { ...argv };
    let environment: string | { [key: string]: boolean | string } | undefined;

    if (commandArgv.environment) {
        environment = commandArgv.environment as { [key: string]: boolean | string } | string;
        delete commandArgv.environment;
    }

    if (commandArgv.env) {
        if (!environment) {
            environment = commandArgv.env as { [key: string]: boolean | string } | string;
        }

        delete commandArgv.env;
    }

    const logger = new Logger({
        logLevel:
            commandArgv.logLevel && typeof commandArgv.logLevel === 'string'
                ? (commandArgv.logLevel as LogLevelString)
                : 'info',
        debugPrefix: 'DEBUG:',
        warnPrefix: 'WARNING:'
    });

    let configPath = '';
    if (commandArgv.config && typeof commandArgv.config === 'string') {
        configPath = path.isAbsolute(commandArgv.config)
            ? path.resolve(commandArgv.config)
            : path.resolve(process.cwd(), commandArgv.config);
    } else {
        configPath = path.resolve(process.cwd(), 'lib.json');
    }

    const watch = commandArgv.watch ? true : false;
    let webpackConfigs: webpack.Configuration[] = [];

    try {
        webpackConfigs = await getWebpackBuildConfig(configPath, environment, commandArgv);
    } catch (err) {
        logger.error(`${err.message || err}\n`);

        return -1;
    }

    if (webpackConfigs.length === 0) {
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

    if (commandArgv.beep && process.stdout.isTTY) {
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
