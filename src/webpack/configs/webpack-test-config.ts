import * as path from 'path';
import { promisify } from 'util';

import { AngularCompilerPlugin, NgToolsLoader } from '@ngtools/webpack';
import * as Ajv from 'ajv';
import { pathExists } from 'fs-extra';
import * as glob from 'glob';
import { ConfigOptions as KarmaConfigOptions } from 'karma';
import { Configuration, Plugin, Rule } from 'webpack';

import {
    applyProjectExtends,
    findPackageJsonPath,
    findTestEntryFile,
    findTestTsconfigFile,
    getCachedPackageJson,
    getCachedWorkflowConfigSchema,
    isAngularProject
} from '../../helpers';
import {
    PackageJsonLike,
    ProjectConfigInternal,
    TestCommandOptions,
    TestConfigInternal,
    WorkflowConfig
} from '../../models';
import { LogLevelString, findUp, isInFolder, isSamePaths, readJsonWithComments } from '../../utils';

import { TestInfoWebpackPlugin } from '../plugins/test-info-webpack-plugin';

const globAsync = promisify(glob);
const ajv = new Ajv();

export async function getWebpackTestConfigFromKarma(
    karmaConfig: KarmaConfigOptions & { configFile: string }
): Promise<Configuration> {
    const karmaConfigFile = karmaConfig.configFile;
    const testConfig = await getTestConfigFromKarmaConfigFile(karmaConfigFile);
    if (!testConfig) {
        throw new Error('Could not detect workflow test config.');
    }

    const logLevel = karmaConfig.logLevel != null ? (karmaConfig.logLevel as LogLevelString) : 'info';
    const argv = {
        logLevel
    };

    const webpackConfig = await getWebpackTestConfig(testConfig, argv);

    return webpackConfig;
}

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
            testConfig._entryFilePath &&
            /\.tsx?$/i.test(testConfig._entryFilePath) &&
            (await isAngularProject(testConfig._workspaceRoot, testConfig._packageJson))
        ) {
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

    if (testConfig.codeCoverage) {
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

async function getTestConfigFromKarmaConfigFile(karmaConfigFile: string): Promise<TestConfigInternal | null> {
    const karmaConfigBaseDir = path.dirname(karmaConfigFile);
    const foundWorkflowConfigPath = await findUp(
        ['workflow.json'],
        karmaConfigBaseDir,
        path.parse(karmaConfigBaseDir).root
    );

    if (foundWorkflowConfigPath) {
        const workflowConfig = (await readJsonWithComments(foundWorkflowConfigPath)) as WorkflowConfig;
        const schema = await getCachedWorkflowConfigSchema();
        if (!ajv.getSchema('workflowSchema')) {
            ajv.addSchema(schema, 'workflowSchema');
        }
        const valid = ajv.validate('workflowSchema', workflowConfig);
        if (!valid) {
            throw new Error(`Invalid workflow configuration. ${ajv.errorsText()}`);
        }

        const workspaceRoot = path.dirname(foundWorkflowConfigPath);
        const projectConfigs = Object.keys(workflowConfig.projects).map((projectName) => {
            const projectConfig = workflowConfig.projects[projectName];

            if (projectConfig.root && path.isAbsolute(projectConfig.root)) {
                throw new Error(
                    `Invalid workflow configuration. The 'projects[${projectName}].root' must be relative path.`
                );
            }

            const projectRoot = path.resolve(workspaceRoot, projectConfig.root || '');

            const projectConfigInternal: ProjectConfigInternal = {
                ...projectConfig,
                _workspaceRoot: workspaceRoot,
                _config: foundWorkflowConfigPath,
                _projectName: projectName,
                _projectRoot: projectRoot
            };

            return projectConfigInternal;
        });

        for (const projectConfig of projectConfigs) {
            await applyProjectExtends(projectConfig, projectConfigs, projectConfig._config);
            if (!projectConfig.tasks || !projectConfig.tasks.test) {
                continue;
            }

            const testConfig = projectConfig.tasks.test;

            if (testConfig.skip) {
                continue;
            }

            const projectRoot = projectConfig._projectRoot;

            if (
                testConfig.karmaConfig &&
                !isSamePaths(karmaConfigFile, path.resolve(projectRoot, testConfig.karmaConfig))
            ) {
                continue;
            }

            let tsConfigPath: string | null = null;
            let entryFilePath: string | null = null;

            if (testConfig.tsConfig) {
                tsConfigPath = path.resolve(projectRoot, testConfig.tsConfig);
            } else {
                tsConfigPath = await findTestTsconfigFile(projectRoot, workspaceRoot);
            }

            if (testConfig.entry) {
                entryFilePath = path.resolve(projectRoot, testConfig.entry);
            } else {
                entryFilePath = await findTestEntryFile(projectRoot, workspaceRoot, tsConfigPath);
            }

            let packageJson: PackageJsonLike | null = null;

            const packageJsonPath = await findPackageJsonPath(projectRoot, workspaceRoot);
            if (packageJsonPath) {
                packageJson = await getCachedPackageJson(packageJsonPath);
            }

            const testConfigInternal: TestConfigInternal = {
                ...testConfig,
                _config: projectConfig._config,
                _workspaceRoot: workspaceRoot,
                _projectRoot: projectRoot,
                _projectName: projectConfig._projectName,
                _packageJson: packageJson,
                _entryFilePath: entryFilePath,
                _tsConfigPath: tsConfigPath,
                _karmaConfigPath: karmaConfigFile
            };

            return testConfigInternal;
        }

        return null;
    } else {
        const workspaceRoot = isInFolder(process.cwd(), karmaConfigBaseDir) ? process.cwd() : karmaConfigBaseDir;
        const tsConfigPath = await findTestTsconfigFile(karmaConfigBaseDir, workspaceRoot);
        const entryFilePath = await findTestEntryFile(karmaConfigBaseDir, workspaceRoot, tsConfigPath);
        if (!entryFilePath) {
            return null;
        }

        const packageJsonPath = await findUp('package.json', karmaConfigBaseDir, workspaceRoot);
        let packageJson: PackageJsonLike | null = null;
        if (!packageJsonPath) {
            return null;
        }

        packageJson = await getCachedPackageJson(packageJsonPath);
        const packageName = packageJson.name;
        if (!packageName) {
            return null;
        }

        let packageNameWithoutScope = packageName;
        const slashIndex = packageName.indexOf('/');
        if (slashIndex > -1 && packageName.startsWith('@')) {
            packageNameWithoutScope = packageName.substr(slashIndex + 1);
        }
        const projectName = packageNameWithoutScope.replace(/\//g, '-');

        return {
            _config: 'auto',
            _workspaceRoot: workspaceRoot,
            _projectRoot: karmaConfigBaseDir,
            _projectName: projectName,
            _packageJson: packageJson,
            _tsConfigPath: tsConfigPath,
            _entryFilePath: entryFilePath,
            _karmaConfigPath: karmaConfigFile
        };
    }
}
