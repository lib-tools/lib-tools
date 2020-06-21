import * as yargs from 'yargs';

import { colorize } from '../../utils/colorize';

export function getBuildCommandModule(cliVersion: string): yargs.CommandModule {
    const buildCommandUsage = `${colorize(`lib-tools ${cliVersion}`, 'white')}\n
Usage:
  lib build [options...]`;

    return {
        command: 'build',
        describe: 'Build the project(s)',
        builder: (yargv: yargs.Argv) =>
            yargv
                .usage(buildCommandUsage)
                .example('lib build', 'Build the project(s) using default configuration.')
                .help('h')
                .option('config', {
                    alias: 'c',
                    describe: 'Build config file location.',
                    type: 'string'
                })
                .option('env', {
                    alias: 'environment',
                    describe: 'Define the build environment.'
                })
                .option('prod', {
                    describe: "Shortcut flag to set build environment to 'production'.",
                    type: 'boolean'
                })
                .option('filter', {
                    describe: 'Filter project config by name(s).',
                    type: 'array'
                })
                .option('progress', {
                    describe: 'Display compilation progress in percentage.',
                    type: 'boolean'
                })
                .option('logLevel', {
                    describe: 'Log level for output logging.',
                    type: 'string'
                })
                .option('verbose', {
                    describe: "Shortcut flag to set logLevel to 'debug'.",
                    type: 'boolean'
                })
                .option('watch', {
                    describe: 'Build with watch mode.',
                    type: 'boolean'
                })
                .option('poll', {
                    describe: 'Turn on file watching polling by specifying a poll interval in milliseconds.',
                    type: 'number'
                })
                .option('beep', {
                    describe: 'Beep when build completed.',
                    type: 'boolean'
                })
                .option('version', {
                    describe: "Set or override library package(s) version.'.",
                    type: 'string'
                }),
        handler: (null as unknown) as () => {
            // Do nothing
        }
    };
}
