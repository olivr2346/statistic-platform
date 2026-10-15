import test from 'node:test';
import assert from 'node:assert/strict';
import type { Trade, SchemaNode, ConstraintRule, FilterRule } from '../types.ts';
import {
  calculateTradingMetrics,
  buildEquityCurve,
  buildDistributionHistogram,
  filterTradesByTimeframe,
} from './math.ts';
import {
  generateTradeDeduplicationKey,
  deduplicateIncomingTrades,
  parseScreenshotTimestamp,
  matchScreenshotToTrades,
  validateTradeCustomAttributes,
} from './staging.ts';
import { evaluateFilterRules } from './filterEngine.ts';

const mockTrades: Trade[] = [
  {
    id: 'TRD_001',
    symbol: 'NQ_F',
    direction: 'LONG',
    openTime: '2026-10-10T09:30:00Z',
    closeTime: '2026-10-10T10:15:00Z',
    size: 2,
    openPrice: 20000,
    closePrice: 20050,
    pnl: 1000,
    pnlR: 2.5,
    status: 'COMMITTED',
    screenshots: [],
    markdownNote: 'Clean breakout',
    customAttributes: { setup_type: 'Breakout', retracement: 50 },
  },
  {
    id: 'TRD_002',
    symbol: 'NQ_F',
    direction: 'SHORT',
    openTime: '2026-10-11T13:00:00Z',
    closeTime: '2026-10-11T13:30:00Z',
    size: 1,
    openPrice: 20100,
    closePrice: 20120,
    pnl: -400,
    pnlR: -1.0,
    status: 'COMMITTED',
    screenshots: [],
    markdownNote: 'Failed rejection',
    customAttributes: { setup_type: 'Pullback', retracement: 61.8 },
  },
  {
    id: 'TRD_003',
    symbol: 'ES_F',
    direction: 'LONG',
    openTime: '2026-10-12T14:00:00Z',
    closeTime: '2026-10-12T15:00:00Z',
    size: 3,
    openPrice: 5800,
    closePrice: 5815,
    pnl: 2250,
    pnlR: 3.0,
    status: 'COMMITTED',
    screenshots: [],
    markdownNote: 'Trend follow',
    customAttributes: { setup_type: 'Breakout', retracement: 38.2 },
  },
];

test('calculateTradingMetrics computes accurate win rate, expectancy, and profit factor', () => {
  const metrics = calculateTradingMetrics(mockTrades);
  assert.equal(metrics.totalTrades, 3);
  assert.equal(metrics.winCount, 2);
  assert.equal(metrics.lossCount, 1);
  assert.equal(metrics.winRate, 66.67);
  assert.equal(metrics.grossProfit, 3250);
  assert.equal(metrics.grossLoss, 400);
  assert.equal(metrics.profitFactor, 8.13); // 3250 / 400 = 8.125 -> 8.13
  assert.equal(metrics.expectancyDollar, 950); // (1000 - 400 + 2250) / 3 = 950
  assert.equal(metrics.expectancyR, 1.5); // (2.5 - 1.0 + 3.0) / 3 = 1.5
  assert.equal(metrics.longCount, 2);
  assert.equal(metrics.shortCount, 1);
  assert.equal(metrics.longShortRatio, 2);
});

test('buildEquityCurve accumulates PnL correctly in chronological order', () => {
  const curve = buildEquityCurve(mockTrades);
  assert.equal(curve.length, 3);
  assert.equal(curve[0].cumPnl, 1000);
  assert.equal(curve[1].cumPnl, 600);
  assert.equal(curve[2].cumPnl, 2850);
});

test('buildDistributionHistogram bins values correctly', () => {
  const hist = buildDistributionHistogram(mockTrades, 'pnlR', 5);
  assert.equal(hist.bins.length, 5);
  const totalCount = hist.bins.reduce((acc, b) => acc + b.count, 0);
  assert.equal(totalCount, 3);
});

test('filterTradesByTimeframe slices recent trades properly', () => {
  const last1 = filterTradesByTimeframe(mockTrades, 'LAST_50');
  assert.equal(last1.length, 3);
});

test('generateTradeDeduplicationKey formats consistent identifier', () => {
  const key1 = generateTradeDeduplicationKey({
    symbol: ' NQ_f ',
    openTime: '2026-10-10T09:30:00Z',
    closeTime: '2026-10-10T10:15:00Z',
    size: 2,
  });
  const key2 = generateTradeDeduplicationKey({
    symbol: 'NQ_F',
    openTime: '2026-10-10T09:30:00Z',
    closeTime: '2026-10-10T10:15:00Z',
    size: 2.0000,
  });
  assert.equal(key1, key2);
});

test('deduplicateIncomingTrades ignores existing trades and counts duplicates', () => {
  const incoming: Trade[] = [
    mockTrades[0], // Duplicate
    {
      ...mockTrades[1],
      id: 'TRD_NEW',
      openTime: '2026-10-13T09:00:00Z',
      closeTime: '2026-10-13T09:30:00Z',
    },
  ];

  const result = deduplicateIncomingTrades(incoming, mockTrades);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.uniqueTrades.length, 1);
  assert.equal(result.uniqueTrades[0].id, 'TRD_NEW');
});

test('parseScreenshotTimestamp handles standard filename patterns', () => {
  const ts1 = parseScreenshotTimestamp('2026-10-14_14-30-00.png');
  assert.ok(ts1 !== null);
  const d1 = new Date(ts1);
  assert.equal(d1.getUTCFullYear(), 2026);
  assert.equal(d1.getUTCMonth(), 9); // October is 9
  assert.equal(d1.getUTCDate(), 14);
  assert.equal(d1.getUTCHours(), 14);
  assert.equal(d1.getUTCMinutes(), 30);
});

test('matchScreenshotToTrades finds matching trade within time window', () => {
  const matched = matchScreenshotToTrades('2026-10-10_09-45-00.png', mockTrades);
  assert.ok(matched !== null);
  assert.equal(matched?.id, 'TRD_001');
});

test('validateTradeCustomAttributes checks required nodes and constraints', () => {
  const schema: SchemaNode[] = [
    {
      id: 'setup',
      parentId: null,
      name: 'Setup',
      type: 'TEXT',
      isRequired: true,
    },
    {
      id: 'retracement',
      parentId: null,
      name: 'Retracement %',
      type: 'PERCENTAGE',
      isRequired: true,
    },
    {
      id: 'pitchfork',
      parentId: null,
      name: 'Andrews Pitchfork',
      type: 'BOOLEAN',
      isRequired: false,
    },
    {
      id: 'elliott',
      parentId: null,
      name: 'Elliott Wave',
      type: 'BOOLEAN',
      isRequired: false,
    },
  ];

  const constraints: ConstraintRule[] = [
    {
      id: 'c1',
      sourceNodeId: 'pitchfork',
      targetNodeId: 'elliott',
      type: 'MUTUALLY_EXCLUSIVE',
    },
  ];

  // Missing required field 'retracement'
  const r1 = validateTradeCustomAttributes({ setup: 'Breakout' }, schema, constraints);
  assert.equal(r1.isValid, false);
  assert.equal(r1.missingRequired.length, 1);
  assert.equal(r1.missingRequired[0].nodeId, 'retracement');

  // Both mutually exclusive selected
  const r2 = validateTradeCustomAttributes(
    { setup: 'Breakout', retracement: 50, pitchfork: true, elliott: true },
    schema,
    constraints
  );
  assert.equal(r2.isValid, false);
  assert.equal(r2.violatedConstraints.length, 1);

  // Valid
  const r3 = validateTradeCustomAttributes(
    { setup: 'Breakout', retracement: 50, pitchfork: true, elliott: false },
    schema,
    constraints
  );
  assert.equal(r3.isValid, true);
});

test('evaluateFilterRules evaluates complex AND / OR / NOT chains', () => {
  const rules: FilterRule[] = [
    {
      id: 'r1',
      field: 'symbol',
      isCustomAttr: false,
      operator: 'EQUALS',
      value: 'NQ_F',
      logic: 'AND',
    },
    {
      id: 'r2',
      field: 'pnlR',
      isCustomAttr: false,
      operator: 'GREATER',
      value: 2.0,
      logic: 'AND',
    },
  ];

  assert.equal(evaluateFilterRules(mockTrades[0], rules), true); // NQ_F & 2.5 > 2.0
  assert.equal(evaluateFilterRules(mockTrades[1], rules), false); // NQ_F & -1.0 is not > 2.0
  assert.equal(evaluateFilterRules(mockTrades[2], rules), false); // ES_F != NQ_F
});
