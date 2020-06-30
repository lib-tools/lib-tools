export interface OverridableProjectConfig<TConfigBase> {
    envOverrides?: {
        [name: string]: Partial<TConfigBase>;
    };
}
