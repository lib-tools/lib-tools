/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import * as yargs from 'yargs';

import { colorize } from '../utils/colorize';

import { getBuildCommandModule } from './build/build-command-module';

const cliPackageName = global.libCli ? global.libCli.packageName : '';
const cliVersion = global.libCli ? global.libCli.version : '';
const cliIsGlobal = global.libCli ? global.libCli.isGlobal : false;
const cliIsLink = global.libCli ? global.libCli.isLink : false;

function initYargs(): yargs.Argv {
    const cliUsage = `${colorize(`${cliPackageName} v${cliVersion}`, 'white')}\n
Usage:
  lib [command] [options...]`;
    const yargsInstance = yargs
        .usage(cliUsage)
        .example('lib build', 'Build the project(s) using workflows.json configuration file')
        .example('lib build --auto', 'Automatically detect project structure and build without configuration file')
        .example('lib --help', 'Show help')
        .version(false)
        .help('help')
        .option('h', {
            alias: 'help',
            describe: 'Show help',
            type: 'boolean'
        })
        .option('v', {
            alias: 'version',
            describe: 'Show version',
            type: 'boolean',
            global: false
        })
        .command(getBuildCommandModule())
        .showHelpOnFail(false)
        .fail((msg, err, yi) => {
            if (err) {
                throw err;
            }

            yi.showHelp();
            console.error(`\n${colorize(msg, 'red')}`);

            process.exit(1);
        })
        .strict();

    return yargsInstance;
}

export default async function (): Promise<number> {
    const yargsInstance = initYargs();
    yargsInstance.parse();

    const command = yargsInstance.argv._[0] ? yargsInstance.argv._[0].toLowerCase() : undefined;
    const argv = yargsInstance.argv;

    if (command === 'build') {
        // eslint-disable-next-line no-console
        console.log(
            `${colorize(
                `${cliPackageName} v${cliVersion} [${cliIsGlobal ? 'Global' : cliIsLink ? 'Local - link' : 'Local'}]`,
                'white'
            )}\n`
        );

        const cliBuildModule = await import('./build/cli-build');
        const cliBuild = cliBuildModule.cliBuild;

        return cliBuild(argv);
    }

    if (argv.version) {
        // eslint-disable-next-line no-console
        console.log(cliVersion);

        return 0;
    }

    // if (command === 'help') {
    //     yargsInstance.showHelp();

    //     return 0;
    // }

    return 0;
}
