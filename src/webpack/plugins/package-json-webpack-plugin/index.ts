import * as path from 'path';

import { ensureDir, pathExists, writeFile } from 'fs-extra';
import * as webpack from 'webpack';

import { BuildActionInternal, PackageJsonLike } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

const placeholderRegExp = /\[PLACEHOLDER\]/;
const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER');

export interface PackageJsonFileWebpackPluginOptions {
    buildAction: BuildActionInternal;
    logLevel?: LogLevelString;
}

export class PackageJsonFileWebpackPlugin {
    private readonly logger: Logger;
    // private packageJsonHasAnyChanges = false;

    get name(): string {
        return 'package-json-webpack-plugin';
    }

    constructor(private readonly options: PackageJsonFileWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => this.preparePackageJsonFile());
    }

    private async preparePackageJsonFile(): Promise<void> {
        const buildAction = this.options.buildAction;
        const packageJson = JSON.parse(JSON.stringify(buildAction._packageJson)) as PackageJsonLike;
        let packageJsonChanged = false;

        this.logger.debug('Checking package.json file');

        // Update entry points
        Object.keys(buildAction._packageJsonEntryPoint).forEach((key) => {
            packageJsonChanged = true;
            this.logger.debug(`Updating package entry point '${key}'`);
            packageJson[key] = buildAction._packageJsonEntryPoint[key];
        });

        const rootPackageJson = buildAction._rootPackageJson;
        const packageJsonPathAreEqual = buildAction._rootPackageJsonPath === buildAction._packageJsonPath;
        const nestedPackage = buildAction._nestedPackage;

        if (packageJson.devDependencies) {
            packageJsonChanged = true;
            this.logger.debug(`Removing 'devDependencies' field from package.json`);
            delete packageJson.devDependencies;
        }

        if (rootPackageJson && !packageJsonPathAreEqual) {
            if (
                rootPackageJson.description &&
                (packageJson.description === '' ||
                    packageJson.description === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.description))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'description' field in package.json`);
                packageJson.description = rootPackageJson.description;
            }

            if (
                rootPackageJson.keywords &&
                rootPackageJson.keywords.length &&
                ((packageJson.keywords && !packageJson.keywords.length) || (!nestedPackage && !packageJson.keywords))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'keywords' field in package.json`);
                packageJson.keywords = [...rootPackageJson.keywords];
            }

            if (
                rootPackageJson.author &&
                (packageJson.author === '' ||
                    packageJson.author === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.author))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'author' field in package.json`);
                packageJson.author =
                    typeof rootPackageJson.author === 'string' ? rootPackageJson.author : { ...rootPackageJson.author };
            }

            if (
                rootPackageJson.license &&
                (packageJson.license === '' ||
                    packageJson.license === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.license))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'license' field in package.json`);
                packageJson.license = rootPackageJson.license;
            }

            if (
                rootPackageJson.repository &&
                (packageJson.repository === '' ||
                    packageJson.repository === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.repository))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'repository' field in package.json`);
                packageJson.repository =
                    typeof rootPackageJson.repository === 'string'
                        ? rootPackageJson.repository
                        : { ...rootPackageJson.repository };
            }

            if (
                rootPackageJson.bugs &&
                (packageJson.bugs === '' ||
                    packageJson.bugs === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.bugs))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'bugs' field in package.json`);
                packageJson.bugs =
                    typeof rootPackageJson.bugs === 'string' ? rootPackageJson.bugs : { ...rootPackageJson.bugs };
            }

            if (
                rootPackageJson.homepage &&
                (packageJson.homepage === '' ||
                    packageJson.homepage === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.homepage))
            ) {
                packageJsonChanged = true;
                this.logger.debug(`Updating 'homepage' field in package.json`);
                packageJson.homepage = rootPackageJson.homepage;
            }
        }

        if (
            packageJson.sideEffects == null &&
            ((buildAction._script && buildAction._script._compilations.length) || buildAction._script?._bundles.length)
        ) {
            packageJsonChanged = true;
            this.logger.debug(`Updating 'sideEffects' field in package.json`);
            packageJson.sideEffects = false;
        }

        if (
            !packageJson.version ||
            packageJson.version !== buildAction._packageVersion ||
            versionPlaceholderRegex.test(packageJson.version) ||
            placeholderRegExp.test(packageJson.version)
        ) {
            packageJsonChanged = true;
            this.logger.debug(`Updating 'version' field in package.json`);
            packageJson.version = buildAction._packageVersion;
        }

        if (packageJson.peerDependencies) {
            let logged = false;
            const peerDependencies = packageJson.peerDependencies;
            const peerKeys = Object.keys(peerDependencies);
            for (const key of peerKeys) {
                const peerPkgVer = peerDependencies[key];
                if (versionPlaceholderRegex.test(peerPkgVer)) {
                    packageJsonChanged = true;
                    if (!logged) {
                        this.logger.debug(`Replacing version placeholder in package.json -> peerDependencies`);
                        logged = true;
                    }

                    peerDependencies[key] = peerPkgVer.replace(versionPlaceholderRegex, buildAction._packageVersion);
                } else if (placeholderRegExp.test(peerPkgVer)) {
                    packageJsonChanged = true;
                    if (!logged) {
                        this.logger.debug(`Replacing version placeholder in package.json -> peerDependencies`);
                        logged = true;
                    }

                    peerDependencies[key] = peerPkgVer.replace(placeholderRegExp, buildAction._packageVersion);
                }
            }

            packageJson.peerDependencies = peerDependencies;
        }

        // write package config
        const packageJsonOutFilePath = path.resolve(buildAction._packageJsonOutDir, 'package.json');
        const packageJsonOutFileExists = await pathExists(packageJsonOutFilePath);

        if (!packageJsonOutFileExists || packageJsonChanged) {
            if (!packageJsonOutFileExists) {
                this.logger.info(`Copying package.json file`);
            } else {
                this.logger.info(`Updating package.json file`);
            }

            await ensureDir(buildAction._packageJsonOutDir);
            await writeFile(packageJsonOutFilePath, JSON.stringify(packageJson, null, 2));
        }
    }
}
