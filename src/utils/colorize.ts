import * as supportsColor from 'supports-color';

const defaultColors: { [key: string]: string } = {
    reset: '\u001b[0m',

    // fg
    black: '\x1b[30m',
    white: '\x1b[37m',
    bold: '\u001b[1m',
    yellow: '\u001b[1m\u001b[33m',
    red: '\u001b[1m\u001b[31m',
    green: '\u001b[1m\u001b[32m',
    cyan: '\u001b[1m\u001b[36m',
    magenta: '\u001b[1m\u001b[35m'
};

export type ColorKeys = 'black' | 'white' | 'bold' | 'yellow' | 'red' | 'green' | 'cyan' | 'magenta';

export function colorize(str: string, colorKey: ColorKeys): string {
    if (!supportsColor.stdout) {
        return str;
    }

    if (!colorKey || !(colorKey in defaultColors)) {
        return str;
    }

    const buf: string[] = [];
    buf.push(defaultColors[colorKey]);
    buf.push(str);
    buf.push('\u001b[37m');
    buf.push('\u001b[39m\u001b[22m');

    return buf.join('');
}
