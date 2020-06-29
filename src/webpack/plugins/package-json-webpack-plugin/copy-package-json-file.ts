import * as path from 'path';

import { writeFile } from 'fs-extra';

import { PackageJsonLike, ProjectConfigBuildInternal } from '../../../models/internals';

import { LoggerBase } from '../../../utils';

const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'i');

export async function copyPackageJsonFile(
    projectConfig: ProjectConfigBuildInternal,
    logger: LoggerBase
): Promise<void> {
    if (!projectConfig.packageJsonCopy) {
        return;
    }

    logger.info('Copying and updating package.json');

    // merge config
    // const rootPackageJson: PackageJsonLike = projectConfig._rootPackageJson || {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const packageJson: PackageJsonLike = {
        ...JSON.parse(JSON.stringify(projectConfig._packageJson)),
        ...(projectConfig._packageEntryPoints || {})
    };

    if (packageJson.devDependencies) {
        delete packageJson.devDependencies;
    }

    if (
        projectConfig._rootPackageJson &&
        projectConfig._rootPackageJson.description &&
        (packageJson.description === '' || packageJson.description === '[PLACEHOLDER]')
    ) {
        packageJson.description = projectConfig._rootPackageJson.description;
    }

    if (
        projectConfig._rootPackageJson &&
        projectConfig._rootPackageJson.keywords &&
        packageJson.keywords &&
        !packageJson.keywords.length
    ) {
        packageJson.keywords = projectConfig._rootPackageJson.keywords;
    }

    if (
        projectConfig._rootPackageJson &&
        projectConfig._rootPackageJson.author &&
        (packageJson.author === '' || packageJson.author === '[PLACEHOLDER]')
    ) {
        packageJson.author = projectConfig._rootPackageJson.author;
    }

    if (
        projectConfig._rootPackageJson &&
        projectConfig._rootPackageJson.license &&
        (packageJson.license === '' || packageJson.license === '[PLACEHOLDER]')
    ) {
        packageJson.license = projectConfig._rootPackageJson.license;
    }

    if (
        projectConfig._rootPackageJson &&
        projectConfig._rootPackageJson.repository &&
        (packageJson.repository === '' || packageJson.repository === '[PLACEHOLDER]')
    ) {
        packageJson.repository = projectConfig._rootPackageJson.repository;
    }

    if (
        projectConfig._rootPackageJson &&
        projectConfig._rootPackageJson.homepage &&
        (packageJson.homepage === '' || packageJson.homepage === '[PLACEHOLDER]')
    ) {
        packageJson.homepage = projectConfig._rootPackageJson.homepage;
    }

    if (packageJson.sideEffects == null) {
        packageJson.sideEffects = false;
    }

    if (packageJson.version == null) {
        packageJson.version = projectConfig._packageVersion;
    }

    if (projectConfig.replaceVersionPlaceholder !== false) {
        if (versionPlaceholderRegex.test(packageJson.version as string)) {
            packageJson.version = projectConfig._packageVersion;
        }

        if (packageJson.peerDependencies) {
            const peerDependencies = packageJson.peerDependencies;
            const peerKeys = Object.keys(peerDependencies);
            for (const key of peerKeys) {
                const peerPkgVer = peerDependencies[key] as string;
                if (versionPlaceholderRegex.test(peerPkgVer)) {
                    peerDependencies[key] = peerPkgVer.replace(versionPlaceholderRegex, projectConfig._packageVersion);
                }
            }

            packageJson.peerDependencies = peerDependencies;
        }
    }

    // write package config
    await writeFile(
        path.resolve(projectConfig._packageJsonOutDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
}
