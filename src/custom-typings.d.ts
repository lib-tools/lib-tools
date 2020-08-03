declare namespace NodeJS {
    export interface Global {
        buildCounter?: {
            count: number;
        };

        testCounter?: {
            count: number;
        };

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
