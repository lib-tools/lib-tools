/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { TranslitResult, TranslitTraceItem } from './translit-result';
import {
    PostRulesStrategy,
    TranslitRule,
    TranslitRuleItem,
    TranslitRulePhase,
    TranslitSubRuleItem
} from './translit-rule';

import {
    TranslitRuleItemParsed,
    TranslitRuleParsed,
    TranslitRulePhaseParsed,
    TranslitSubRuleItemParsed
} from './translit-rule-parsed';

const applyRule = (
    inputStr: string,
    rule: TranslitRuleParsed,
    userOptions?: { [option: string]: boolean | string },
    trace?: boolean
): TranslitResult => {
    const startTime = +new Date();
    const translitResult: TranslitResult = {
        outputText: inputStr
    };

    translitResult.traces = trace ? [] : undefined;
    for (const rulePhase of rule.phases) {
        if (rulePhase.when) {
            const whenOptions = rulePhase.when;
            if (Object.keys(whenOptions).find((k) => !userOptions || whenOptions[k] !== userOptions[k])) {
                continue;
            }
        }

        if (rulePhase.skip) {
            const skipOptions = rulePhase.skip;
            if (Object.keys(skipOptions).find((k) => userOptions && skipOptions[k] === userOptions[k])) {
                continue;
            }
        }

        const outputText = applyRuleItems(translitResult.outputText, rulePhase, userOptions, translitResult.traces);
        if (!translitResult.replaced) {
            translitResult.replaced = outputText !== translitResult.outputText;
        }

        translitResult.outputText = outputText;

        if (!outputText.length) {
            break;
        }
    }

    translitResult.duration = Math.max(+new Date() - startTime, 0);

    return translitResult;
};

const applyRuleItems = (
    inputStr: string,
    rulePhase: TranslitRulePhaseParsed,
    userOptions?: { [option: string]: boolean | string },
    traces?: TranslitTraceItem[]
): string => {
    let outStr = '';
    let curStr = inputStr;

    while (curStr.length > 0) {
        let foundRule = false;

        for (let i = 0; i < rulePhase.rules.length; i++) {
            const ruleItem = rulePhase.rules[i];

            if (ruleItem.when && (!ruleItem.tplSeqName || ruleItem.firstSeq)) {
                const whenOptions = ruleItem.when;
                if (Object.keys(whenOptions).find((k) => !userOptions || whenOptions[k] !== userOptions[k])) {
                    if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                        i += ruleItem.totalSeqCount - 1;
                    }
                    continue;
                }
            }

            if (ruleItem.skip && (!ruleItem.tplSeqName || ruleItem.firstSeq)) {
                const skipOptions = ruleItem.skip;
                if (Object.keys(skipOptions).find((k) => userOptions && skipOptions[k] === userOptions[k])) {
                    if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                        i += ruleItem.totalSeqCount - 1;
                    }
                    continue;
                }
            }

            if (
                ruleItem.hasLeft != null &&
                ((ruleItem.hasLeft === false && outStr.length > 0) || (ruleItem.hasLeft === true && !outStr.length))
            ) {
                if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                    i += ruleItem.totalSeqCount - 1;
                }
                continue;
            }

            if (ruleItem.minLength != null && curStr.length < ruleItem.minLength) {
                if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                    i += ruleItem.totalSeqCount - 1;
                }
                continue;
            }

            if (
                ruleItem.seqQuickTests &&
                ruleItem.totalSeqCount &&
                ruleItem.seqQuickTests.find((qt) => qt[1] >= curStr.length || curStr[qt[1]] !== qt[0])
            ) {
                i += ruleItem.totalSeqCount - 1;
                continue;
            }

            if (
                ruleItem.quickTests &&
                ruleItem.quickTests.length > 0 &&
                ruleItem.quickTests.find((qt) => qt[1] >= curStr.length || curStr[qt[1]] !== qt[0])
            ) {
                continue;
            }

            if (ruleItem.leftRegExp != null) {
                if (outStr.length > 0) {
                    // const leftMatch = outStr.match(ruleItem.leftRegExp);
                    const leftMatch = ruleItem.leftRegExp.exec(outStr);
                    if (leftMatch == null) {
                        if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                            i += ruleItem.totalSeqCount - 1;
                        }
                        continue;
                    }
                } else {
                    if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                        i += ruleItem.totalSeqCount - 1;
                    }
                    continue;
                }
            }

            // const m = curStr.match(ruleItem.fromRegExp);
            const m = ruleItem.fromRegExp.exec(curStr);
            if (m == null) {
                continue;
            }

            const matchedString = m[0];
            const rightPart = curStr.substring(matchedString.length);

            if (ruleItem.rightRegExp != null) {
                if (rightPart.length > 0) {
                    const rightMatch = ruleItem.rightRegExp.exec(rightPart);
                    // const rightMatch = rightPart.match(ruleItem.rightRegExp);
                    if (rightMatch == null) {
                        if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                            i += ruleItem.totalSeqCount - 1;
                        }
                        continue;
                    }
                } else {
                    if (ruleItem.firstSeq && ruleItem.totalSeqCount) {
                        i += ruleItem.totalSeqCount - 1;
                    }
                    continue;
                }
            }

            foundRule = true;

            let replacedString =
                ruleItem.parsedTo != null
                    ? matchedString.replace(ruleItem.fromRegExp, ruleItem.parsedTo)
                    : matchedString;

            let currentTrace: TranslitTraceItem | undefined;
            if (traces) {
                currentTrace = {
                    from: ruleItem.from,
                    to: ruleItem.to,
                    inputString: curStr,
                    matchedString,
                    replacedString
                };
                traces.push(currentTrace);
            }

            if (ruleItem.parsedPostRules && replacedString.length > 0) {
                replacedString = applySubRuleItems(
                    replacedString,
                    ruleItem.parsedPostRules,
                    ruleItem.postRulesStrategy,
                    userOptions,
                    currentTrace
                );
            }

            outStr += replacedString;
            curStr = rightPart;

            break;
        }

        if (!foundRule && curStr.length > 0) {
            outStr += curStr[0];
            curStr = curStr.substring(1);
        }
    }

    return outStr;
};

const applySubRuleItems = (
    inputStr: string,
    subRuleItems: TranslitSubRuleItemParsed[],
    postRulesStrategy?: PostRulesStrategy,
    userOptions?: { [option: string]: boolean | string },
    currentTrace?: TranslitTraceItem
): string => {
    let curStr = inputStr;
    const orGroupNames: string[] = [];
    const whileMatches: [number, string][] = [];
    let hasAnyMatch = false;

    do {
        hasAnyMatch = false;
        for (let i = 0; i < subRuleItems.length; i++) {
            const subRuleItem = subRuleItems[i];

            if (subRuleItem.orGroup && orGroupNames.includes(subRuleItem.orGroup)) {
                if (subRuleItem.firstSeq && subRuleItem.totalSeqCount) {
                    i += subRuleItem.totalSeqCount - 1;
                }
                continue;
            }

            if (subRuleItem.when && (!subRuleItem.tplSeqName || subRuleItem.firstSeq)) {
                const whenOptions = subRuleItem.when;
                if (Object.keys(whenOptions).find((k) => !userOptions || whenOptions[k] !== userOptions[k])) {
                    if (subRuleItem.firstSeq && subRuleItem.totalSeqCount) {
                        i += subRuleItem.totalSeqCount - 1;
                    }
                    continue;
                }
            }

            if (subRuleItem.skip && (!subRuleItem.tplSeqName || subRuleItem.firstSeq)) {
                const skipOptions = subRuleItem.skip;
                if (Object.keys(skipOptions).find((k) => userOptions && skipOptions[k] === userOptions[k])) {
                    if (subRuleItem.firstSeq && subRuleItem.totalSeqCount) {
                        i += subRuleItem.totalSeqCount - 1;
                    }
                    continue;
                }
            }

            let matchedString: string;
            let replacedString: string;

            if (postRulesStrategy === 'whileMatch') {
                // const m = curStr.match(subRuleItem.fromRegExp);
                const m = subRuleItem.fromRegExp.exec(curStr);
                if (m == null) {
                    continue;
                }

                matchedString = m[0];
                replacedString = curStr.replace(subRuleItem.fromRegExp, subRuleItem.parsedTo);

                if (whileMatches.find((wm) => wm[0] === i && wm[1] === matchedString)) {
                    continue;
                } else {
                    hasAnyMatch = true;
                    whileMatches.push([i, matchedString]);
                }
            } else {
                const start = subRuleItem.start != null ? subRuleItem.start : 0;
                if (start < 0 || start >= curStr.length) {
                    if (subRuleItem.firstSeq && subRuleItem.totalSeqCount) {
                        i += subRuleItem.totalSeqCount - 1;
                    }
                    continue;
                }

                const leftPart = start > 0 ? curStr.substring(0, start) : '';
                const rightPart = start > 0 ? curStr.substring(start) : curStr;

                // const m = rightPart.match(subRuleItem.fromRegExp);
                const m = subRuleItem.fromRegExp.exec(rightPart);
                if (m == null) {
                    continue;
                }

                matchedString = m[0];
                replacedString = leftPart + rightPart.replace(subRuleItem.fromRegExp, subRuleItem.parsedTo);

                if (subRuleItem.seqIndex != null && subRuleItem.totalSeqCount) {
                    i += subRuleItem.totalSeqCount - subRuleItem.seqIndex - 1;
                }
            }

            if (subRuleItem.orGroup && !orGroupNames.includes(subRuleItem.orGroup)) {
                orGroupNames.push(subRuleItem.orGroup);
            }

            if (currentTrace) {
                currentTrace.postRuleTraces = currentTrace.postRuleTraces || [];
                currentTrace.postRuleTraces.push({
                    from: subRuleItem.from,
                    to: subRuleItem.to,
                    inputString: curStr,
                    matchedString,
                    replacedString
                });
            }

            curStr = replacedString;

            if (!curStr.length) {
                break;
            }
        }
    } while (postRulesStrategy === 'whileMatch' && hasAnyMatch && curStr.length > 0);

    return curStr;
};

const initTplVar = (tplVar: { [key: string]: string }, globalTplVar?: { [key: string]: string }): void => {
    const varNames = Object.keys(tplVar).sort().reverse();
    const globalVarNames = globalTplVar ? Object.keys(globalTplVar).sort().reverse() : [];

    for (const k1 of varNames) {
        let curValue = tplVar[k1];
        const processedKeys: string[] = [k1];
        const errMsg = `Circular variable was detected while initializing 'tplVar', name: '${k1}'.`;

        while (curValue.includes('#')) {
            let foundLocal = false;
            for (const k2 of varNames.filter((k) => k !== k1)) {
                if (curValue.includes(k2)) {
                    curValue = curValue.replace(new RegExp(k2, 'g'), tplVar[k2]);
                    foundLocal = true;
                    if (!processedKeys.includes(k2)) {
                        processedKeys.push(k2);
                    } else {
                        throw new Error(errMsg);
                    }
                }
            }

            let foundGlobal = false;
            for (const k2 of globalVarNames) {
                if (curValue.includes(k2)) {
                    const v2 = (globalTplVar as { [key: string]: string })[k2];
                    curValue = curValue.replace(new RegExp(k2, 'g'), v2);
                    foundGlobal = true;

                    if (v2.includes('#') && varNames.find((k) => v2.includes(k)) != null) {
                        throw new Error(errMsg);
                    }
                }
            }

            if (foundLocal || foundGlobal) {
                tplVar[k1] = curValue;
            } else {
                break;
            }
        }
    }
};

const toTranslitRule = (ruleAny: TranslitRule | TranslitRulePhase[] | TranslitRuleItem[]): TranslitRule => {
    const errMsg = 'Error in parsing translit rule, invalid rule schema.';

    if (Array.isArray(ruleAny)) {
        if ((ruleAny as TranslitRulePhase[]).length > 0 && (ruleAny as TranslitRulePhase[])[0].rules) {
            return {
                phases: ruleAny as TranslitRulePhase[]
            };
        } else if ((ruleAny as TranslitRuleItem[]).length > 0 && (ruleAny as TranslitRuleItem[])[0].from) {
            return {
                phases: [
                    {
                        rules: ruleAny as TranslitRuleItem[]
                    }
                ]
            };
        } else {
            throw new Error(errMsg);
        }
    } else {
        if (!ruleAny.phases) {
            throw new Error(errMsg);
        }

        return ruleAny;
    }
};

const parseRule = (rule: TranslitRule): TranslitRuleParsed => {
    const globalTplVar = rule.tplVar ? { ...rule.tplVar } : undefined;
    if (globalTplVar) {
        initTplVar(globalTplVar);
    }

    const parsedRulePhases: TranslitRulePhaseParsed[] = [];

    for (let i = 0; i < rule.phases.length; i++) {
        const rulePhase = { ...rule.phases[i] };
        if (rulePhase.tplVar) {
            initTplVar(rulePhase.tplVar, globalTplVar);
        }

        const parsedRuleItems: TranslitRuleItemParsed[] = [];

        for (let j = 0; j < rulePhase.rules.length; j++) {
            const ruleItem = rulePhase.rules[j];
            const parsedItems = parseTpl(
                ruleItem,
                rulePhase.tplSeq,
                rulePhase.tplVar,
                globalTplVar,
                rulePhase.postRulesDef,
                ruleItem.postRulesStrategy,
                i,
                j
            );
            parsedRuleItems.push(...parsedItems);
        }

        parsedRulePhases.push({
            ...rulePhase,
            index: i,
            rules: parsedRuleItems
        });
    }

    return {
        $schema: rule.$schema,
        version: rule.version,
        description: rule.description,
        tplVar: globalTplVar,
        phases: parsedRulePhases
    };
};

const parseTpl = (
    ruleItem: TranslitRuleItem | TranslitSubRuleItem,
    tplSeq?: { [key: string]: [string, string, number][] },
    tplVar?: { [key: string]: string },
    globalTplVar?: { [key: string]: string },
    postRulesDef?: { [key: string]: TranslitSubRuleItem[] },
    postRulesStrategy?: PostRulesStrategy,
    phaseIndex?: number,
    ruleIndex?: number,
    subRuleIndex?: number
): TranslitRuleItemParsed[] | TranslitSubRuleItemParsed[] => {
    const mergedTplVar: { [key: string]: string } = { ...globalTplVar, ...tplVar };
    const varNames = Object.keys(mergedTplVar).sort().reverse();

    const parsedRuleItem: TranslitRuleItemParsed = {
        ...ruleItem,
        index: subRuleIndex == null ? ruleIndex || 0 : subRuleIndex,
        parsedFrom: ruleItem.from,
        fromRegExp: (undefined as unknown) as RegExp,
        parsedTo: ruleItem.to,
        parsedLeft: (ruleItem as TranslitRuleItem).left,
        parsedRight: (ruleItem as TranslitRuleItem).right
    };

    for (const varName of varNames) {
        const value = mergedTplVar[varName];
        if (parsedRuleItem.parsedFrom.includes(varName)) {
            parsedRuleItem.parsedFrom = parsedRuleItem.parsedFrom.replace(new RegExp(varName, 'g'), value);
        }
        if (parsedRuleItem.parsedTo && parsedRuleItem.parsedTo.includes(varName)) {
            parsedRuleItem.parsedTo = parsedRuleItem.parsedTo.replace(new RegExp(varName, 'g'), value);
        }
        if (parsedRuleItem.parsedLeft && parsedRuleItem.parsedLeft.includes(varName)) {
            parsedRuleItem.parsedLeft = parsedRuleItem.parsedLeft.replace(new RegExp(varName, 'g'), value);
        }
        if (parsedRuleItem.parsedRight && parsedRuleItem.parsedRight.includes(varName)) {
            parsedRuleItem.parsedRight = parsedRuleItem.parsedRight.replace(new RegExp(varName, 'g'), value);
        }
    }

    const seqParsedRuleItems = parseTplSeq(
        parsedRuleItem,
        tplSeq,
        tplVar,
        globalTplVar,
        postRulesDef,
        postRulesStrategy,
        phaseIndex,
        ruleIndex,
        subRuleIndex
    );

    if (seqParsedRuleItems) {
        return seqParsedRuleItems;
    } else {
        parsedRuleItem.fromRegExp =
            subRuleIndex != null && postRulesStrategy === 'whileMatch'
                ? new RegExp(`${parsedRuleItem.parsedFrom}`, 'g')
                : new RegExp(`^${parsedRuleItem.parsedFrom}`);
        if (parsedRuleItem.parsedLeft) {
            parsedRuleItem.leftRegExp = new RegExp(`${parsedRuleItem.parsedLeft}$`);
        }
        if (parsedRuleItem.parsedRight) {
            parsedRuleItem.rightRegExp = new RegExp(`^${parsedRuleItem.parsedRight}`);
        }

        let postRules: TranslitSubRuleItem[] | undefined;
        if (
            parsedRuleItem.postRulesRef &&
            postRulesDef &&
            postRulesDef[parsedRuleItem.postRulesRef] &&
            postRulesDef[parsedRuleItem.postRulesRef].length > 0
        ) {
            postRules = JSON.parse(JSON.stringify(postRulesDef[parsedRuleItem.postRulesRef])) as TranslitSubRuleItem[];
        }
        if (parsedRuleItem.postRules) {
            postRules = postRules || [];
            postRules.push(...parsedRuleItem.postRules);
        }

        if (postRules) {
            if (parsedRuleItem.postRulesStart) {
                assignPostRulesStarts(postRules, parsedRuleItem.postRulesStart);
            }

            parsedRuleItem.parsedPostRules = parseSubRuleItems(
                postRules,
                tplSeq,
                tplVar,
                globalTplVar,
                postRulesDef,
                postRulesStrategy,
                phaseIndex,
                ruleIndex
            );
        }

        if (subRuleIndex == null && !parsedRuleItem.quickTests && parsedRuleItem.parsedFrom.length === 1) {
            parsedRuleItem.quickTests = [[parsedRuleItem.parsedFrom, 0]];
        }

        return [parsedRuleItem];
    }
};

const parseTplSeq = (
    parsedRuleItem: TranslitRuleItemParsed | TranslitSubRuleItemParsed,
    tplSeq?: { [key: string]: [string, string, number][] },
    tplVar?: { [key: string]: string },
    globalTplVar?: { [key: string]: string },
    postRulesDef?: { [key: string]: TranslitSubRuleItem[] },
    postRulesStrategy?: PostRulesStrategy,
    phaseIndex?: number,
    ruleIndex?: number,
    subRuleIndex?: number
): TranslitRuleItemParsed[] | TranslitSubRuleItemParsed[] | undefined => {
    if (!tplSeq) {
        return undefined;
    }
    const tplSeqName = Object.keys(tplSeq)
        .sort()
        .reverse()
        .find((k) => parsedRuleItem.parsedFrom.includes(k));
    if (!tplSeqName) {
        return undefined;
    }

    const errMsgPrefix = 'Error in parsing translit rule';
    const subPosSuffix = subRuleIndex != null ? `, subrule: ${subRuleIndex + 1}` : '';
    const posSuffix = `phase: ${(phaseIndex || 0) + 1}, rule: ${(ruleIndex || 0) + 1}${subPosSuffix}`;
    const invalidTplValueMsg = `${errMsgPrefix}, invalid template value definition, ${posSuffix}.`;

    if (!parsedRuleItem.parsedTo) {
        throw new Error(`${errMsgPrefix}, to use 'tplSeq', 'to' value is required, ${posSuffix}.`);
    }

    if (!parsedRuleItem.parsedTo.includes(tplSeqName)) {
        throw new Error(
            `${errMsgPrefix}, tplSeq name: '${tplSeqName}' could not be found in 'to' value, ${posSuffix}.`
        );
    }

    const tplSeqValue = tplSeq[tplSeqName];

    const parsedRuleItems: (TranslitRuleItemParsed | TranslitSubRuleItemParsed)[] = [];
    let firstSeq = true;
    let totalSeqCount = 0;
    let seqIndex = 0;

    for (const tplSeqPart of tplSeqValue) {
        totalSeqCount += tplSeqPart[2];
    }

    for (const tplSeqPart of tplSeqValue) {
        const fromStart = tplSeqPart[0];
        const toStart = tplSeqPart[1];
        const seqCount = tplSeqPart[2];

        if (!fromStart || fromStart.length !== 1 || seqCount < 1) {
            throw new Error(invalidTplValueMsg);
        }

        if (seqCount > 1 && (!toStart || toStart.length !== 1)) {
            throw new Error(invalidTplValueMsg);
        }

        const fromCPStart = fromStart.codePointAt(0) as number;
        const toCPStart = toStart && toStart.length === 1 ? toStart.codePointAt(0) : undefined;

        for (let i = 0; i < seqCount; i++) {
            const currFromCP = fromCPStart + i;
            const currToCP = toCPStart ? toCPStart + i : undefined;
            const currFromChar = String.fromCodePoint(currFromCP);
            const currToChar = currToCP ? String.fromCodePoint(currToCP) : toStart;

            const clonedParsedRuleItem = JSON.parse(JSON.stringify(parsedRuleItem)) as TranslitRuleItemParsed;
            const fromReplaced = clonedParsedRuleItem.parsedFrom.replace(tplSeqName, currFromChar);

            let postRules: TranslitSubRuleItem[] | undefined;
            if (
                clonedParsedRuleItem.postRulesRef &&
                postRulesDef &&
                postRulesDef[clonedParsedRuleItem.postRulesRef] &&
                postRulesDef[clonedParsedRuleItem.postRulesRef].length > 0
            ) {
                postRules = JSON.parse(
                    JSON.stringify(postRulesDef[clonedParsedRuleItem.postRulesRef])
                ) as TranslitSubRuleItem[];
            }
            if (clonedParsedRuleItem.postRules) {
                postRules = postRules || [];
                postRules.push(...clonedParsedRuleItem.postRules);
            }

            if (postRules && clonedParsedRuleItem.postRulesStart) {
                assignPostRulesStarts(postRules, clonedParsedRuleItem.postRulesStart);
            }

            const parsedSeqRuleItem: TranslitRuleItemParsed = {
                ...clonedParsedRuleItem,
                index: subRuleIndex == null ? ruleIndex || 0 : subRuleIndex,
                seqIndex,
                tplSeqName,
                firstSeq,
                totalSeqCount,
                parsedFrom: fromReplaced,
                fromRegExp:
                    subRuleIndex != null && postRulesStrategy === 'whileMatch'
                        ? new RegExp(`${fromReplaced}`, 'g')
                        : new RegExp(`^${fromReplaced}`),
                parsedTo: (clonedParsedRuleItem.parsedTo as string).replace(tplSeqName, currToChar),
                leftRegExp: clonedParsedRuleItem.parsedLeft
                    ? new RegExp(`${clonedParsedRuleItem.parsedLeft}$`)
                    : undefined,
                rightRegExp: clonedParsedRuleItem.parsedRight
                    ? new RegExp(`^${clonedParsedRuleItem.parsedRight}`)
                    : undefined,
                parsedPostRules: postRules
                    ? parseSubRuleItems(
                          postRules,
                          tplSeq,
                          tplVar,
                          globalTplVar,
                          postRulesDef,
                          postRulesStrategy,
                          phaseIndex,
                          ruleIndex
                      )
                    : undefined
            };

            seqIndex++;

            parseQuickTestsForSeq(parsedSeqRuleItem, tplSeqName, currFromChar, firstSeq);

            parsedRuleItems.push(parsedSeqRuleItem);

            firstSeq = false;
        }

        firstSeq = false;
    }

    return parsedRuleItems;
};

const parseQuickTestsForSeq = (
    parsedRuleItem: TranslitRuleItemParsed,
    tplSeqName: string,
    currFromChar: string,
    firstSeq: boolean
): void => {
    if (!parsedRuleItem.quickTests) {
        return;
    }

    for (let i = 0; i < parsedRuleItem.quickTests.length; i++) {
        const qt = parsedRuleItem.quickTests[i];
        if (qt[0] === tplSeqName) {
            qt[0] = currFromChar;
            parsedRuleItem.quickTests[i] = qt;
        } else if (firstSeq) {
            parsedRuleItem.seqQuickTests = parsedRuleItem.seqQuickTests || [];
            parsedRuleItem.seqQuickTests.push([qt[0], qt[1]]);
        }
    }
};

const assignPostRulesStarts = (
    postRules: TranslitSubRuleItem[],
    postRulesStart: { [orGroup: string]: number }
): void => {
    const keys = Object.keys(postRulesStart);
    for (const key of keys) {
        for (const postRule of postRules) {
            if (postRule.orGroup === key) {
                postRule.start = postRulesStart[key];
            }
        }
    }
};

const parseSubRuleItems = (
    subRuleItems: TranslitSubRuleItem[],
    tplSeq?: { [key: string]: [string, string, number][] },
    tplVar?: { [key: string]: string },
    globalTplVar?: { [key: string]: string },
    postRulesDef?: { [key: string]: TranslitSubRuleItem[] },
    postRulesStrategy?: PostRulesStrategy,
    phaseIndex?: number,
    ruleIndex?: number
): TranslitSubRuleItemParsed[] => {
    const parsedSubRuleItems: TranslitSubRuleItemParsed[] = [];

    for (let i = 0; i < subRuleItems.length; i++) {
        const subRuleItem = subRuleItems[i];
        const parsedItems = parseTpl(
            subRuleItem,
            tplSeq,
            tplVar,
            globalTplVar,
            postRulesDef,
            postRulesStrategy,
            phaseIndex,
            ruleIndex,
            i
        ) as TranslitSubRuleItemParsed[];
        parsedSubRuleItems.push(...parsedItems);
    }

    return parsedSubRuleItems;
};

/**
 * The main method to convert source text to target script using transliterate rules.
 * @param sourceText Input string to convert.
 * @param rulesToUse One-time transliterate rules to use.
 * @param [userOptions] The user selected options to check with 'when' rule options.
 * @param [trace] Flag to include transliteration trace information in the result.
 * @returns Returns the result object.
 * @throws {Error} Throws error if there is a invalid option or a parsing error.
 */
export function translit(
    sourceText: string,
    rulesToUse: TranslitRule | TranslitRulePhase[] | TranslitRuleItem[],
    userOptions?: { [option: string]: boolean | string },
    trace?: boolean
): TranslitResult {
    if (!sourceText || !sourceText.trim().length) {
        return {
            outputText: sourceText,
            replaced: false
        };
    }

    const rule = toTranslitRule(rulesToUse);
    const translitResult = applyRule(sourceText, parseRule(rule), userOptions, trace);

    return translitResult;
}
