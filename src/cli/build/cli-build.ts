import { CliParams } from '../cli-params';

export async function cliBuild(cliParams: CliParams): Promise<number> {
    // eslint-disable-next-line no-console
    console.log('cliParams: ', cliParams);

    return Promise.resolve(0);
}
