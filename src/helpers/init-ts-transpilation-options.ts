import * as path from 'path';

import { pathExists } from 'fs-extra';
import { ModuleKind, ScriptTarget } from 'typescript';

import { InternalError } from '../models/errors';
import { LibProjectConfigInternal, TsTranspilationOptionsInternal } from '../models/internals';
import { isInFolder, isSamePaths, normalizeRelativePath } from '../utils';

import { loadTsConfig } from './load-ts-config';
import { toTsScriptTarget } from './to-ts-script-target';

export async function initTsTranspilationOptions(
    tsConfigPath: string,
    tsTranspilation: Partial<TsTranspilationOptionsInternal>,
    i: number,
    libConfig: LibProjectConfigInternal
): Promise<TsTranspilationOptionsInternal> {
    if (!libConfig._outputPath) {
        throw new InternalError("The 'libConfig._outputPath' is not set.");
    }

    loadTsConfig(tsConfigPath, tsTranspilation, libConfig);

    if (!tsTranspilation._tsCompilerConfig) {
        throw new InternalError("The 'tsTranspilation._tsCompilerConfig' is not set.");
    }

    const outputRootDir = libConfig._outputPath;
    const compilerOptions = tsTranspilation._tsCompilerConfig.options;

    // scriptTarget
    let scriptTarget: ScriptTarget = ScriptTarget.ES2015;
    if (tsTranspilation.target) {
        const tsScriptTarget = toTsScriptTarget(tsTranspilation.target as string);
        if (tsScriptTarget) {
            scriptTarget = tsScriptTarget;
        }
    } else if (compilerOptions.target) {
        scriptTarget = compilerOptions.target;
    }

    // declaration
    let declaration = true;
    if (tsTranspilation.declaration === false) {
        declaration = false;
    } else if (!tsTranspilation.declaration && !compilerOptions.declaration) {
        declaration = false;
    }

    // tsOutDir
    let tsOutDir: string;
    if (tsTranspilation.outDir) {
        tsOutDir = path.resolve(outputRootDir, tsTranspilation.outDir);
        tsTranspilation._customTsOutDir = tsOutDir;
    } else {
        if (compilerOptions.outDir) {
            tsOutDir = path.isAbsolute(compilerOptions.outDir)
                ? path.resolve(compilerOptions.outDir)
                : path.resolve(path.dirname(tsConfigPath), compilerOptions.outDir);
        } else {
            tsOutDir = outputRootDir;
            tsTranspilation._customTsOutDir = tsOutDir;
        }
    }
    if (compilerOptions.rootDir && !isSamePaths(compilerOptions.rootDir, path.dirname(tsConfigPath))) {
        const relSubDir = isInFolder(compilerOptions.rootDir, path.dirname(tsConfigPath))
            ? normalizeRelativePath(path.relative(compilerOptions.rootDir, path.dirname(tsConfigPath)))
            : normalizeRelativePath(path.relative(path.dirname(tsConfigPath), compilerOptions.rootDir));
        tsOutDir = path.resolve(tsOutDir, relSubDir);
    }

    // typingsOutDir
    if (declaration) {
        tsTranspilation._typingsOutDir = libConfig._packageJsonOutDir || tsOutDir;
    }

    // detect entry
    if (libConfig.main) {
        tsTranspilation._detectedEntryName = libConfig.main.replace(/\.(js|jsx|ts|tsx)$/i, '');
    } else {
        const flatModuleOutFile =
            tsTranspilation._angularCompilerOptions && tsTranspilation._angularCompilerOptions.flatModuleOutFile
                ? (tsTranspilation._angularCompilerOptions.flatModuleOutFile as string)
                : null;

        if (flatModuleOutFile) {
            tsTranspilation._detectedEntryName = flatModuleOutFile.replace(/\.js$/i, '');
        } else {
            const tsSrcDir = path.dirname(tsConfigPath);
            if (await pathExists(path.resolve(tsSrcDir, 'index.ts'))) {
                tsTranspilation._detectedEntryName = 'index';
            } else if (await pathExists(path.resolve(tsSrcDir, 'main.ts'))) {
                tsTranspilation._detectedEntryName = 'main';
            }
        }
    }

    // package entry points
    if (libConfig._packageJsonOutDir && tsTranspilation._detectedEntryName) {
        libConfig._packageEntryPoints = libConfig._packageEntryPoints || {};
        const packageEntryPoints = libConfig._packageEntryPoints;
        const packageJsonOutDir = libConfig._packageJsonOutDir;

        const entryFileAbs = path.resolve(tsOutDir, `${tsTranspilation._detectedEntryName}.js`);

        if (
            (compilerOptions.module === ModuleKind.ES2015 || compilerOptions.module === ModuleKind.ESNext) &&
            (tsTranspilation.target === 'es2015' ||
                (!tsTranspilation.target && compilerOptions.target === ScriptTarget.ES2015))
        ) {
            packageEntryPoints.es2015 = normalizeRelativePath(path.relative(packageJsonOutDir, entryFileAbs));
            // It is deprecated as of v9, might be removed in the future.
            packageEntryPoints.esm2015 = packageEntryPoints.es2015;
        } else if (
            (compilerOptions.module === ModuleKind.ES2015 || compilerOptions.module === ModuleKind.ESNext) &&
            (tsTranspilation.target === 'es5' ||
                (!tsTranspilation.target && compilerOptions.target === ScriptTarget.ES5))
        ) {
            packageEntryPoints.esm5 = normalizeRelativePath(path.relative(packageJsonOutDir, entryFileAbs));
            packageEntryPoints.module = packageEntryPoints.esm5;
        } else if (compilerOptions.module === ModuleKind.UMD || compilerOptions.module === ModuleKind.CommonJS) {
            packageEntryPoints.main = normalizeRelativePath(path.relative(packageJsonOutDir, entryFileAbs));
        }

        if (declaration && tsTranspilation._typingsOutDir) {
            if (libConfig._isNestedPackage && libConfig._packageNameWithoutScope) {
                const typingEntryName = libConfig._packageNameWithoutScope.substr(
                    libConfig._packageNameWithoutScope.lastIndexOf('/') + 1
                );

                packageEntryPoints.typings = normalizeRelativePath(
                    path.relative(packageJsonOutDir, path.join(outputRootDir, `${typingEntryName}.d.ts`))
                );
            } else {
                packageEntryPoints.typings = normalizeRelativePath(
                    path.relative(
                        packageJsonOutDir,
                        path.join(tsTranspilation._typingsOutDir, `${tsTranspilation._detectedEntryName}.d.ts`)
                    )
                );
            }
        }
    }

    return {
        ...tsTranspilation,
        _index: i,
        _scriptTarget: scriptTarget,
        _tsConfigPath: tsConfigPath,
        _tsConfigJson: tsTranspilation._tsConfigJson as { [key: string]: string | boolean | {} },
        _tsCompilerConfig: tsTranspilation._tsCompilerConfig,
        _declaration: declaration,
        _tsOutDirRootResolved: tsOutDir
    };
}
