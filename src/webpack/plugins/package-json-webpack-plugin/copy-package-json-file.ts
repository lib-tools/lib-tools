import * as path from 'path';

import { writeFile } from 'fs-extra';

import { PackageJsonLike, ProjectBuildConfigInternal } from '../../../models/internals';

import { LoggerBase } from '../../../utils';

const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'i');

export async function copyPackageJsonFile(
    projectBuildConfig: ProjectBuildConfigInternal,
    logger: LoggerBase
): Promise<void> {
    if (!projectBuildConfig.packageJsonCopy) {
        return;
    }

    logger.info('Copying and updating package.json');

    // merge config
    // const rootPackageJson: PackageJsonLike = projectBuildConfig._rootPackageJson || {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const packageJson: PackageJsonLike = {
        ...JSON.parse(JSON.stringify(projectBuildConfig._packageJson)),
        ...(projectBuildConfig._packageEntryPoints || {})
    };

    if (packageJson.devDependencies) {
        delete packageJson.devDependencies;
    }

    if (
        projectBuildConfig._rootPackageJson &&
        projectBuildConfig._rootPackageJson.description &&
        (packageJson.description === '' || packageJson.description === '[PLACEHOLDER]')
    ) {
        packageJson.description = projectBuildConfig._rootPackageJson.description;
    }

    if (
        projectBuildConfig._rootPackageJson &&
        projectBuildConfig._rootPackageJson.keywords &&
        packageJson.keywords &&
        !packageJson.keywords.length
    ) {
        packageJson.keywords = projectBuildConfig._rootPackageJson.keywords;
    }

    if (
        projectBuildConfig._rootPackageJson &&
        projectBuildConfig._rootPackageJson.author &&
        (packageJson.author === '' || packageJson.author === '[PLACEHOLDER]')
    ) {
        packageJson.author = projectBuildConfig._rootPackageJson.author;
    }

    if (
        projectBuildConfig._rootPackageJson &&
        projectBuildConfig._rootPackageJson.license &&
        (packageJson.license === '' || packageJson.license === '[PLACEHOLDER]')
    ) {
        packageJson.license = projectBuildConfig._rootPackageJson.license;
    }

    if (
        projectBuildConfig._rootPackageJson &&
        projectBuildConfig._rootPackageJson.repository &&
        (packageJson.repository === '' || packageJson.repository === '[PLACEHOLDER]')
    ) {
        packageJson.repository = projectBuildConfig._rootPackageJson.repository;
    }

    if (
        projectBuildConfig._rootPackageJson &&
        projectBuildConfig._rootPackageJson.homepage &&
        (packageJson.homepage === '' || packageJson.homepage === '[PLACEHOLDER]')
    ) {
        packageJson.homepage = projectBuildConfig._rootPackageJson.homepage;
    }

    if (packageJson.sideEffects == null) {
        packageJson.sideEffects = false;
    }

    if (packageJson.version == null) {
        packageJson.version = projectBuildConfig._packageVersion;
    }

    if (projectBuildConfig.replaceVersionPlaceholder !== false) {
        if (versionPlaceholderRegex.test(packageJson.version as string)) {
            packageJson.version = projectBuildConfig._packageVersion;
        }

        if (packageJson.peerDependencies) {
            const peerDependencies = packageJson.peerDependencies;
            const peerKeys = Object.keys(peerDependencies);
            for (const key of peerKeys) {
                const peerPkgVer = peerDependencies[key] as string;
                if (versionPlaceholderRegex.test(peerPkgVer)) {
                    peerDependencies[key] = peerPkgVer.replace(
                        versionPlaceholderRegex,
                        projectBuildConfig._packageVersion
                    );
                }
            }

            packageJson.peerDependencies = peerDependencies;
        }
    }

    // write package config
    await writeFile(
        path.resolve(projectBuildConfig._packageJsonOutDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
}
