declare namespace NodeJS {
    export interface Global {
        libCli?: {
            packageName: string;
            version: string;
            isGlobal: boolean;
            isLink: boolean;
            location: string;
            startTime: number;
        };
    }
}
