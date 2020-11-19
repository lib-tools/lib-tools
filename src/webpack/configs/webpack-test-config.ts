import * as path from 'path';
import { promisify } from 'util';

import { pathExists } from 'fs-extra';
import * as glob from 'glob';
import { Configuration, RuleSetRule, WebpackPluginInstance } from 'webpack';

import { isAngularProject } from '../../helpers';
import { TestCommandOptions, TestConfigInternal } from '../../models';

import { TestInfoWebpackPlugin } from '../plugins/test-info-webpack-plugin';

const globAsync = promisify(glob);

export async function getWebpackTestConfig(
    testConfig: TestConfigInternal,
    testCommandOptions: TestCommandOptions
): Promise<Configuration> {
    const plugins: WebpackPluginInstance[] = [
        new TestInfoWebpackPlugin({
            testConfig,
            logLevel: testCommandOptions.logLevel
        })
    ];
    const rules: RuleSetRule[] = [];

    if (testConfig.vendorSourceMap) {
        rules.push({
            test: /\.m?js$/,
            enforce: 'pre',
            loader: require.resolve('source-map-loader')
        });
    }

    if (testConfig._tsConfigPath) {
        const tsConfigPath = testConfig._tsConfigPath;
        if (
            testConfig._testIndexFilePath &&
            /\.tsx?$/i.test(testConfig._testIndexFilePath) &&
            (await isAngularProject(testConfig._workspaceRoot, testConfig._packageJson))
        ) {
            const ngWebpackRulesAndPluginsModule = await import('../../helpers/ng-webpack-test-rules-and-plugins');
            const ngRulesAndPlugins = ngWebpackRulesAndPluginsModule.getWebpackTestRulesAndPluginsForAngular(
                testConfig
            );

            rules.push(...ngRulesAndPlugins.rules);
            plugins.push(...ngRulesAndPlugins.plugins);
        } else {
            rules.push({
                test: /\.tsx?$/,
                loader: require.resolve('ts-loader'),
                options: {
                    configFile: tsConfigPath
                }
            });
        }
    }

    const codeCoverage = testConfig.reporters && testConfig.reporters.includes('coverage');
    if (codeCoverage) {
        const exclude: (string | RegExp)[] = [/\.(e2e|spec)\.tsx?$/, /node_modules/];
        if (testConfig.codeCoverageExclude) {
            for (const excludePattern of testConfig.codeCoverageExclude) {
                if (!excludePattern) {
                    continue;
                }

                const excludeFiles = await globAsync(path.join(testConfig._projectRoot, excludePattern), {
                    nodir: true
                });

                for (const f of excludeFiles) {
                    const nf = path.normalize(f);
                    exclude.push(nf);
                }
            }
        }

        rules.push({
            test: /\.(jsx?|tsx?)$/,
            // loader: 'istanbul-instrumenter-loader',
            loader: require.resolve('@jsdevtools/coverage-istanbul-loader'),
            options: { esModules: true },
            enforce: 'post',
            // include: ["src/**/*.ts"],
            // include: path.resolve(__dirname, 'src'),
            exclude
        });
    }

    const webpackConfig: Configuration = {
        name: testConfig._projectName,
        mode: 'development',
        // 'inline-source-map'
        devtool: 'eval',
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.mjs'],
            mainFields: ['es2017', 'es2015', 'browser', 'module', 'main']
        },
        output: {
            path: '/_karma_webpack_/',
            publicPath: '/_karma_webpack_/',
            filename: '[name].js',
            crossOriginLoading: 'anonymous'
        },
        context: testConfig._projectRoot,
        module: {
            rules
        },
        plugins,
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                maxAsyncRequests: Infinity,
                chunks: (chunk: { name: string }) => chunk.name !== 'polyfills',
                cacheGroups: {
                    vendors: false,
                    vendor: {
                        name: 'vendor',
                        chunks: 'initial',
                        test: (
                            module: { nameForCondition?: () => string }
                            // TODO: To review
                            // chunk: { moduleGraph: unknown; chunkGraph: unknown }
                        ) => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';

                            return /[\\/]node_modules[\\/]/.test(moduleName);
                            // TODO: To review
                            // &&
                            // !chunks.some(({ name }) => name === 'polyfills')
                        }
                    }
                }
            }
        },
        stats: 'errors-only'
    };

    if (testConfig._testIndexFilePath || (testConfig.polyfills && testConfig.polyfills.length > 0)) {
        webpackConfig.entry = {};
        if (testConfig._testIndexFilePath) {
            webpackConfig.entry.main = testConfig._testIndexFilePath;
        }

        if (testConfig.polyfills && testConfig.polyfills.length > 0) {
            let resolvedPolyfillsPath = path.resolve(testConfig._projectRoot, testConfig.polyfills);
            if (!(await pathExists(resolvedPolyfillsPath))) {
                resolvedPolyfillsPath = testConfig.polyfills;
            }

            webpackConfig.entry.polyfills = resolvedPolyfillsPath;
        }
    } else {
        webpackConfig.entry = () => {
            return {};
        };
    }

    return webpackConfig;
}
