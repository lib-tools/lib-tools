import * as path from 'path';
import { promisify } from 'util';

import { Configuration, Plugin, Rule } from 'webpack';
import * as glob from 'glob';

import { TestAction } from '../../models';

const globAsync = promisify(glob);

export async function getWebpackTestConfig(
    projectName: string,
    projectRoot: string,
    testAction: TestAction
): Promise<Configuration> {
    const plugins: Plugin[] = [];
    const rules: Rule[] = [];

    if (testAction.vendorSourceMap) {
        rules.push({
            test: /\.m?js$/,
            enforce: 'pre',
            loader: require.resolve('source-map-loader')
        });
    }

    if (testAction.tsConfig) {
        rules.push({
            test: /\.tsx?$/,
            loader: require.resolve('ts-loader'),
            options: {
                configFile: path.resolve(projectRoot, testAction.tsConfig)
            }
        });
    }

    if (testAction.codeCoverage) {
        const exclude: (string | RegExp)[] = [/\.(e2e|spec)\.tsx?$/, /node_modules/];
        const codeCoverageExclude = testAction.codeCoverageExclude;

        if (codeCoverageExclude) {
            for (const excludeGlob of codeCoverageExclude) {
                const excludeFiles = await globAsync(path.join(projectRoot, excludeGlob), { nodir: true });
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
        name: projectName,
        mode: 'development',
        devtool: testAction.sourceMap ? 'inline-source-map' : 'eval',
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.mjs'],
            mainFields: ['es2017', 'es2015', 'browser', 'module', 'main']
        },
        output: {
            path: '/_karma_webpack_/',
            publicPath: '/_karma_webpack_/',
            // Enforce that the output filename is dynamic and doesn't contain chunkhashes
            // TODO: To review
            filename: '[name].js'
        },
        context: projectRoot,
        module: {
            rules
        },
        plugins,
        optimization: {
            // TODO: To review
            // splitChunks: false,
            // runtimeChunk: false,
            splitChunks: {
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

    if (testAction.entry) {
        webpackConfig.entry = {
            main: path.resolve(projectRoot, testAction.entry)
        };
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
