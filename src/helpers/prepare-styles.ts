import * as path from 'path';

import { pathExists } from 'fs-extra';

import { AutoPrefixerOptions, CleanCSSOptions } from '../models';
import { BuildActionInternal } from '../models/internals';
import { normalizePath } from '../utils';

const inputExtRegExp = /\.(sass|scss|css)$/i;
const outputExtRegExp = /\.css$/i;

export async function prepareStyles(buildAction: BuildActionInternal): Promise<void> {
    if (!buildAction.style) {
        return;
    }

    const styleOptions = buildAction.style;

    if (!styleOptions.compilations || !styleOptions.compilations.length) {
        return;
    }

    const projectName = buildAction._projectName;
    const projectRoot = buildAction._projectRoot;
    let packageJsonStyleEntry: string | undefined;

    for (let i = 0; i < styleOptions.compilations.length; i++) {
        const styleEntry = styleOptions.compilations[i];
        if (!styleEntry.input || !styleEntry.input.trim().length) {
            throw new Error(
                `Style input file is required, please correct value in 'projects[${projectName}].actions.build.style.compilations[${i}].input'.`
            );
        }

        if (!inputExtRegExp.test(styleEntry.input)) {
            throw new Error(
                `Unsupported style input file '${styleEntry.input}', please correct value in 'projects[${projectName}].actions.build.style.compilations[${i}].input'.`
            );
        }

        const inputFilePath = path.resolve(projectRoot, styleEntry.input);
        const inputFileExists = await pathExists(inputFilePath);
        if (!inputFileExists) {
            throw new Error(
                `Style input file '${inputFilePath}' doesn't exist, please correct value in 'projects[${projectName}].actions.build.style.compilations[${i}].input'.`
            );
        }

        let outputFilePath: string;

        if (styleEntry.output) {
            const extName = path.extname(styleEntry.output);

            if (!extName || styleEntry.output.endsWith('/')) {
                const outputFileName = path.basename(inputFilePath).replace(inputExtRegExp, '.css');
                outputFilePath = path.resolve(buildAction._outputPath, styleEntry.output, outputFileName);
            } else {
                if (!outputExtRegExp.test(extName)) {
                    throw new Error(
                        `Unsupported style output file '${styleEntry.input}', correct value in 'projects[${projectName}].actions.build.style.compilations[${i}].output'.`
                    );
                }

                outputFilePath = path.resolve(buildAction._outputPath, styleEntry.output);
            }
        } else {
            const outputFileName = path.basename(inputFilePath).replace(inputExtRegExp, '.css');
            outputFilePath = path.resolve(buildAction._outputPath, outputFileName);
        }

        let includePaths: string[] = [];
        if (styleEntry.includePaths) {
            includePaths = styleEntry.includePaths.map((includePath: string) => path.resolve(projectRoot, includePath));
        } else if (styleOptions.includePaths) {
            includePaths = styleOptions.includePaths.map((includePath: string) =>
                path.resolve(projectRoot, includePath)
            );
        }

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

        let vendorPrefixes: boolean | AutoPrefixerOptions = true;
        if (styleEntry.vendorPrefixes != null) {
            vendorPrefixes = styleEntry.vendorPrefixes;
        } else if (styleOptions.vendorPrefixes != null) {
            vendorPrefixes = styleOptions.vendorPrefixes;
        }

        let minify: boolean | CleanCSSOptions = true;
        if (styleEntry.minify != null) {
            minify = styleEntry.minify;
        } else if (styleOptions.minify != null) {
            minify = styleOptions.minify;
        }

        const minOutputFilePath = path.resolve(
            path.dirname(outputFilePath),
            `${path.parse(outputFilePath).name}.min.css`
        );

        if (!packageJsonStyleEntry && styleOptions.addToPackageJson !== false) {
            packageJsonStyleEntry = normalizePath(path.relative(buildAction._packageJsonOutDir, outputFilePath));
        }

        buildAction._styleEntries.push({
            ...styleEntry,
            _inputFilePath: inputFilePath,
            _outputFilePath: outputFilePath,
            _includePaths: includePaths,
            _sourceMap: sourceMap,
            _sourceMapContents: sourceMapContents,
            _vendorPrefixes: vendorPrefixes,
            _minify: minify,
            _minOutputFilePath: minOutputFilePath
        });
    }

    if (styleOptions.addToPackageJson !== false && packageJsonStyleEntry) {
        buildAction._packageJsonEntryPoint.style = packageJsonStyleEntry;
    }
}
