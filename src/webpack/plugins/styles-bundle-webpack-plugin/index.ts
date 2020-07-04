import * as path from 'path';

import { copy, ensureDir, readFile, writeFile } from 'fs-extra';
import * as autoprefixer from 'autoprefixer';
import * as CleanCSS from 'clean-css';
import * as postcss from 'postcss';
import * as sass from 'sass';
import * as webpack from 'webpack';

import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger, normalizeRelativePath } from '../../../utils';

export interface StyleBundleWebpackPluginOptions {
    projectBuildConfig: ProjectBuildConfigInternal;
    logLevel?: LogLevelString;
}

export class StyleBundleWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'styles-bundle-webpack-plugin';
    }

    constructor(private readonly options: StyleBundleWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            debugPrefix: `[${this.name}]`,
            infoPrefix: ''
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => {
            await this.processStyles();
        });
    }

    private async processStyles(): Promise<void> {
        const projectBuildConfig = this.options.projectBuildConfig;

        if (!projectBuildConfig._styleParsedEntries || !projectBuildConfig._styleParsedEntries.length) {
            return;
        }

        await Promise.all(
            projectBuildConfig._styleParsedEntries.map(async (styleEntry) => {
                const inputFilePath = styleEntry._inputFilePath;
                const outFilePath = styleEntry._outputFilePath;
                const inputRelToWorkspace = normalizeRelativePath(
                    path.relative(projectBuildConfig._workspaceRoot, inputFilePath)
                );

                if (/\.s[ac]ss$/i.test(inputFilePath)) {
                    if (/\.css$/i.test(outFilePath)) {
                        if (this.options.logLevel === 'debug') {
                            this.logger.debug(`Compiling ${inputRelToWorkspace}`);
                        } else {
                            this.logger.info(`Compiling ${inputRelToWorkspace}`);
                        }

                        const result = await new Promise<sass.Result>((res, rej) => {
                            sass.render(
                                {
                                    outputStyle: 'expanded',
                                    file: inputFilePath,
                                    outFile: outFilePath,
                                    sourceMap: styleEntry._sourceMap,
                                    sourceMapContents: styleEntry._sourceMap ? true : false,
                                    includePaths: styleEntry._includePaths
                                },
                                (err, sassResult) => {
                                    if (err) {
                                        rej(err);

                                        return;
                                    }

                                    res(sassResult);
                                }
                            );
                        });

                        await ensureDir(path.dirname(outFilePath));
                        await writeFile(outFilePath, result.css);
                        if (styleEntry._sourceMap && result.map) {
                            await writeFile(`${outFilePath}.map`, result.map);
                        }
                    } else {
                        if (this.options.logLevel === 'debug') {
                            this.logger.debug(`Copying ${inputRelToWorkspace}`);
                        } else {
                            this.logger.info(`Copying ${inputRelToWorkspace}`);
                        }

                        await copy(inputFilePath, outFilePath);
                    }
                } else {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug(`Copying ${inputRelToWorkspace}`);
                    } else {
                        this.logger.info(`Copying ${inputRelToWorkspace}`);
                    }

                    await copy(inputFilePath, outFilePath);
                }

                if (styleEntry.vendorPrefixes) {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug('Adding vendor prefixes to css rules');
                    } else {
                        this.logger.info('Adding vendor prefixes to css rules');
                    }
                    const cssContent = await readFile(outFilePath, 'utf-8');
                    const postcssResult = await postcss([
                        autoprefixer({
                            cascade: false
                        })
                    ]).process(cssContent, {
                        from: outFilePath
                    });
                    await writeFile(outFilePath, postcssResult.css);
                    if (styleEntry._sourceMap && postcssResult.map) {
                        await writeFile(`${outFilePath}.map`, postcssResult.map);
                    }
                }

                if (styleEntry.minify) {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug('Minifing css rules');
                    } else {
                        this.logger.info('Minifing css rules');
                    }
                    const cssContent = await readFile(outFilePath, 'utf-8');
                    const result = new CleanCSS({
                        // level: 1,
                        // format: {
                        //     breakWith: 'lf'
                        // },
                        sourceMap: styleEntry._sourceMap,
                        sourceMapInlineSources: styleEntry._sourceMap,
                        rebaseTo: path.dirname(outFilePath)
                    }).minify(cssContent);

                    if (result.errors && result.errors.length) {
                        throw new Error(result.errors.join('\n'));
                    }

                    const minDest = path.resolve(path.dirname(outFilePath), `${path.parse(outFilePath).name}.min.css`);
                    await writeFile(minDest, result.styles);
                    if (styleEntry._sourceMap && result.sourceMap) {
                        await writeFile(`${minDest}.map`, result.sourceMap);
                    }
                }
            })
        );
    }
}
