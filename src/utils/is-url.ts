export function isUrl(urlOrPath: string): boolean {
    return urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://') || urlOrPath.startsWith('//');
}
