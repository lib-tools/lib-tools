'use strict';

process.title = 'lib-tools';

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

// main
async function main() {
    const localCliResolvedPath = await new Promise((res) => {
        resolve(
            'lib-tools',
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

    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    const version = packageJson.version;

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
        version,
        isGlobal,
        isLink,
        location,
        startTime
    };

    const cli = require(cliPath);

    try {
        if ('default' in cli) {
            await cli.default();
        } else {
            await cli();
        }
    } catch (err) {
        process.exitCode = -1;
        console.error(err);
        exit(process.exitCode);
    }
}

void main();
