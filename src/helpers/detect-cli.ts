export function isFromBuiltInCli(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?lib$/i.test(process.argv[1]);
}

export function isFromWebpackCli(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?webpack(\.js)?$/i.test(process.argv[1]);
}

export function isFromWebpackDevServer(): boolean {
    return process.argv.length >= 2 && /(\\|\/)?webpack-dev-server(\.js)?$/i.test(process.argv[1]);
}
