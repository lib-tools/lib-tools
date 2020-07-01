import * as yargs from 'yargs';

import { colorize } from '../utils/colorize';

import { getBuildCommandModule } from './build/build-command-module';

const cliVersion = (global.libCli as { version: string }).version;
const cliIsGlobal = (global.libCli as { isGlobal: boolean }).isGlobal;
const cliIsLink = (global.libCli as { isLink: boolean }).isLink;

function initYargs(args?: string[]): yargs.Argv {
    const cliUsage = `${colorize(`lib-tools ${cliVersion}`, 'white')}\n
Usage:
  lib [options...]`;

    if (args) {
        yargs.parse(args);
    }

    const yargsInstance = yargs
        .usage(cliUsage)
        .example('lib build', 'Bundle the project(s)')
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
        })
        .command(getBuildCommandModule(cliVersion));

    return yargsInstance;
}

export default async function (): Promise<number> {
    let args = process.argv.slice(2);
    let isHelpCommand = false;
    if (args.includes('help')) {
        isHelpCommand = true;
        args = args.filter((p: string) => p !== 'help');
        args.push('-h');
    } else if (args.includes('--help')) {
        isHelpCommand = true;
        args = args.filter((p: string) => p !== '--help');
        args.push('-h');
    }

    const yargsInstance = initYargs(args);
    const command = yargsInstance.argv._[0] ? yargsInstance.argv._[0].toLowerCase() : undefined;
    const argv = yargsInstance.argv;

    if (command === 'build') {
        // eslint-disable-next-line no-console
        console.log(
            `${colorize(
                `lib-tools ${cliVersion} [${cliIsGlobal ? 'Global' : cliIsLink ? 'Local - link' : 'Local'}]`,
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

    if (command === 'help' || argv.help || isHelpCommand) {
        yargsInstance.showHelp();

        return 0;
    }

    yargsInstance.showHelp();

    return 0;
}
