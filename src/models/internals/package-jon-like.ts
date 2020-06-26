export interface PackageJsonLike {
    [key: string]: string | boolean | { [key: string]: string } | undefined;
    name?: string;
    version?: string;
    author?: string;
    license?: string;
    homepage?: string;
    experimental?: boolean;
    main?: string;
    typings?: string;
    scripts?: { [key: string]: string };
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
    peerDependencies?: { [key: string]: string };
    repository?: { [key: string]: string };
    bugs?: { [key: string]: string };
}
