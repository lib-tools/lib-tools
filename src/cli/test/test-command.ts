import * as yargs from 'yargs';

import { colorize } from '../../utils/colorize';

export function getTestCommand(cliPackageName: string, cliVersion: string): yargs.CommandModule {
    const testCommandUsage = `${colorize(`${cliPackageName} v${cliVersion}`, 'white')}\n
    Usage:
        lib test [options...]`;

    return {
        command: 'test',
        describe: 'Test the project(s)',
        builder: (childYargs) =>
            childYargs
                .usage(testCommandUsage)
                .example('lib test', 'Test the project(s).')
                .option('browsers', {
                    describe: 'A list of browsers to launch and capture.',
                    type: 'array'
                })
                .option('reporters', {
                    describe: 'A list of reporters to use.',
                    type: 'array'
                })
                .option('codeCoverageExclude', {
                    describe: 'A list of minimatch pattern to exclude files from code coverage report.',
                    type: 'string'
                })
                .option('singleRun', {
                    describe: 'If true, test runner will stop watching and exit when run completed.',
                    type: 'boolean'
                })
                // Shared command options
                .option('workflow', {
                    describe:
                        'The workflow configuration file location or `auto` to analyze project structure and run test automatically.',
                    type: 'string'
                })
                .option('env', {
                    alias: 'environment',
                    describe:
                        'Environment name to override the task configuration with `envOverrides[environment]` options.'
                })
                .option('filter', {
                    describe: 'Filter the project(s) by project name(s).',
                    type: 'array'
                })
                .option('logLevel', {
                    describe: 'Logging level for output information.',
                    choices: ['debug', 'info', 'warn', 'error', 'disable']
                })
                .option('h', {
                    alias: 'help',
                    describe: 'Show help',
                    type: 'boolean'
                }),
        handler: () => {
            // Do nothing
        }
    };
}
