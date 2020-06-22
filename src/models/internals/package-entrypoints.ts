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
}
