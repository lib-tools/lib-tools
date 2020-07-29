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
        .example('lib build', 'Build the project(s) using workflow.json configuration file.')
        .example('lib build --workflow=auto', 'Analyze project structure and build automatically.')
        .example('lib --help', 'Show help')
        .command(
            'build',
            'Build the project(s)',
            (childYargs) => {
                return childYargs
                    .usage(buildCommandUsage)
                    .example('lib build', 'Build the project(s).')
                    .option('workflow', {
                        describe:
                            'The workflow configuration file location or set `auto` to analyze project structure and build automatically.',
                        type: 'string'
                    })
                    .option('env', {
                        alias: 'environment',
                        describe:
                            'Environment name to override the build configuration with `envOverrides[environment]` options.'
                    })
                    .option('prod', {
                        describe: 'Shortcut flag to set environment to `production`.',
                        type: 'boolean'
                    })
                    .option('filter', {
                        describe: 'Build the specific project(s) filtered by project name(s).',
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
                    .option('version', {
                        describe: 'Set the version to override the version field of the package.json file.',
                        type: 'string'
                    })
                    .option('beep', {
                        describe: 'Beep when all build actions completed.',
                        type: 'boolean'
                    })
                    .option('watch', {
                        describe: 'Run in watch mode.',
                        type: 'boolean'
                    })
                    .option('h', {
                        alias: 'help',
                        describe: 'Show help',
                        type: 'boolean'
                    });
            },
            () => {
                // Do nothing
            }
        )
        .command(
            'test',
            'Test the project(s)',
            (childYargs) => {
                return childYargs
                    .usage(buildCommandUsage)
                    .example('lib test', 'Test the project(s).')
                    .option('browsers', {
                        describe: 'A list of browsers to launch and capture.',
                        type: 'array'
                    })
                    .option('reporters', {
                        describe: 'A list of reporters to use.',
                        type: 'array'
                    })
                    .option('codeCoverage', {
                        describe: 'Output code coverage report.',
                        type: 'boolean'
                    })
                    .option('karmaConfig', {
                        describe: 'Custom karma.conf.js file path.',
                        type: 'string'
                    })
                    .option('workflow', {
                        describe:
                            'The workflow configuration file location or set `auto` to analyze project structure and test automatically.',
                        type: 'string'
                    })
                    .option('env', {
                        alias: 'environment',
                        describe:
                            'Environment name to override the test configuration with `envOverrides[environment]` options.'
                    })
                    .option('prod', {
                        describe: 'Shortcut flag to set environment to `production`.',
                        type: 'boolean'
                    })
                    .option('filter', {
                        describe: 'Filter the project(s) by project name(s).',
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
                    .option('watch', {
                        describe: 'Run in watch mode.',
                        type: 'boolean'
                    })
                    .option('h', {
                        alias: 'help',
                        describe: 'Show help',
                        type: 'boolean'
                    });
            },
            () => {
                // Do nothing
            }
        )
        .version(false)
        .help('help')
        .showHelpOnFail(false)
        .option('v', {
            alias: 'version',
            describe: 'Show version',
            type: 'boolean',
            global: false
        })
        .option('h', {
            alias: 'help',
            describe: 'Show help',
            type: 'boolean',
            global: false
        })
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

    if (command === 'test') {
        // eslint-disable-next-line no-console
        console.log(
            `${colorize(
                `${cliPackageName} v${cliVersion} [${cliIsGlobal ? 'Global' : cliIsLink ? 'Local - link' : 'Local'}]`,
                'white'
            )}\n`
        );

        const cliTestModule = await import('./test/cli-test');
        const cliTest = cliTestModule.cliTest;

        return cliTest(argv);
    }

    if (argv.version) {
        // eslint-disable-next-line no-console
        console.log(cliVersion);

        return 0;
    }

    return 0;
}
