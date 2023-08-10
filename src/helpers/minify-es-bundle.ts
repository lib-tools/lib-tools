import * as path from 'path';

import { existsSync, readFile, writeFile } from 'fs-extra';
import { ECMA, SourceMapOptions, minify } from 'terser';

export async function minifyESBundle(
    inputPath: string,
    outputPath: string,
    sourceMap: boolean | null | undefined,
    ecma: ECMA | undefined
): Promise<void> {
    const content = await readFile(inputPath, 'utf-8');
    let sourceMapOptions: SourceMapOptions | boolean = false;
    const sourcemapOutputPth = `${outputPath}.map`;

    if (sourceMap && existsSync(`${inputPath}.map`)) {
        const sourceMapContent = await readFile(`${inputPath}.map`, 'utf-8');
        sourceMapOptions = {
            includeSources: true,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            content: JSON.parse(sourceMapContent),
            url: path.basename(sourcemapOutputPth)
        };
    }

    const result = await minify(content, {
        sourceMap: sourceMapOptions,
        parse: {
            ecma,
            bare_returns: true
        }
        // warnings: false,
        // output: {
        //     // comments: /^\**!|@preserve|@license/
        //     comments: 'some'
        // }
    });

    // if (result.error) {
    //     throw result.error;
    // }

    // if (result.warnings) {
    //     result.warnings.forEach((warning) => {
    //         logger.warn(warning);
    //     });
    // }

    if (result.code) {
        await writeFile(outputPath, result.code);
    }

    if (sourceMap && result.map) {
        await writeFile(sourcemapOutputPth, result.map.toString());
    }
}
