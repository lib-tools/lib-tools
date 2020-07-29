import * as http from 'http';

import { ConfigOptions as KarmaConfigOptions } from 'karma';
import * as webpack from 'webpack';
import * as webpackDevMiddleware from 'webpack-dev-middleware';

import { FailureKarmaWebpackPlugin } from '../webpack/plugins/failure-karma-webpack-plugin';
import { TurnOffWatchWebpackPlugin } from '../webpack/plugins/turn-off-watch-webpack-plugin';

import { LoggerBase } from '../utils';

export interface PluginOptions extends KarmaConfigOptions {
    webpackConfig: webpack.Configuration;
    codeCoverage?: boolean;
    logger: LoggerBase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NextHandleFunction = (req: any, res: http.ServerResponse, next: (err?: unknown) => void) => void;

let blocked: (() => void)[] = [];
let isBlocked = false;
let webpackMiddleware: webpackDevMiddleware.WebpackDevMiddleware & NextHandleFunction;

function requestBlocker() {
    return (_1: { url: string }, _2: http.ServerResponse, next: () => void) => {
        if (isBlocked) {
            blocked.push(next);
        } else {
            next();
        }
    };
}

function fallbackMiddleware() {
    return (req: { url: string }, res: http.ServerResponse, next: () => void) => {
        if (webpackMiddleware) {
            const webpackUrl = `/_karma_webpack_${req.url}`;
            const webpackReq = { ...req, url: webpackUrl };
            webpackMiddleware(webpackReq, res, next);
        } else {
            next();
        }
    };
}

const init = (
    config: PluginOptions,
    emitter: {
        on: (eventName: string, cb: (doneFn: () => void) => void) => void;
        emit: (eventName: string, messages: string[], options?: { exitCode: number }) => void;
        refreshFiles: () => void;
    },
    customFileHandlers: { urlRegex: RegExp; handler: NextHandleFunction }[]
) => {
    const logger = config.logger;

    config.reporters = config.reporters || [];
    if (config.codeCoverage && !config.reporters.includes('coverage-istanbul')) {
        config.reporters.push('coverage-istanbul');
    }

    const webpackConfig = config.webpackConfig;
    const webpackMiddlewareConfig: webpackDevMiddleware.Options = {
        logLevel: 'error',
        stats: {
            colors: config.colors
        },
        publicPath: '/_karma_webpack_/'
    };

    function unblock(): void {
        isBlocked = false;
        blocked.forEach((cb) => cb());
        blocked = [];
    }

    const compilationErrorCb = (_: string | undefined, errors: string[]) => {
        emitter.emit('compile_error', errors);
        emitter.emit('run_complete', [], { exitCode: 1 });
        unblock();
    };

    webpackConfig.plugins = webpackConfig.plugins || [];
    webpackConfig.plugins.push(new FailureKarmaWebpackPlugin(compilationErrorCb));

    config.customContextFile = `${__dirname}/karma-context.html`;
    config.customDebugFile = `${__dirname}/karma-debug.html`;

    config.beforeMiddleware = config.beforeMiddleware || [];
    config.beforeMiddleware.push('lib-tools--blocker');
    config.middleware = config.middleware || [];
    config.middleware.push('lib-tools--fallback');

    webpackConfig.watch = !config.singleRun;
    if (config.singleRun) {
        webpackConfig.plugins.unshift(new TurnOffWatchWebpackPlugin());
    }

    webpackConfig.output = webpackConfig.output || {};
    webpackConfig.output.path = '/_karma_webpack_/';
    webpackConfig.output.publicPath = '/_karma_webpack_/';

    let compiler: webpack.Compiler;
    try {
        compiler = webpack(webpackConfig);
    } catch (e) {
        logger.error((e as Error).stack || e);
        if ((e as { details: string }).details) {
            logger.error((e as { details: string }).details);
        }

        throw e;
    }

    function handler(callback?: () => void) {
        isBlocked = true;

        if (typeof callback === 'function') {
            callback();
        }
    }

    compiler.hooks.invalid.tap('karma', () => handler());
    compiler.hooks.watchRun.tapAsync('karma', (_, callback: () => void) => handler(callback));
    compiler.hooks.run.tapAsync('karma', (_, callback: () => void) => handler(callback));

    let lastCompilationHash: string | undefined;
    compiler.hooks.done.tap('karma', (stats) => {
        if (stats.compilation.errors.length > 0) {
            logger.error(stats.toString('errors-only'));
            lastCompilationHash = undefined;
        } else if (stats.hash !== lastCompilationHash) {
            lastCompilationHash = stats.hash;
            emitter.refreshFiles();
        }

        unblock();
    });

    webpackMiddleware = webpackDevMiddleware(compiler, webpackMiddlewareConfig);

    customFileHandlers.push({
        urlRegex: /^\/_karma_webpack_\/.*/,
        handler: (req: { url: string }, res: http.ServerResponse) => {
            webpackMiddleware(req, res, function () {
                const alwaysServe = [
                    '/_karma_webpack_/runtime.js',
                    '/_karma_webpack_/polyfills.js',
                    '/_karma_webpack_/vendor.js'
                ];
                if (alwaysServe.includes(req.url)) {
                    res.statusCode = 200;
                    res.end();
                } else {
                    res.statusCode = 404;
                    res.end('Not found');
                }
            });
        }
    });

    emitter.on('exit', (done) => {
        webpackMiddleware.close();
        done();
    });
};

init.$inject = ['config', 'emitter', 'customFileHandlers'];

module.exports = {
    'framework:lib-tools': ['factory', init],
    'middleware:lib-tools--blocker': ['factory', requestBlocker],
    'middleware:lib-tools--fallback': ['factory', fallbackMiddleware]
};
