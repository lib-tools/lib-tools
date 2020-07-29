export interface OverridableConfig<TConfigBase> {
    envOverrides?: {
        [name: string]: Partial<TConfigBase>;
    };
}
