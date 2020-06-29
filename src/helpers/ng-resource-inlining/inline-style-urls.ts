import * as path from 'path';

import { readFile } from 'fs-extra';
import * as resolve from 'resolve';
import { SassException, Options as SassOptions, Result as SassResult } from 'sass';
import * as postcssTypes from 'postcss';

import { MagicStringInstance, StyleUrlsInfo, findResourcePath } from './shared';

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
let postcssModulePath: string | null = null;
let cssnanoModulePath: string | null = null;
let sass: {
    render(options: SassOptions, callback: (exception: SassException, result: SassResult) => void): void;
};

let postcss: (plugins?: postcssTypes.AcceptedPlugin[]) => postcssTypes.Processor;

export async function inlineStyleUrls(
    workspaceRoot: string,
    styleUrlsInfoes: StyleUrlsInfo[],
    magicStringInstance: MagicStringInstance,
    srcDir: string,
    outDir: string,
    includePaths: string[],
    componentResources: Map<string, string>
): Promise<void> {
    for (const styleUrlsInfo of styleUrlsInfoes) {
        const styleUrls = styleUrlsInfo.urls;
        const resourceId = styleUrlsInfo.resourceId;

        const styleContents = await Promise.all(
            styleUrls.map(async (styleUrl: string) => {
                const styleSourceFilePath = await findResourcePath(styleUrl, resourceId, srcDir, outDir);
                const styleDestFilePath = path.resolve(path.dirname(resourceId), styleUrl);
                const styleContentBuffer = await readStyleContent(styleSourceFilePath, includePaths, workspaceRoot);

                const componentKey = path
                    .relative(outDir, styleDestFilePath)
                    .replace(/\\/g, '/')
                    .replace(/^(\.\/|\/)/, '')
                    .replace(/\/$/, '');

                let styleContentStr = styleContentBuffer.toString();
                styleContentStr = await processPostCss(styleContentStr, styleSourceFilePath, workspaceRoot);
                componentResources.set(componentKey, styleContentStr);

                return styleContentStr;
            })
        );

        const styleContentsToReplace = `styles: ["${styleContents.join(' ')}"]`;
        magicStringInstance.overwrite(styleUrlsInfo.start, styleUrlsInfo.end, styleContentsToReplace);
    }
}

async function readStyleContent(
    styleSourceFilePath: string,
    includePaths: string[],
    workspaceRoot: string
): Promise<string | Buffer> {
    let styleContent: string | Buffer;

    if (/\.s[ac]ss$$/i.test(styleSourceFilePath)) {
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

        if (!sassModulePath) {
            throw new Error(
                `To compile scss/sass files, install sass package with 'npm i -D sass' or 'npm i -D node-sass'.`
            );
        }

        if (!sass) {
            sass = require(sassModulePath);
        }

        const result = await new Promise<{
            css: Buffer;
        }>((res, rej) => {
            sass.render(
                { file: styleSourceFilePath, includePaths },
                (
                    err: Error,
                    sassResult: {
                        css: Buffer;
                    }
                ) => {
                    if (err) {
                        rej(err);

                        return;
                    }

                    res(sassResult);
                }
            );
        });
        styleContent = result.css;
    } else {
        styleContent = await readFile(styleSourceFilePath, 'utf-8');
    }

    return styleContent;
}

async function processPostCss(css: string, from: string, workspaceRoot: string): Promise<string> {
    if (cssnanoModulePath == null) {
        const p = await resolveAsync('cssnano', {
            basedir: workspaceRoot
        });

        cssnanoModulePath = p ? path.dirname(p) : '';
    }

    if (cssnanoModulePath) {
        const p = await resolveAsync('postcss', {
            basedir: workspaceRoot
        });

        postcssModulePath = p ? path.dirname(p) : '';
    }

    if (postcssModulePath && cssnanoModulePath) {
        if (!postcss) {
            postcss = require('postcss');
        }

        const result = await postcss([
            // postcssUrl({
            //     url: 'inline'
            // }),

            // autoprefixer,

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require(cssnanoModulePath)({
                safe: true,
                mergeLonghand: false,
                discardComments: {
                    removeAll: true
                }
            })
        ]).process(css, {
            from
        });

        return result.css;
    } else {
        return `${css}`.replace(/([\n\r]\s*)+/gm, ' ').replace(/"/g, '\\"');
    }
}
