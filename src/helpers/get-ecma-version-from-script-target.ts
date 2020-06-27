import { ScriptTarget } from 'typescript';

export function getEcmaVersionFromScriptTarget(scriptTarget: ScriptTarget | undefined): number | undefined {
    if (scriptTarget === ScriptTarget.ES2020) {
        return 11;
    } else if (scriptTarget === ScriptTarget.ES2019) {
        return 10;
    } else if (scriptTarget === ScriptTarget.ES2018) {
        return 9;
    } else if (scriptTarget === ScriptTarget.ES2017) {
        return 8;
    } else if (scriptTarget === ScriptTarget.ES2016) {
        return 7;
    } else if (scriptTarget === ScriptTarget.ES2015) {
        return 6;
    } else if (scriptTarget === ScriptTarget.ES5) {
        return 5;
    } else if (scriptTarget === ScriptTarget.ES3) {
        return 4;
    }

    return undefined;
}
