import * as yargs from 'yargs';

import { colorize } from '../utils/colorize';

import { getBuildCommand } from './build/build-command';
import { getTestCommand } from './test/test-command';

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
        .example('lib build', 'Build the project(s) using workflow.json configuration file.')
        .example('lib build --workflow=auto', 'Analyze project structure and build automatically.')
        .example('lib --help', 'Show help')
        .command(getBuildCommand(cliPackageName, cliVersion))
        .command(getTestCommand(cliPackageName, cliVersion))
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const command = yargsInstance.argv._[0] ? (yargsInstance.argv._[0] as string).toLowerCase() : undefined;
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
