import * as path from 'path';
import { promisify } from 'util';

import { AngularCompilerPlugin, NgToolsLoader } from '@ngtools/webpack';
import { pathExists } from 'fs-extra';
import * as glob from 'glob';
import { Configuration, Plugin, Rule } from 'webpack';

import { isAngularProject } from '../../helpers';
import { TestCommandOptions, TestConfigInternal } from '../../models';

import { TestInfoWebpackPlugin } from '../plugins/test-info-webpack-plugin';

const globAsync = promisify(glob);

export async function getWebpackTestConfig(
    testConfig: TestConfigInternal,
    testCommandOptions: TestCommandOptions
): Promise<Configuration> {
    const plugins: Plugin[] = [
        new TestInfoWebpackPlugin({
            testConfig,
            logLevel: testCommandOptions.logLevel
        })
    ];
    const rules: Rule[] = [];

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
            rules.push({
                test: /\.tsx?$/,
                loader: NgToolsLoader,
                options: {
                    mainPath: testConfig._testIndexFilePath,
                    configFile: tsConfigPath,
                    skipCodeGeneration: true,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    contextElementDependencyConstructor: require('webpack/lib/dependencies/ContextElementDependency'),
                    directTemplateLoading: true
                }
            });

            plugins.push(
                new AngularCompilerPlugin({
                    tsConfigPath
                })
            );
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

    const codeCoverage =
        testConfig.codeCoverage || (testConfig.reporters && testConfig.reporters.includes('coverage-istanbul'));
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
                        test: (module: { nameForCondition?: () => string }, chunks: { name: string }[]) => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';

                            return (
                                /[\\/]node_modules[\\/]/.test(moduleName) &&
                                !chunks.some(({ name }) => name === 'polyfills')
                            );
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
            const polyfills = Array.isArray(testConfig.polyfills) ? testConfig.polyfills : [testConfig.polyfills];
            webpackConfig.entry.polyfills = await resolvePolyfillPaths(polyfills, testConfig._projectRoot);
        }
    } else {
        webpackConfig.entry = () => {
            return {};
        };
    }

    return webpackConfig;
}

async function resolvePolyfillPaths(polyfills: string[], projectRoot: string): Promise<string[]> {
    const resolvedPaths: string[] = [];

    for (const p of polyfills) {
        const tempPath = path.resolve(projectRoot, p);
        if (await pathExists(tempPath)) {
            resolvedPaths.push(tempPath);
        } else {
            resolvedPaths.push(p);
        }
    }

    return resolvedPaths;
}
