import * as yargs from 'yargs';

import { colorize } from '../../utils/colorize';

export function getBuildCommand(cliPackageName: string, cliVersion: string): yargs.CommandModule {
    const buildCommandUsage = `${colorize(`${cliPackageName} v${cliVersion}`, 'white')}\n
                        Usage:
                            lib build [options...]`;

    return {
        command: 'build',
        describe: 'Build the project(s)',
        builder: (childYargs) =>
            childYargs
                .usage(buildCommandUsage)
                .example('lib build', 'Build the project(s).')
                .option('version', {
                    describe: 'Set the version to override the version field of the package.json file.',
                    type: 'string'
                })
                // Shared command options
                .option('workflow', {
                    describe:
                        'The workflow configuration file location or `auto` to analyze project structure and run build automatically.',
                    type: 'string'
                })
                .option('env', {
                    alias: 'environment',
                    describe:
                        'Environment name to override the task configuration with `envOverrides[environment]` options.'
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
                    // type: 'string'
                    choices: ['debug', 'info', 'warn', 'error', 'disable']
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
                }),
        handler: () => {
            // Do nothing
        }
    };
}
