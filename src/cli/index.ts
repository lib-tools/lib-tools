import * as yargs from 'yargs';

import { colorize } from '../utils/colorize';

function initYargs(cliVersion: string, args?: string[]): yargs.Argv {
    const cliUsage = `\n${colorize(`lib-tools ${cliVersion}`, 'white')}\n
Usage:
  lib [options...]`;

    if (args) {
        yargs.parse(args);
    }

    const yargsInstance = yargs
        .usage(cliUsage)
        .example('lib build', 'Bundle and pack the project(s)')
        .example('lib -h', 'Show help')
        .version(false)
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
        });

    return yargsInstance;
}

export default async function (cliParams: {
    cliVersion: string;
    cliIsGlobal?: boolean;
    cliRootPath?: string;
    startTime?: number;
    cliIsLink?: boolean;
}): Promise<number> {
    const args = process.argv.slice(2);
    const yargsInstance = initYargs(cliParams.cliVersion, args);
    const commandOptions = yargsInstance.argv;

    if (commandOptions.version) {
        // console.log(cliParams.cliVersion);

        return 0;
    } else if (commandOptions.help) {
        // yargsInstance.showHelp();

        return 0;
    } else {
        // eslint-disable-next-line no-console
        console.log(
            `${colorize(
                `\nlib-tools ${cliParams.cliVersion} [${
                    cliParams.cliIsGlobal ? 'Global' : cliParams.cliIsLink ? 'Local - link' : 'Local'
                }]`,
                'white'
            )}\n`
        );

        return Promise.resolve(0);
        // Dynamic require
        // const cliPackModule = await import('./cli-pack');
        // const cliPack = cliPackModule.cliPack;

        // return cliPack();
    }
}
