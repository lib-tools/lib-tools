import * as path from 'path';

import { ensureDir, pathExists, writeFile } from 'fs-extra';
import * as webpack from 'webpack';

import { BuildConfigInternal, PackageJsonLike } from '../../../models';
import { LogLevelString, Logger } from '../../../utils';

const placeholderRegExp = /\[PLACEHOLDER\]/;
const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER');

export interface PackageJsonFileWebpackPluginOptions {
    buildConfig: BuildConfigInternal;
    logLevel?: LogLevelString;
}

export class PackageJsonFileWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'package-json-webpack-plugin';
    }

    constructor(private readonly options: PackageJsonFileWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => this.processPackageJsonFile());
    }

    private async processPackageJsonFile(): Promise<void> {
        const buildConfig = this.options.buildConfig;
        const packageJson = JSON.parse(JSON.stringify(buildConfig._packageJson)) as PackageJsonLike;
        let packageJsonChanged = false;

        this.logger.debug('Checking package.json file');

        // Update entry points
        const entryPointKeys = Object.keys(buildConfig._packageJsonEntryPoint);
        for (const entryPointKey of entryPointKeys) {
            const entryPointValue = buildConfig._packageJsonEntryPoint[entryPointKey];
            if (!(await pathExists(path.resolve(buildConfig._packageJsonOutDir, entryPointValue)))) {
                throw new Error(`Internal error, entry point: ${entryPointValue} doesn't exists.`);
            }

            packageJsonChanged = true;
            this.logger.debug(`Adding entry point '${entryPointKey}' to package.json`);
            packageJson[entryPointKey] = entryPointValue;
        }

        const rootPackageJson = buildConfig._rootPackageJson;
        const packageJsonPathAreEqual = buildConfig._rootPackageJsonPath === buildConfig._packageJsonPath;
        const nestedPackage = buildConfig._nestedPackage;

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
            ((buildConfig._script && buildConfig._script._compilations.length) || buildConfig._script?._bundles.length)
        ) {
            packageJsonChanged = true;
            this.logger.debug(`Updating 'sideEffects' field in package.json`);
            packageJson.sideEffects = false;
        }

        if (
            !packageJson.version ||
            packageJson.version !== buildConfig._packageVersion ||
            versionPlaceholderRegex.test(packageJson.version) ||
            placeholderRegExp.test(packageJson.version)
        ) {
            packageJsonChanged = true;
            this.logger.debug(`Updating 'version' field in package.json`);
            packageJson.version = buildConfig._packageVersion;
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

                    peerDependencies[key] = peerPkgVer.replace(versionPlaceholderRegex, buildConfig._packageVersion);
                } else if (placeholderRegExp.test(peerPkgVer)) {
                    packageJsonChanged = true;
                    if (!logged) {
                        this.logger.debug(`Replacing version placeholder in package.json -> peerDependencies`);
                        logged = true;
                    }

                    peerDependencies[key] = peerPkgVer.replace(placeholderRegExp, buildConfig._packageVersion);
                }
            }

            packageJson.peerDependencies = peerDependencies;
        }

        // write package config
        const packageJsonOutFilePath = path.resolve(buildConfig._packageJsonOutDir, 'package.json');
        const packageJsonOutFileExists = await pathExists(packageJsonOutFilePath);

        if (!packageJsonOutFileExists || packageJsonChanged) {
            if (!packageJsonOutFileExists) {
                this.logger.info(`Copying package.json file`);
            } else {
                this.logger.info(`Updating package.json file`);
            }

            await ensureDir(buildConfig._packageJsonOutDir);
            await writeFile(packageJsonOutFilePath, JSON.stringify(packageJson, null, 2));
        }
    }
}
