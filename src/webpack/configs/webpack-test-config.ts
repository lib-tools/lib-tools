import * as path from 'path';
import { promisify } from 'util';

import { AngularCompilerPlugin, NgToolsLoader } from '@ngtools/webpack';
import { pathExists } from 'fs-extra';
import * as glob from 'glob';
import { Configuration, Plugin, Rule } from 'webpack';

import { TestConfigInternal } from '../../models';
import { isAngularProject } from '../../helpers';

const globAsync = promisify(glob);

export async function getWebpackTestConfig(testConfig: TestConfigInternal): Promise<Configuration> {
    const workspaceRoot = testConfig._workspaceRoot;
    const projectRoot = testConfig._projectRoot;
    const projectName = testConfig._projectName;

    const plugins: Plugin[] = [];
    const rules: Rule[] = [];

    const entryFilePath = testConfig.entry ? path.resolve(projectRoot, testConfig.entry) : undefined;

    if (testConfig.vendorSourceMap) {
        rules.push({
            test: /\.m?js$/,
            enforce: 'pre',
            loader: require.resolve('source-map-loader')
        });
    }

    if (testConfig.tsConfig) {
        const tsConfigPath = path.resolve(projectRoot, testConfig.tsConfig);
        if (await isAngularProject(workspaceRoot)) {
            rules.push({
                test: /\.tsx?$/,
                loader: NgToolsLoader
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
                    mainPath: entryFilePath,
                    configFile: tsConfigPath,
                    skipCodeGeneration: true,
                    sourceMap: testConfig.sourceMap,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    contextElementDependencyConstructor: require('webpack/lib/dependencies/ContextElementDependency'),
                    directTemplateLoading: true
                }
            });
        }
    }

    if (testConfig.codeCoverage) {
        const exclude: (string | RegExp)[] = [/\.(e2e|spec)\.tsx?$/, /node_modules/];
        const codeCoverageExclude = testConfig.codeCoverageExclude;

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
        context: projectRoot,
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

    if (entryFilePath || (testConfig.polyfills && testConfig.polyfills.length > 0)) {
        webpackConfig.entry = {};
        if (entryFilePath) {
            webpackConfig.entry.main = entryFilePath;
        }
        if (testConfig.polyfills && testConfig.polyfills.length > 0) {
            const polyfills = Array.isArray(testConfig.polyfills) ? testConfig.polyfills : [testConfig.polyfills];
            webpackConfig.entry.polyfills = await resolvePolyfillPaths(polyfills, projectRoot);
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
