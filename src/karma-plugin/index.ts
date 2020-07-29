import * as http from 'http';

import { ConfigOptions as KarmaConfigOptions } from 'karma';
import * as webpack from 'webpack';
import * as webpackDevMiddleware from 'webpack-dev-middleware';

import { FailureKarmaWebpackPlugin } from '../webpack/plugins/failure-karma-webpack-plugin';
import { TurnOffWatchWebpackPlugin } from '../webpack/plugins/turn-off-watch-webpack-plugin';

import { LoggerBase } from '../utils';

export interface PluginOptions extends KarmaConfigOptions {
    webpackConfig: webpack.Configuration;
    webpack?: webpack.Configuration;
    webpackMiddleware?: webpackDevMiddleware.Options;
    codeCoverage?: boolean;
    logger: LoggerBase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NextHandleFunction = (req: any, res: http.ServerResponse, next: (err?: unknown) => void) => void;

let blocked: (() => void)[] = [];
let isBlocked = false;
let webpackMiddleware: webpackDevMiddleware.WebpackDevMiddleware & NextHandleFunction;
// let successCb: () => void;
// let failureCb: () => void;

// Block requests until the Webpack compilation is done.
function requestBlocker() {
    return (_1: { url: string }, _2: http.ServerResponse, next: () => void) => {
        if (isBlocked) {
            blocked.push(next);
        } else {
            next();
        }
    };
}

// When a request is not found in the karma server, try looking for it from the webpack server root.
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
        // Hide webpack output because its noisy.
        // logLevel: 'error',
        stats: {
            colors: config.colors
        },
        // watchOptions: { poll: config.poll },
        publicPath: '/_karma_webpack_/'
    };

    function unblock(): void {
        isBlocked = false;
        blocked.forEach((cb) => cb());
        blocked = [];
    }

    const compilationErrorCb = (_: string | undefined, errors: string[]) => {
        // Notify potential listeners of the compile error
        emitter.emit('compile_error', errors);

        // Finish Karma run early in case of compilation error.
        emitter.emit('run_complete', [], { exitCode: 1 });

        // Unblock any karma requests (potentially started using `karma run`)
        unblock();
    };

    webpackConfig.plugins = webpackConfig.plugins || [];
    webpackConfig.plugins.push(new FailureKarmaWebpackPlugin(compilationErrorCb));

    // Use existing config if any.
    config.webpack = Object.assign(webpackConfig, config.webpack);
    config.webpackMiddleware = Object.assign(webpackMiddlewareConfig, config.webpackMiddleware);

    // Our custom context and debug files list the webpack bundles directly instead of using
    // the karma files array.
    config.customContextFile = `${__dirname}/karma-context.html`;
    config.customDebugFile = `${__dirname}/karma-debug.html`;

    // Add the request blocker and the webpack server fallback.
    config.beforeMiddleware = config.beforeMiddleware || [];
    config.beforeMiddleware.push('lib-tools--blocker');
    config.middleware = config.middleware || [];
    config.middleware.push('lib-tools--fallback');

    webpackConfig.watch = !config.singleRun;
    if (config.singleRun) {
        webpackConfig.plugins.unshift(new TurnOffWatchWebpackPlugin());
    }

    // Files need to be served from a custom path for Karma.
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
            // Emit a failure build event if there are compilation errors.
            // if (failureCb) {
            //     failureCb();
            // }
        } else if (stats.hash !== lastCompilationHash) {
            // Refresh karma only when there are no webpack errors, and if the compilation changed.
            lastCompilationHash = stats.hash;
            emitter.refreshFiles();
        }

        unblock();
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    webpackMiddleware = webpackDevMiddleware(compiler, webpackMiddlewareConfig);

    // Forward requests to webpack server.
    customFileHandlers.push({
        urlRegex: /^\/_karma_webpack_\/.*/,
        handler: (req: { url: string }, res: http.ServerResponse) => {
            webpackMiddleware(req, res, function () {
                const alwaysServe = [
                    '/_karma_webpack_/runtime.js',
                    '/_karma_webpack_/polyfills.js',
                    '/_karma_webpack_/polyfills-es5.js'
                ];
                if (alwaysServe.indexOf(req.url) !== -1) {
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
