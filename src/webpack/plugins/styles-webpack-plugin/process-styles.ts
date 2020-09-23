import * as path from 'path';

import { copy, ensureDir, readFile, writeFile } from 'fs-extra';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
const autoprefixer = require('autoprefixer');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
const postcss = require('postcss');

import * as CleanCSS from 'clean-css';

import * as sass from 'sass';

import { BuildConfigInternal } from '../../../models';
import { LoggerBase, normalizePath } from '../../../utils';

export async function processStyles(buildConfig: BuildConfigInternal, logger: LoggerBase): Promise<void> {
    if (!buildConfig._styleEntries || !buildConfig._styleEntries.length) {
        return;
    }

    await Promise.all(
        buildConfig._styleEntries.map(async (styleEntry) => {
            const inputFilePath = styleEntry._inputFilePath;
            const outFilePath = styleEntry._outputFilePath;
            const inputRelToWorkspace = normalizePath(path.relative(buildConfig._workspaceRoot, inputFilePath));

            if (/\.s[ac]ss$/i.test(inputFilePath)) {
                logger.info(`Compiling ${inputRelToWorkspace}`);

                const result = await new Promise<sass.Result>((res, rej) => {
                    sass.render(
                        {
                            file: inputFilePath,
                            outFile: outFilePath,
                            sourceMap: styleEntry._sourceMap,
                            sourceMapContents: styleEntry._sourceMapContents,
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
                logger.info(`Copying ${inputRelToWorkspace}`);

                await ensureDir(path.dirname(outFilePath));
                await copy(inputFilePath, outFilePath);
            }

            if (styleEntry._vendorPrefixes !== false) {
                logger.debug('Adding vendor prefixes to css rules');

                const vendorPrefixesOptions =
                    typeof styleEntry._vendorPrefixes === 'object' ? styleEntry._vendorPrefixes : {};

                const cssContent = await readFile(outFilePath, 'utf-8');

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const postcssResult = await postcss([
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    autoprefixer({
                        ...vendorPrefixesOptions
                    })
                ]).process(cssContent, {
                    from: outFilePath
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                await writeFile(outFilePath, postcssResult.css);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (styleEntry._sourceMap && postcssResult.map) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    await writeFile(`${outFilePath}.map`, postcssResult.map.toString());
                }
            }

            if (styleEntry._minify !== false) {
                const minFileToWorkspace = normalizePath(
                    path.relative(buildConfig._workspaceRoot, styleEntry._minOutputFilePath)
                );

                logger.debug(`Generating minify file ${minFileToWorkspace}`);

                const cleanCssOptions = typeof styleEntry._minify === 'object' ? styleEntry._minify : {};
                let cleanCssSourceMap = styleEntry._sourceMap;
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

                await writeFile(styleEntry._minOutputFilePath, result.styles);
                if (cleanCssSourceMap && result.sourceMap) {
                    await writeFile(`${styleEntry._minOutputFilePath}.map`, result.sourceMap.toString());
                }
            }
        })
    );
}
