import * as path from 'path';

import { existsSync, readFile, writeFile } from 'fs-extra';
import * as uglify from 'uglify-js';

import { LoggerBase } from '../../../utils';

export async function minifyJsFile(
    inputPath: string,
    outputPath: string,
    sourceMap: boolean,
    logger: LoggerBase
): Promise<void> {
    const content = await readFile(inputPath, 'utf-8');
    let sourceMapContent: string | null = null;
    if (sourceMap && existsSync(`${inputPath}.map`)) {
        sourceMapContent = await readFile(`${inputPath}.map`, 'utf-8');
    }
    const outputFileName = path.parse(outputPath).base;
    const sourceObj: { [key: string]: string } = {};
    sourceObj[outputFileName] = content;

    const result: uglify.MinifyOutput = uglify.minify(sourceObj, {
        // TODO: warnings: verbose
        // warnings: verbose, // default false,
        ie8: true, // default false
        sourceMap: sourceMap
            ? {
                  // filename: outputFileName,
                  content: (sourceMapContent as unknown) as never,
                  url: `${outputFileName}.map`
              }
            : false,
        compress: {
            passes: 3, // default 1
            negate_iife: false // default true, we need this for lazy v8
        },
        output: {
            comments: /^\**!|@preserve|@license/,
            beautify: false // default true
        }
    });

    if (result.error) {
        throw result.error;
    }

    // TODO: if (result.warnings && verbose) {
    if (result.warnings) {
        const warnings = result.warnings;
        if (Array.isArray(warnings)) {
            warnings.forEach((msg) => {
                logger.warn(msg);
            });
        } else if (typeof warnings === 'string') {
            logger.warn(warnings);
        }
    }

    await writeFile(outputPath, result.code);
    if (sourceMap && result.map) {
        const sourcemapPath = `${outputPath}.map`;
        await writeFile(sourcemapPath, result.map);
    }
}
