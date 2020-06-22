export class TypescriptCompileError extends Error {
    private readonly _nativeError: Error;

    constructor(message: string) {
        super(message);
        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, TypescriptCompileError.prototype);

        const nativeError = new Error(message);
        nativeError.name = 'TypescriptCompileError';
        this._nativeError = nativeError;
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): string | undefined {
        return this._nativeError.stack;
    }
    set stack(value: string | undefined) {
        if (this._nativeError) {
            this._nativeError.stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}
