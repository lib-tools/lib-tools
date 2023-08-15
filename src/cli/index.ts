import chalk from 'chalk';
import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { CliInfo } from './cli-info.js';
import { getBuildCommand } from './build/build-command.js';
// import { getTestCommand } from './test/test-command';

function initYargs(cliInfo: CliInfo): yargs.Argv {
    const yargsInstance = yargs
        .default(hideBin(process.argv))
        .usage(chalk.bold(`${cliInfo.packageName} v${cliInfo.version}\nUsage:\nlib [command] [options...]`))
        .example('lib build', 'Build the project(s) using workflow.json configuration file.')
        .example('lib build --workflow=auto', 'Analyze project structure and build automatically.')
        .example('lib --help', 'Show help')
        .command(getBuildCommand(cliInfo.packageName, cliInfo.version))
        // .command(getTestCommand(cliPackageName, cliVersion))
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
            console.error(`\n${chalk.red(msg)}`);

            process.exit(1);
        })
        .strict();

    return yargsInstance;
}

export default async function (cliInfo: CliInfo): Promise<number> {
    const argv = await initYargs(cliInfo).parse();
    const command = argv._[0] ? (argv._[0] as string).toLowerCase() : undefined;

    if (command === 'build') {
        // eslint-disable-next-line no-console
        console.log(`${chalk.bold(`${cliInfo.packageName} v${cliInfo.version}`)}\n`);

        const cliBuildModule = await import('./build/cli-build.js');
        const cliBuild = cliBuildModule.cliBuild;

        return cliBuild(argv);
    }

    // if (command === 'test') {
    //     // eslint-disable-next-line no-console
    //     console.log(
    //         `${colorize(
    //             `${cliPackageName} v${cliVersion} [${cliIsGlobal ? 'Global' : cliIsLink ? 'Local - link' : 'Local'}]`,
    //             'white'
    //         )}\n`
    //     );

    //     const cliTestModule = await import('./test/cli-test');
    //     const cliTest = cliTestModule.cliTest;

    //     return cliTest(argv);
    // }

    if (argv.version) {
        // eslint-disable-next-line no-console
        console.log(cliInfo.version);

        return 0;
    }

    return 0;
}
