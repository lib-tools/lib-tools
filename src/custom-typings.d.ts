declare namespace NodeJS {
    export interface Global {
        libCli?: {
            startTime: number;
            version: string;
            isGlobal: boolean;
            isLink: boolean;
            location: string;
        };
    }
}
