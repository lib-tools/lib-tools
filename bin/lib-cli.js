'use strict';

const startTime = Date.now();

const path = require('path');
const fs = require('fs-extra');
const resolve = require('resolve');

function exit(code) {
    if (process.platform === 'win32' && process.stdout.bufferSize) {
        process.stdout.once('drain', () => {
            process.exit(code);
        });

        return;
    }

    process.exit(code);
}

async function main() {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    const packageName = packageJson.name;
    const version = packageJson.version;

    process.title = `${packageName} v${version}`;

    const localCliResolvedPath = await new Promise((res) => {
        resolve(
            packageName,
            {
                basedir: process.cwd()
            },
            (err, resolvedPath) => {
                if (err) {
                    res(null);
                } else {
                    res(resolvedPath);
                }
            }
        );
    });

    let isGlobal = false;
    let isLink = false;
    let cliPath;

    if (localCliResolvedPath) {
        const localCliRealPath = await fs.realpath(localCliResolvedPath);
        if (localCliRealPath !== localCliResolvedPath) {
            isLink = true;
        }

        cliPath = path.resolve(path.dirname(localCliResolvedPath), './cli');
    } else {
        isGlobal = true;

        const updateNotifier = require('update-notifier');
        updateNotifier({
            pkg: packageJson
        }).notify({
            defer: false
        });

        if (await fs.pathExists(path.resolve(__dirname, '../src/cli/index.js'))) {
            cliPath = '../src/cli';
        } else {
            cliPath = '../dist/src/cli';
        }
    }

    const location = path.dirname(packageJsonPath);

    global.libCli = {
        packageName,
        version,
        isGlobal,
        isLink,
        location,
        startTime
    };

    const cli = require(cliPath);

    try {
        let resultCode;
        if ('default' in cli) {
            resultCode = await cli.default();
        } else {
            resultCode = await cli();
        }

        process.exitCode = resultCode;
        if (resultCode < 0) {
            exit(resultCode);
        }
    } catch (err) {
        process.exitCode = -1;
        console.error(err);
        exit(process.exitCode);
    }
}

void main();
