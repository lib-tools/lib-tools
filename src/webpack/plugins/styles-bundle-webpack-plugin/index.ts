import * as path from 'path';

import { copy, ensureDir, readFile, writeFile } from 'fs-extra';
import * as autoprefixer from 'autoprefixer';
import * as CleanCSS from 'clean-css';
import * as postcss from 'postcss';
import * as sass from 'sass';
import * as webpack from 'webpack';

import { AutoPrefixerOptions, CleanCSSOptions, StyleOptions } from '../../../models';
import { BuildActionInternal } from '../../../models/internals';
import { LogLevelString, Logger, normalizeRelativePath } from '../../../utils';

export interface StyleBundleWebpackPluginOptions {
    buildAction: BuildActionInternal;
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
        const buildAction = this.options.buildAction;

        if (!buildAction._styleParsedEntries || !buildAction._styleParsedEntries.length) {
            return;
        }

        const styleOptions = buildAction.style as StyleOptions;

        await Promise.all(
            buildAction._styleParsedEntries.map(async (styleEntry) => {
                const inputFilePath = styleEntry._inputFilePath;
                const outFilePath = styleEntry._outputFilePath;
                const inputRelToWorkspace = normalizeRelativePath(
                    path.relative(buildAction._workspaceRoot, inputFilePath)
                );

                let sourceMap = true;
                if (styleEntry.sourceMap != null) {
                    sourceMap = styleEntry.sourceMap;
                } else if (styleOptions.sourceMap != null) {
                    sourceMap = styleOptions.sourceMap;
                }

                let sourceMapContents = true;
                if (styleEntry.sourceMapContents != null) {
                    sourceMapContents = styleEntry.sourceMapContents;
                } else if (styleOptions.sourceMapContents != null) {
                    sourceMapContents = styleOptions.sourceMapContents;
                }

                if (/\.s[ac]ss$/i.test(inputFilePath)) {
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
                                sourceMap,
                                sourceMapContents,
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
                    if (sourceMap && result.map) {
                        await writeFile(`${outFilePath}.map`, result.map);
                    }
                } else {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug(`Copying ${inputRelToWorkspace}`);
                    } else {
                        this.logger.info(`Copying ${inputRelToWorkspace}`);
                    }

                    await ensureDir(path.dirname(outFilePath));
                    await copy(inputFilePath, outFilePath);
                }

                let vendorPrefixes: boolean | AutoPrefixerOptions = true;
                if (styleEntry.vendorPrefixes != null) {
                    vendorPrefixes = styleEntry.vendorPrefixes;
                } else if (styleOptions.vendorPrefixes != null) {
                    vendorPrefixes = styleOptions.vendorPrefixes;
                }

                if (vendorPrefixes !== false) {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug('Adding vendor prefixes to css rules');
                    } else {
                        this.logger.info('Adding vendor prefixes to css rules');
                    }

                    const vendorPrefixesOptions = typeof vendorPrefixes === 'object' ? vendorPrefixes : {};

                    const cssContent = await readFile(outFilePath, 'utf-8');
                    const postcssResult = await postcss([
                        autoprefixer({
                            ...vendorPrefixesOptions
                        })
                    ]).process(cssContent, {
                        from: outFilePath
                    });
                    await writeFile(outFilePath, postcssResult.css);
                    if (sourceMap && postcssResult.map) {
                        await writeFile(`${outFilePath}.map`, postcssResult.map);
                    }
                }

                let minify: boolean | CleanCSSOptions = true;
                if (styleEntry.minify != null) {
                    minify = styleEntry.minify;
                } else if (styleOptions.minify != null) {
                    minify = styleOptions.minify;
                }

                if (minify) {
                    if (this.options.logLevel === 'debug') {
                        this.logger.debug('Minifing css rules');
                    } else {
                        this.logger.info('Minifing css rules');
                    }

                    const cleanCssOptions = typeof minify === 'object' ? minify : {};
                    let cleanCssSourceMap = sourceMap;
                    if (cleanCssOptions.sourceMap != null) {
                        cleanCssSourceMap = cleanCssOptions.sourceMap;
                    }

                    const cssContent = await readFile(outFilePath, 'utf-8');
                    const result = new CleanCSS({
                        ...cleanCssOptions,
                        sourceMap: cleanCssSourceMap,
                        rebaseTo: path.dirname(outFilePath)
                    }).minify(cssContent);

                    if (result.errors && result.errors.length) {
                        throw new Error(result.errors.join('\n'));
                    }

                    const minDest = path.resolve(path.dirname(outFilePath), `${path.parse(outFilePath).name}.min.css`);
                    await writeFile(minDest, result.styles);
                    if (cleanCssSourceMap && result.sourceMap) {
                        await writeFile(`${minDest}.map`, result.sourceMap);
                    }
                }
            })
        );
    }
}
