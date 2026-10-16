import type { Trade, FilterRule } from '../types.ts';

export function evaluateSingleRule(trade: Trade, rule: FilterRule): boolean {
  let targetValue: any;

  if (rule.isCustomAttr) {
    targetValue = trade.customAttributes ? trade.customAttributes[rule.field] : undefined;
  } else {
    // Standard trade field
    targetValue = (trade as any)[rule.field];
  }

  // Handle undefined
  if (targetValue === undefined || targetValue === null) {
    if (rule.operator === 'NOT_EQUALS') return true;
    return false;
  }

  const ruleVal = rule.value;

  switch (rule.operator) {
    case 'EQUALS': {
      if (typeof targetValue === 'boolean') {
        const boolRuleVal = ruleVal === true || ruleVal === 'true' || ruleVal === 1 || ruleVal === '1';
        return targetValue === boolRuleVal;
      }
      const strTarget = String(targetValue).trim();
      const strRule = String(ruleVal).trim();
      if (strTarget !== '' && strRule !== '') {
        const numTarget = Number(strTarget);
        const numRule = Number(strRule);
        if (!isNaN(numTarget) && !isNaN(numRule)) {
          return numTarget === numRule;
        }
      }
      return strTarget.toLowerCase() === strRule.toLowerCase();
    }
    case 'NOT_EQUALS': {
      if (typeof targetValue === 'boolean') {
        const boolRuleVal = ruleVal === true || ruleVal === 'true' || ruleVal === 1 || ruleVal === '1';
        return targetValue !== boolRuleVal;
      }
      const strTarget = String(targetValue).trim();
      const strRule = String(ruleVal).trim();
      if (strTarget !== '' && strRule !== '') {
        const numTarget = Number(strTarget);
        const numRule = Number(strRule);
        if (!isNaN(numTarget) && !isNaN(numRule)) {
          return numTarget !== numRule;
        }
      }
      return strTarget.toLowerCase() !== strRule.toLowerCase();
    }
    case 'GREATER': {
      const numTarget = parseFloat(targetValue);
      const numRule = parseFloat(String(ruleVal));
      if (isNaN(numTarget) || isNaN(numRule)) return false;
      return numTarget > numRule;
    }
    case 'LESS': {
      const numTarget = parseFloat(targetValue);
      const numRule = parseFloat(String(ruleVal));
      if (isNaN(numTarget) || isNaN(numRule)) return false;
      return numTarget < numRule;
    }
    case 'GREATER_EQUALS': {
      const numTarget = parseFloat(targetValue);
      const numRule = parseFloat(String(ruleVal));
      if (isNaN(numTarget) || isNaN(numRule)) return false;
      return numTarget >= numRule;
    }
    case 'LESS_EQUALS': {
      const numTarget = parseFloat(targetValue);
      const numRule = parseFloat(String(ruleVal));
      if (isNaN(numTarget) || isNaN(numRule)) return false;
      return numTarget <= numRule;
    }
    case 'CONTAINS': {
      return String(targetValue).toLowerCase().includes(String(ruleVal).toLowerCase());
    }
    default:
      return true;
  }
}

/**
 * Evaluates a sequence of rules chained by logic (AND / OR / NOT).
 * The first rule sets initial boolean state (or inverted if NOT).
 * Subsequent rules chain:
 * - AND: accumulator = accumulator && ruleMatches
 * - OR:  accumulator = accumulator || ruleMatches
 * - NOT: accumulator = accumulator && !ruleMatches
 */
export function evaluateFilterRules(trade: Trade, rules: FilterRule[]): boolean {
  if (!rules || rules.length === 0) return true;

  let currentResult = evaluateSingleRule(trade, rules[0]);
  if (rules[0].logic === 'NOT') {
    currentResult = !currentResult;
  }

  for (let i = 1; i < rules.length; i++) {
    const rule = rules[i];
    const match = evaluateSingleRule(trade, rule);

    if (rule.logic === 'AND') {
      currentResult = currentResult && match;
    } else if (rule.logic === 'OR') {
      currentResult = currentResult || match;
    } else if (rule.logic === 'NOT') {
      currentResult = currentResult && !match;
    }
  }

  return currentResult;
}

export function filterTrades(trades: Trade[], rules: FilterRule[]): Trade[] {
  if (!rules || rules.length === 0) return trades;
  return trades.filter(t => evaluateFilterRules(t, rules));
}
