import { TranslitRule, TranslitRuleItem, TranslitRulePhase, TranslitTraceItem, translit } from '../../src';

describe('translit', () => {
    it("should work with 'TranslitRuleItem[]'", () => {
        const testRules: TranslitRuleItem[] = [
            {
                from: '\u103B([\u1000-\u1021])',
                to: '$1\u103C'
            },
            {
                from: '\u1039',
                to: '\u103A'
            }
        ];

        const result = translit('\u103B\u1019\u1014\u1039\u1019\u102C\u1005\u102C', testRules);
        void expect(result.outputText).toBe('\u1019\u103C\u1014\u103A\u1019\u102C\u1005\u102C', result);
    });

    it("should work with 'TranslitRulePhase[]'", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u103B([\u1000-\u1021])',
                        to: '$1\u103C'
                    }
                ]
            },
            {
                rules: [
                    {
                        from: '\u1039',
                        to: '\u103A'
                    }
                ]
            }
        ];

        const result = translit('\u103B\u1019\u1014\u1039\u1019\u102C\u1005\u102C', testRules);
        void expect(result.outputText).toBe('\u1019\u103C\u1014\u103A\u1019\u102C\u1005\u102C', result);
    });

    it("should work with 'TranslitRule'", () => {
        const testRule: TranslitRule = {
            phases: [
                {
                    rules: [
                        {
                            from: '\u103B([\u1000-\u1021])',
                            to: '$1\u103C'
                        }
                    ]
                },
                {
                    rules: [
                        {
                            from: '\u1039',
                            to: '\u103A'
                        }
                    ]
                }
            ]
        };

        const result = translit('\u103B\u1019\u1014\u1039\u1019\u102C\u1005\u102C', testRule);
        void expect(result.outputText).toBe('\u1019\u103C\u1014\u103A\u1019\u102C\u1005\u102C', result);
    });

    it("should set 'TranslitResult.replaced' to 'true' if converted", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u1086',
                        to: '\u103F'
                    }
                ]
            }
        ];

        const result = translit('\u101E\u1030\u101B\u1086\u1010\u102E', testRules);
        void expect(result.replaced).toBeTruthy();
    });

    it("should set 'TranslitResult.replaced' to 'false' if not converted", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u103F',
                        to: '\u1086'
                    }
                ]
            }
        ];

        const result = translit('\u101E\u1030\u101B\u1086\u1010\u102E', testRules);
        void expect(result.replaced).toBeFalsy();
    });

    it("should set 'TranslitResult.replaced' to 'false' if 'sourceText' is null", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u103F',
                        to: '\u1086'
                    }
                ]
            }
        ];

        const result = translit((null as unknown) as string, testRules);
        void expect(result.replaced).toBeFalsy();
    });

    it("'should set 'TranslitResult.replaced' to 'false' if 'sourceText' is whitespaces or empty", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u103F',
                        to: '\u1086'
                    }
                ]
            }
        ];

        const result = translit(' ', testRules);
        void expect(result.replaced).toBeFalsy();
    });

    it("should set 'TranslitResult.duration' >= 0", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u1086',
                        to: '\u103F'
                    }
                ]
            }
        ];

        const result = translit('\u101E\u1030\u101B\u1086\u1010\u102E', testRules);
        void expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should set 'TranslitResult.traces' undefined by default", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u1086',
                        to: '\u103F'
                    }
                ]
            }
        ];

        const result = translit('\u101E\u1030\u101B\u1086\u1010\u102E', testRules);
        void expect(result.traces).toBeUndefined();
    });

    it("should include 'TranslitResult.traces' if 'trace' is 'true'", () => {
        const testRules: TranslitRulePhase[] = [
            {
                rules: [
                    {
                        from: '\u1086',
                        to: '\u103F'
                    }
                ]
            }
        ];

        const result = translit('\u101E\u1030\u101B\u1086\u1010\u102E', testRules, undefined, true);
        const traces = result.traces as TranslitTraceItem[];
        void expect(traces[0].from).toBe('\u1086');
        void expect(traces[0].to).toBe('\u103F');
        void expect(traces[0].inputString).toBe('\u1086\u1010\u102E');
        void expect(traces[0].matchedString).toBe('\u1086');
        void expect(traces[0].replacedString).toBe('\u103F');
    });
});
