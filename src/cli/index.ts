import * as yargs from 'yargs';

import { colorize } from '../utils/colorize';

const cliPackageName = global.libCli ? global.libCli.packageName : '';
const cliVersion = global.libCli ? global.libCli.version : '';
const cliIsGlobal = global.libCli ? global.libCli.isGlobal : false;
const cliIsLink = global.libCli ? global.libCli.isLink : false;

function initYargs(): yargs.Argv {
    const cliUsage = `${colorize(`${cliPackageName} v${cliVersion}`, 'white')}\n
                        Usage:
                        lib [command] [options...]`;
    const buildCommandUsage = `${colorize(`${cliPackageName} v${cliVersion}`, 'white')}\n
                        Usage:
                            lib build [options...]`;

    const yargsInstance = yargs
        .usage(cliUsage)
        .example('lib build', 'Build the project(s) using workflow.json configuration file')
        .example('lib --workflow=auto', 'Determine and run workflow actions for the project structure automatically.')
        .example('lib --help', 'Show help')
        .option('workflow', {
            describe:
                'The workflow configuration file location for set `auto` to determine and run workflow actions for the project structure automatically.',
            type: 'string'
        })
        .option('env', {
            alias: 'environment',
            describe: 'Define the environment.'
        })
        .option('prod', {
            describe: 'Shortcut flag to set environment to `production`.',
            type: 'boolean'
        })
        .option('filter', {
            describe: 'Run specific project(s) filtering by project name(s).',
            type: 'array'
        })
        .option('logLevel', {
            describe: 'Logging level for output information.',
            type: 'string'
        })
        .option('verbose', {
            describe: 'Shortcut flag to set logLevel to `debug`.',
            type: 'boolean'
        })
        .option('beep', {
            describe: 'Beep when all workflow actions completed.',
            type: 'boolean'
        })
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
        .command(
            'build',
            'Build the project(s)',
            (childYargs) => {
                return childYargs
                    .usage(buildCommandUsage)
                    .example('lib build', 'Build the project(s).')
                    .option('version', {
                        describe: 'Set the version to override the version fields of the package.json files.',
                        type: 'string'
                    });
            },
            () => {
                // Do nothing
            }
        )
        .version(false)
        .help('help')
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

    return 0;
}
