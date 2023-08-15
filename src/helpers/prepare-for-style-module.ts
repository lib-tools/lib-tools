import * as path from 'path';

import * as fs from 'fs-extra';

import { AutoPrefixerOptions, BuildConfigInternal, CssMinimizerPresetOptions } from '../models/index.js';
import { normalizePath } from '../utils/index.js';

const inputExtRegExp = /\.(sass|scss|css)$/i;
const outputExtRegExp = /\.css$/i;

export async function prepareForStyleModule(buildConfig: BuildConfigInternal): Promise<void> {
    if (!buildConfig.style) {
        return;
    }

    const styleOptions = buildConfig.style;

    if (!styleOptions.compilations || !styleOptions.compilations.length) {
        return;
    }

    const projectName = buildConfig._projectName;
    const projectRoot = buildConfig._projectRoot;
    let packageJsonStyleEntry: string | undefined;

    for (let i = 0; i < styleOptions.compilations.length; i++) {
        const styleEntry = styleOptions.compilations[i];
        if (!styleEntry.input || !styleEntry.input.trim().length) {
            throw new Error(
                `Style input file is required, please correct value in 'projects[${projectName}].tasks.build.style.compilations[${i}].input'.`
            );
        }

        if (!inputExtRegExp.test(styleEntry.input)) {
            throw new Error(
                `Unsupported style input file '${styleEntry.input}', please correct value in 'projects[${projectName}].tasks.build.style.compilations[${i}].input'.`
            );
        }

        const inputFilePath = path.resolve(projectRoot, styleEntry.input);
        const inputFileExists = await fs.pathExists(inputFilePath);
        if (!inputFileExists) {
            throw new Error(
                `Style input file '${inputFilePath}' doesn't exist, please correct value in 'projects[${projectName}].tasks.build.style.compilations[${i}].input'.`
            );
        }

        let outputFilePath: string;

        if (styleEntry.output) {
            const extName = path.extname(styleEntry.output);

            if (!extName || styleEntry.output.endsWith('/')) {
                const outputFileName = path.basename(inputFilePath).replace(inputExtRegExp, '.css');
                outputFilePath = path.resolve(buildConfig._outputPath, styleEntry.output, outputFileName);
            } else {
                if (!outputExtRegExp.test(extName)) {
                    throw new Error(
                        `Unsupported style output file '${styleEntry.input}', correct value in 'projects[${projectName}].tasks.build.style.compilations[${i}].output'.`
                    );
                }

                outputFilePath = path.resolve(buildConfig._outputPath, styleEntry.output);
            }
        } else {
            const outputFileName = path.basename(inputFilePath).replace(inputExtRegExp, '.css');
            outputFilePath = path.resolve(buildConfig._outputPath, outputFileName);
        }

        // TODO: To review
        let loadPaths: string[] = [];
        if (styleEntry.loadPaths) {
            loadPaths = styleEntry.loadPaths.map((includePath: string) => path.resolve(projectRoot, includePath));
        } else if (styleOptions.loadPaths) {
            loadPaths = styleOptions.loadPaths.map((includePath: string) => path.resolve(projectRoot, includePath));
        }

        let sourceMap = true;
        if (styleEntry.sourceMap != null) {
            sourceMap = styleEntry.sourceMap;
        } else if (styleOptions.sourceMap != null) {
            sourceMap = styleOptions.sourceMap;
        }

        let sourceMapIncludeSources = true;
        if (styleEntry.sourceMapIncludeSources != null) {
            sourceMapIncludeSources = styleEntry.sourceMapIncludeSources;
        } else if (styleOptions.sourceMapIncludeSources != null) {
            sourceMapIncludeSources = styleOptions.sourceMapIncludeSources;
        }

        let vendorPrefixes: boolean | AutoPrefixerOptions = true;
        if (styleEntry.vendorPrefixes != null) {
            vendorPrefixes = styleEntry.vendorPrefixes;
        } else if (styleOptions.vendorPrefixes != null) {
            vendorPrefixes = styleOptions.vendorPrefixes;
        }

        let minify: boolean | CssMinimizerPresetOptions = true;
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
            packageJsonStyleEntry = normalizePath(path.relative(buildConfig._packageJsonOutDir, outputFilePath));
        }

        buildConfig._styleEntries.push({
            ...styleEntry,
            _inputFilePath: inputFilePath,
            _outputFilePath: outputFilePath,
            _loadPaths: loadPaths,
            _sourceMap: sourceMap,
            _sourceMapIncludeSources: sourceMapIncludeSources,
            _vendorPrefixes: vendorPrefixes,
            _minify: minify,
            _minOutputFilePath: minOutputFilePath
        });
    }

    if (styleOptions.addToPackageJson !== false && packageJsonStyleEntry) {
        buildConfig._packageJsonEntryPoint.style = packageJsonStyleEntry;
    }
}
