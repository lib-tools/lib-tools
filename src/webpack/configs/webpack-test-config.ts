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
        if (await isAngularProject(testConfig._workspaceRoot, testConfig._packageJson)) {
            rules.push({
                test: /\.tsx?$/,
                loader: NgToolsLoader,
                options: {
                    mainPath: testConfig._entryFilePath,
                    configFile: tsConfigPath,
                    skipCodeGeneration: true,
                    sourceMap: testConfig.sourceMap,
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

    if (testConfig._codeCoverage) {
        const exclude: (string | RegExp)[] = [/\.(e2e|spec)\.tsx?$/, /node_modules/];
        const codeCoverageExclude = testConfig.codeCoverageExclude;

        if (codeCoverageExclude) {
            for (const excludeGlob of codeCoverageExclude) {
                const excludeFiles = await globAsync(path.join(testConfig._projectRoot, excludeGlob), { nodir: true });
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
        // devtool: testConfig.sourceMap ? false : 'eval',
        devtool: testConfig.sourceMap ? 'inline-source-map' : 'eval',
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.mjs'],
            mainFields: ['es2017', 'es2015', 'browser', 'module', 'main']
        },
        output: {
            path: '/_karma_webpack_/',
            publicPath: '/_karma_webpack_/',
            // Enforce that the output filename is dynamic and doesn't contain chunkhashes
            // TODO: To review
            filename: '[name].js',
            crossOriginLoading: 'anonymous'
        },
        context: testConfig._projectRoot,
        module: {
            rules
        },
        plugins,
        optimization: {
            // runtimeChunk: false,
            // splitChunks: false,
            runtimeChunk: 'single',
            splitChunks: {
                maxAsyncRequests: Infinity,
                chunks: (chunk: { name: string }) => !isPolyfillsEntry(chunk.name),
                cacheGroups: {
                    vendors: false,
                    vendor: {
                        name: 'vendor',
                        chunks: 'initial',
                        test: (module: { nameForCondition?: () => string }, chunks: { name: string }[]) => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';

                            return (
                                /[\\/]node_modules[\\/]/.test(moduleName) &&
                                !chunks.some(({ name }) => isPolyfillsEntry(name))
                            );
                        }
                    }
                }
            }
        },
        stats: 'errors-only'
    };

    if (testConfig._entryFilePath || (testConfig.polyfills && testConfig.polyfills.length > 0)) {
        webpackConfig.entry = {};
        if (testConfig._entryFilePath) {
            webpackConfig.entry.main = testConfig._entryFilePath;
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

function isPolyfillsEntry(name: string) {
    return name === 'polyfills' || name === 'polyfills-es5';
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
