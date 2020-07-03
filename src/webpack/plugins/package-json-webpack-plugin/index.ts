import * as path from 'path';

import { ensureDir, writeFile } from 'fs-extra';
import * as webpack from 'webpack';

import { PackageJsonLike, ProjectBuildConfigInternal } from '../../../models/internals';
import { LogLevelString, Logger } from '../../../utils';

const placeholderRegExp = /\[PLACEHOLDER\]/;
const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER');

export interface PackageJsonFileWebpackPluginOptions {
    projectBuildConfig: ProjectBuildConfigInternal;
    logLevel?: LogLevelString;
}

export class PackageJsonFileWebpackPlugin {
    private readonly logger: Logger;
    private readonly projectBuildConfig: ProjectBuildConfigInternal;

    get name(): string {
        return 'package-json-webpack-plugin';
    }

    constructor(private readonly options: PackageJsonFileWebpackPluginOptions) {
        this.logger = new Logger({
            logLevel: this.options.logLevel || 'info',
            debugPrefix: `[${this.name}]`,
            infoPrefix: ''
        });
        this.projectBuildConfig = this.options.projectBuildConfig;
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async () => this.copyPackageJsonFile());
    }

    async copyPackageJsonFile(): Promise<void> {
        if (!this.projectBuildConfig._shouldCopyPackageJson) {
            return;
        }

        this.logger.info('Copying and updating package.json file');

        // merge config
        const packageJson: PackageJsonLike = {
            ...JSON.parse(JSON.stringify(this.projectBuildConfig._packageJson)),
            ...(this.projectBuildConfig._packageEntryPoints || {})
        };

        const rootPackageJson = this.projectBuildConfig._rootPackageJson;
        const packageJsonPathAreEqual =
            this.projectBuildConfig._rootPackageJsonPath === this.projectBuildConfig._packageJsonPath;
        const nestedPackage = this.projectBuildConfig._nestedPackage;

        if (packageJson.devDependencies) {
            delete packageJson.devDependencies;
        }

        if (rootPackageJson && !packageJsonPathAreEqual) {
            if (
                rootPackageJson.description &&
                (packageJson.description === '' ||
                    packageJson.description === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.description))
            ) {
                packageJson.description = rootPackageJson.description;
            }

            if (
                rootPackageJson.keywords &&
                rootPackageJson.keywords.length &&
                ((packageJson.keywords && !packageJson.keywords.length) || (!nestedPackage && !packageJson.keywords))
            ) {
                packageJson.keywords = [...rootPackageJson.keywords];
            }

            if (
                rootPackageJson.author &&
                (packageJson.author === '' ||
                    packageJson.author === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.author))
            ) {
                packageJson.author =
                    typeof rootPackageJson.author === 'string' ? rootPackageJson.author : { ...rootPackageJson.author };
            }

            if (
                rootPackageJson.license &&
                (packageJson.license === '' ||
                    packageJson.license === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.license))
            ) {
                packageJson.license = rootPackageJson.license;
            }

            if (
                rootPackageJson.repository &&
                (packageJson.repository === '' ||
                    packageJson.repository === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.repository))
            ) {
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
                packageJson.bugs =
                    typeof rootPackageJson.bugs === 'string' ? rootPackageJson.bugs : { ...rootPackageJson.bugs };
            }

            if (
                rootPackageJson.homepage &&
                (packageJson.homepage === '' ||
                    packageJson.homepage === '[PLACEHOLDER]' ||
                    (!nestedPackage && !packageJson.homepage))
            ) {
                packageJson.homepage = rootPackageJson.homepage;
            }
        }

        if (
            packageJson.sideEffects == null &&
            ((this.projectBuildConfig._tsTranspilations && this.projectBuildConfig._tsTranspilations.length) ||
                (this.projectBuildConfig._bundles && this.projectBuildConfig._bundles.length))
        ) {
            packageJson.sideEffects = false;
        }

        if (!packageJson.version) {
            packageJson.version = this.projectBuildConfig._packageVersion;
        }

        if (versionPlaceholderRegex.test(packageJson.version) || placeholderRegExp.test(packageJson.version)) {
            packageJson.version = this.projectBuildConfig._packageVersion;
        }

        if (packageJson.peerDependencies) {
            const peerDependencies = packageJson.peerDependencies;
            const peerKeys = Object.keys(peerDependencies);
            for (const key of peerKeys) {
                const peerPkgVer = peerDependencies[key];
                if (versionPlaceholderRegex.test(peerPkgVer)) {
                    peerDependencies[key] = peerPkgVer.replace(
                        versionPlaceholderRegex,
                        this.projectBuildConfig._packageVersion
                    );
                } else if (placeholderRegExp.test(peerPkgVer)) {
                    peerDependencies[key] = peerPkgVer.replace(
                        placeholderRegExp,
                        this.projectBuildConfig._packageVersion
                    );
                }
            }

            packageJson.peerDependencies = peerDependencies;
        }

        // write package config
        await ensureDir(this.projectBuildConfig._packageJsonOutDir);
        await writeFile(
            path.resolve(this.projectBuildConfig._packageJsonOutDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
    }
}
