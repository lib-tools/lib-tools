#!/usr/bin/env node

'use strict';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getCliInfo = async () => {
    const packageName = 'lib-tools';

    let packageJsonPath = '';

    try {
        // TODO: experimental
        // resolvedPath = await import.meta.resolve(`${packageName}`);

        const require = createRequire(import.meta.url);
        packageJsonPath = require.resolve(`${packageName}/package.json`);
    } catch (err) {
        // console.error(err);
    }

    if (!packageJsonPath) {
        packageJsonPath = path.resolve(__dirname, '../package.json');
    }

    const content = await fs.readFile(packageJsonPath, { encoding: 'utf-8' });
    const packageJson = JSON.parse(content);
    const version = packageJson.version;
    const cliPath = path.resolve(
        path.dirname(packageJsonPath),
        packageJson.exports ? packageJson.exports : packageJson.main
    );

    return {
        packageName: packageName,
        version: version,
        cliPath: cliPath
    };
};

const runCli = async () => {
    const cliInfo = await getCliInfo();

    process.title = `${cliInfo.packageName} v${cliInfo.version}`;

    let cliRelPath = path.relative(__dirname, cliInfo.cliPath);
    cliRelPath = cliRelPath.replace(/\\/g, '/');
    if (!/^\./.test(cliRelPath)) {
        cliRelPath = './' + cliRelPath;
    }

    const cliModule = await import(cliRelPath);
    const r = await cliModule.default(cliInfo).catch((err) => {
        console.error(err);
        process.exitCode = 1;
    });
};

runCli();
