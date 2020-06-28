export interface PackageEntrypoints {
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
}

export interface PackageJsonLike extends PackageEntrypoints {
    [key: string]: string | boolean | { [key: string]: string } | string[] | undefined;
    name: string;
    version?: string;
    author?: string | { [key: string]: string };
    keywords?: string[];
    license?: string;
    homepage?: string;
    repository?: string | { [key: string]: string };
    bugs?: string | { [key: string]: string };
    scripts?: { [key: string]: string };
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
    peerDependencies?: { [key: string]: string };
    experimental?: boolean;
    sideEffects?: string[] | boolean;
}
