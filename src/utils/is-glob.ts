// Fork from: https://github.com/micromatch/is-glob
// Fork from: https://github.com/micromatch/is-extglob

const chars: { [key: string]: string } = { '{': '}', '(': ')', '[': ']' };

export function isExtglob(str: string): boolean {
    if (typeof str !== 'string' || str === '') {
        return false;
    }

    let strLocal = str;
    const regex = /(\\).|([@?!+*]\(.*\))/g;
    let match = regex.exec(strLocal);

    while (match) {
        if (match[2]) {
            return true;
        }

        strLocal = strLocal.slice(match.index + match[0].length);
        match = regex.exec(strLocal);
    }

    return false;
}

export function isGlob(str: string): boolean {
    if (typeof str !== 'string' || str === '') {
        return false;
    }

    if (isExtglob(str)) {
        return true;
    }
    let strLocal = str;
    const regex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
    let match = regex.exec(strLocal);

    while (match) {
        if (match[2]) {
            return true;
        }

        let idx = match.index + match[0].length;

        // If an open bracket/brace/paren is escaped,
        // set the index to the next closing character
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = strLocal.indexOf(close, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }

        strLocal = strLocal.slice(idx);
        match = regex.exec(strLocal);
    }

    return false;
}
