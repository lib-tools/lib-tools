import * as path from 'path';

import { writeFile } from 'fs-extra';

import { InvalidConfigError } from '../../../../models/errors';
import { ProjectConfigInternal } from '../../../../models/internals';
import { LoggerBase } from '../../../../utils';

const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'i');

export async function performPackageJsonCopy(libConfig: ProjectConfigInternal, logger: LoggerBase): Promise<void> {
    if (!libConfig.packageJsonCopy) {
        return;
    }

    // validation
    if (!libConfig._packageJsonOutDir || !libConfig.outputPath) {
        throw new InvalidConfigError(
            `The 'projects[${libConfig.name || libConfig._index}].outputPath' value is required.`
        );
    }

    if (!libConfig._packageJson) {
        throw new InvalidConfigError('Could not detect package.json file.');
    }

    logger.info('Copying and updating package.json');

    // merge config
    const rootPackageJson = libConfig._rootPackageJson || {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const packageJson: { [key: string]: any } = {
        ...JSON.parse(JSON.stringify(libConfig._packageJson)),
        ...(libConfig._packageEntryPoints || {})
    };

    if (packageJson.devDependencies) {
        delete packageJson.devDependencies;
    }

    if (
        rootPackageJson.description &&
        (packageJson.description === '' || packageJson.description === '[PLACEHOLDER]')
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        packageJson.description = rootPackageJson.description;
    }
    if (
        rootPackageJson.keywords &&
        (packageJson.keywords === '' ||
            packageJson.keywords === '[PLACEHOLDER]' ||
            (packageJson.keywords && !(packageJson.keywords as string[]).length))
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        packageJson.keywords = rootPackageJson.keywords;
    }
    if (rootPackageJson.author && (packageJson.author === '' || packageJson.author === '[PLACEHOLDER]')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        packageJson.author = rootPackageJson.author;
    }
    if (rootPackageJson.license && (packageJson.license === '' || packageJson.license === '[PLACEHOLDER]')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        packageJson.license = rootPackageJson.license;
    }
    if (rootPackageJson.repository && (packageJson.repository === '' || packageJson.repository === '[PLACEHOLDER]')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        packageJson.repository = rootPackageJson.repository;
    }
    if (rootPackageJson.homepage && (packageJson.homepage === '' || packageJson.homepage === '[PLACEHOLDER]')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        packageJson.homepage = rootPackageJson.homepage;
    }
    if (packageJson.sideEffects == null) {
        packageJson.sideEffects = false;
    }

    if (libConfig._projectVersion && packageJson.version == null) {
        packageJson.version = libConfig._projectVersion;
    }

    if (libConfig.replaceVersionPlaceholder !== false && libConfig._projectVersion) {
        if (versionPlaceholderRegex.test(packageJson.version as string)) {
            packageJson.version = libConfig._projectVersion;
        }
        if (packageJson.peerDependencies) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const peerDependencies = packageJson.peerDependencies;
            const peerKeys = Object.keys(peerDependencies);
            for (const key of peerKeys) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const peerPkgVer = peerDependencies[key] as string;
                if (versionPlaceholderRegex.test(peerPkgVer)) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    peerDependencies[key] = peerPkgVer.replace(versionPlaceholderRegex, libConfig._projectVersion);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            packageJson.peerDependencies = peerDependencies;
        }
    }

    // write package config
    await writeFile(path.resolve(libConfig._packageJsonOutDir, 'package.json'), JSON.stringify(packageJson, null, 2));
}
