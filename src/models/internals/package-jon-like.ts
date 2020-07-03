export interface PackageJsonPredefinedScripts {
    [key: string]: string | undefined;
    prepublish?: string;
    prepare?: string;
    prepublishOnly?: string;
    prepack?: string;
    postpack?: string;
    publish?: string;
    preinstall?: string;
    install?: string;
    preuninstall?: string;
    postuninstall?: string;
    preversion?: string;
    version?: string;
    postversion?: string;
    preshrinkwrap?: string;
}

export interface PackageJsonLike {
    [key: string]: string | boolean | { [key: string]: string | undefined } | string[] | undefined;
    name: string;
    version?: string;
    author?: string | { [key: string]: string };
    keywords?: string[];
    license?: string;
    homepage?: string;
    repository?: string | { [key: string]: string };
    bugs?: string | { [key: string]: string };
    main?: string;
    module?: string;
    es2015?: string;
    esm5?: string;
    // It is deprecated as of v9, might be removed in the future.
    esm2015?: string;
    fesm2015?: string;
    fesm5?: string;
    typings?: string;
    browser?: string;
    sideEffects?: string[] | boolean;
    scripts?: PackageJsonPredefinedScripts;
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
    peerDependencies?: { [key: string]: string };
}
