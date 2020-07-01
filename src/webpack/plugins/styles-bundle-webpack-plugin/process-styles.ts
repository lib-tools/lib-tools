import * as path from 'path';

import * as autoprefixer from 'autoprefixer';
import { copy, ensureDir, readFile, writeFile } from 'fs-extra';
import * as postcss from 'postcss';
import * as resolve from 'resolve';
import { SassException, Options as SassOptions, Result as SassResult } from 'sass';

import { ProjectBuildConfigInternal } from '../../../models/internals';
import { LoggerBase } from '../../../utils';

const resolveAsync = (id: string, opts: resolve.AsyncOpts): Promise<string | null> => {
    return new Promise((res) => {
        resolve(id, opts, (err, resolvedPath) => {
            if (err || !resolvedPath) {
                res(null);
            } else {
                res(resolvedPath);
            }
        });
    });
};

let sassModulePath: string | null = null;
let sass: {
    render(options: SassOptions, callback: (exception: SassException, result: SassResult) => void): void;
};

export async function processStyles(projectBuildConfig: ProjectBuildConfigInternal, logger: LoggerBase): Promise<void> {
    if (!projectBuildConfig._styleParsedEntries || !projectBuildConfig._styleParsedEntries.length) {
        return;
    }

    const workspaceRoot = projectBuildConfig._workspaceRoot;
    const projectRoot = projectBuildConfig._projectRoot;
    const outputPath = projectBuildConfig._outputPath;
    const sourceMap = projectBuildConfig.sourceMap;

    const includePaths: string[] = [];
    if (
        projectBuildConfig.stylePreprocessorOptions &&
        projectBuildConfig.stylePreprocessorOptions.includePaths &&
        projectBuildConfig.stylePreprocessorOptions.includePaths.length > 0
    ) {
        projectBuildConfig.stylePreprocessorOptions.includePaths.forEach((includePath: string) => {
            const includePathAbs = path.resolve(projectRoot, includePath);
            includePaths.push(includePathAbs);
        });
    }

    logger.info('Processing styles');

    await Promise.all(
        projectBuildConfig._styleParsedEntries.map(async (styleParsedEntry) => {
            const input = styleParsedEntry.paths[0];
            const dest = path.resolve(outputPath, styleParsedEntry.entry);

            if (/\.s[ac]ss$/i.test(input) && !/\.s[ac]ss$/i.test(dest)) {
                if (sassModulePath == null) {
                    let p = await resolveAsync('sass', {
                        basedir: workspaceRoot
                    });

                    if (!p) {
                        p = await resolveAsync('node-sass', {
                            basedir: workspaceRoot
                        });
                    }

                    sassModulePath = p ? path.dirname(p) : '';
                }

                if (!sass) {
                    sass = sassModulePath ? require(sassModulePath) : require('sass');
                }

                const result = await new Promise<SassResult>((res, rej) => {
                    sass.render(
                        {
                            file: input,
                            sourceMap,
                            outFile: dest,
                            includePaths
                            // bootstrap-sass requires a minimum precision of 8
                            // precision: 8
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

                await ensureDir(path.dirname(dest));
                await writeFile(dest, result.css);
                if (sourceMap && result.map) {
                    await writeFile(`${dest}.map`, result.map);
                }
            } else if (/\.css$/i.test(input)) {
                await copy(input, dest);
            } else {
                throw new Error(`The ${input} is not supported style format.`);
            }

            // minify
            const styleContent = await readFile(dest, 'utf-8');
            const minifiedResult = await processPostCss(styleContent, dest);
            const minDest = path.resolve(path.dirname(dest), `${path.parse(dest).name}.min.css`);
            await writeFile(minDest, minifiedResult.css);
            if (minifiedResult.map) {
                await writeFile(`${minDest}.map`, minifiedResult.map);
            }
        })
    );
}

async function processPostCss(css: string, from: string): Promise<postcss.LazyResult> {
    // safe settings based on: https://github.com/ben-eb/cssnano/issues/358#issuecomment-283696193
    const importantCommentRegex = /@preserve|@license|[@#]\s*source(?:Mapping)?URL|^!/i;

    return postcss([
        autoprefixer,
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('cssnano')({
            safe: true,
            discardComments: { remove: (comment: string) => !importantCommentRegex.test(comment) }
        })
    ]).process(css, {
        from
    });
}
