import { ScriptTarget } from 'typescript';

export function getnodeResolveFieldsFromScriptTarget(scriptTarget: ScriptTarget | undefined): string[] {
    const nodeResolveFields: string[] = [];

    if (scriptTarget === ScriptTarget.ES2020) {
        nodeResolveFields.push('es2020');
        nodeResolveFields.push('es2019');
        nodeResolveFields.push('es2018');
        nodeResolveFields.push('es2017');
        nodeResolveFields.push('es2016');
        nodeResolveFields.push('es2015');
        nodeResolveFields.push('fesm2015');
        nodeResolveFields.push('esm2015');
    } else if (scriptTarget === ScriptTarget.ES2019) {
        nodeResolveFields.push('es2019');
        nodeResolveFields.push('es2018');
        nodeResolveFields.push('es2017');
        nodeResolveFields.push('es2016');
        nodeResolveFields.push('es2015');
        nodeResolveFields.push('fesm2015');
        nodeResolveFields.push('esm2015');
    } else if (scriptTarget === ScriptTarget.ES2018) {
        nodeResolveFields.push('es2018');
        nodeResolveFields.push('es2017');
        nodeResolveFields.push('es2016');
        nodeResolveFields.push('es2015');
        nodeResolveFields.push('fesm2015');
        nodeResolveFields.push('esm2015');
    } else if (scriptTarget === ScriptTarget.ES2017) {
        nodeResolveFields.push('es2017');
        nodeResolveFields.push('es2016');
        nodeResolveFields.push('es2015');
        nodeResolveFields.push('fesm2015');
        nodeResolveFields.push('esm2015');
    } else if (scriptTarget === ScriptTarget.ES2016) {
        nodeResolveFields.push('es2016');
        nodeResolveFields.push('es2015');
        nodeResolveFields.push('fesm2015');
        nodeResolveFields.push('esm2015');
    } else if (scriptTarget !== ScriptTarget.ES3 &&
        scriptTarget !== ScriptTarget.ES5) {
        nodeResolveFields.push('es2015');
        nodeResolveFields.push('fesm2015');
        nodeResolveFields.push('esm2015');
    }

    return nodeResolveFields;
}
