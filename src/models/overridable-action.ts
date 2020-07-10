export interface OverridableAction<TConfigBase> {
    envOverrides?: {
        [name: string]: Partial<TConfigBase>;
    };
}
