'use strict';

process.title = 'lib-tools';

const startTime = Date.now();

const fs = require('fs');
const path = require('path');
const util = require('util');

const resolve = require('resolve');

const realpathAsync = util.promisify(fs.realpath);
const statAsync = util.promisify(fs.stat);

const resolveAsync = (id, opts) => {
    return new Promise((res) => {
        resolve(id, opts, (err, resolvedPath) => {
            if (err) {
                res(null);
            } else {
                res(resolvedPath);
            }
        });
    });
};

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
    const localCli = await resolveAsync('lib-tools', {
        basedir: process.cwd()
    });

    let cliIsGlobal = true;
    let cliIsLink = false;
    let tempCliPath;

    if (localCli) {
        const localCliRealPath = await realpathAsync(localCli);
        if (localCliRealPath !== localCli) {
            cliIsLink = true;
        }

        tempCliPath = path.dirname(localCli);
        cliIsGlobal = false;
    } else {
        tempCliPath = path.resolve(__dirname, '..');
        cliIsGlobal = true;
    }

    let packageJsonPath = '';

    try {
        const packageJsonFileStat = await statAsync(path.resolve(tempCliPath, './package.json'));
        if (packageJsonFileStat.isFile()) {
            const nodeModulesStat = await statAsync(path.resolve(tempCliPath, 'node_modules'));
            if (nodeModulesStat.isDirectory()) {
                packageJsonPath = path.resolve(tempCliPath, './package.json');
            }
        }
    } catch (err) {
        // Do nothing
    }

    if (!packageJsonPath) {
        try {
            const packageJsonFileStat = await statAsync(path.resolve(tempCliPath, '..', './package.json'));
            if (packageJsonFileStat.isFile()) {
                packageJsonPath = path.resolve(tempCliPath, '..', './package.json');
            }
        } catch (err) {
            // Do nothing
        }
    }

    if (!packageJsonPath) {
        console.error('Could not detect package.json file path.');
        process.exitCode = -1;

        return;
    }

    const packageJson = require(packageJsonPath);
    const cliVersion = packageJson.version;
    let cli;

    if (localCli) {
        const localCliPath = path.resolve(path.dirname(localCli), './cli');
        cli = require(localCliPath);
    } else {
        const updateNotifier = require('update-notifier');
        updateNotifier({
            pkg: packageJson
        }).notify({
            defer: false
        });

        try {
            const cliFileStat = await statAsync(path.resolve(__dirname, '../src/cli/index.js'));
            if (cliFileStat.isFile()) {
                cli = require('../src/cli');
            } else {
                cli = require('../dist/src/cli');
            }
        } catch (err) {
            cli = require('../dist/src/cli');
        }
    }

    const cliParams = {
        cliVersion,
        cliIsGlobal,
        cliIsLink,
        cliRootPath: path.dirname(packageJsonPath),
        startTime
    };

    if ('default' in cli) {
        cli = cli.default;
    }

    try {
        await cli(cliParams);
    } catch (err) {
        process.exitCode = -1;
        console.error(`${err.stack || err.message || err}`);
        exit(process.exitCode);
    }
}

void main();
