import type { Trade, TimeframeFilter } from '../types.ts';

export interface TradingMetrics {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  winRate: number; // in percent (0 - 100)
  lossRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectancyR: number;
  expectancyDollar: number;
  avgWinDollar: number;
  avgLossDollar: number;
  winLossRatio: number;
  maxDrawdownDollar: number;
  maxDrawdownPercent: number;
  longCount: number;
  shortCount: number;
  longShortRatio: number;
}

export function filterTradesByTimeframe(trades: Trade[], timeframe: TimeframeFilter): Trade[] {
  if (!trades.length || timeframe === 'ALL') {
    return [...trades];
  }

  // Sort chronologically ascending
  const sorted = [...trades].sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());

  if (timeframe === 'LAST_50') {
    return sorted.slice(-50);
  }
  if (timeframe === 'LAST_100') {
    return sorted.slice(-100);
  }

  // Date based filtering
  const latestTradeTime = sorted.length > 0 ? new Date(sorted[sorted.length - 1].closeTime).getTime() : Date.now();

  if (timeframe === '7D') {
    const cutoff = latestTradeTime - 7 * 24 * 60 * 60 * 1000;
    return sorted.filter(t => new Date(t.closeTime).getTime() >= cutoff);
  }
  if (timeframe === '30D') {
    const cutoff = latestTradeTime - 30 * 24 * 60 * 60 * 1000;
    return sorted.filter(t => new Date(t.closeTime).getTime() >= cutoff);
  }

  return sorted;
}

export function calculateTradingMetrics(trades: Trade[]): TradingMetrics {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      breakEvenCount: 0,
      winRate: 0,
      lossRate: 0,
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      expectancyR: 0,
      expectancyDollar: 0,
      avgWinDollar: 0,
      avgLossDollar: 0,
      winLossRatio: 0,
      maxDrawdownDollar: 0,
      maxDrawdownPercent: 0,
      longCount: 0,
      shortCount: 0,
      longShortRatio: 0,
    };
  }

  let winCount = 0;
  let lossCount = 0;
  let breakEvenCount = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let sumPnl = 0;
  let sumPnlR = 0;
  let longCount = 0;
  let shortCount = 0;

  for (const t of trades) {
    sumPnl += t.pnl;
    sumPnlR += t.pnlR;

    if (t.direction === 'LONG') longCount++;
    if (t.direction === 'SHORT') shortCount++;

    if (t.pnl > 0.0001) {
      winCount++;
      grossProfit += t.pnl;
    } else if (t.pnl < -0.0001) {
      lossCount++;
      grossLoss += Math.abs(t.pnl);
    } else {
      breakEvenCount++;
    }
  }

  const winRate = (winCount / totalTrades) * 100;
  const lossRate = (lossCount / totalTrades) * 100;
  const netProfit = sumPnl;
  const expectancyDollar = sumPnl / totalTrades;
  const expectancyR = sumPnlR / totalTrades;

  const profitFactor = grossLoss === 0 
    ? (grossProfit > 0 ? 999.99 : 0) 
    : grossProfit / grossLoss;

  const avgWinDollar = winCount > 0 ? grossProfit / winCount : 0;
  const avgLossDollar = lossCount > 0 ? grossLoss / lossCount : 0;
  const winLossRatio = avgLossDollar === 0 
    ? (avgWinDollar > 0 ? 99.99 : 0) 
    : avgWinDollar / avgLossDollar;

  const longShortRatio = shortCount === 0 
    ? (longCount > 0 ? 99.99 : 0) 
    : longCount / shortCount;

  // Drawdown calculation (sorted chronologically)
  const sorted = [...trades].sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());
  let runningEquity = 0;
  let peakEquity = 0;
  let maxDrawdownDollar = 0;
  let maxDrawdownPercent = 0;

  for (const t of sorted) {
    runningEquity += t.pnl;
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }
    const currentDrawdownDollar = peakEquity - runningEquity;
    if (currentDrawdownDollar > maxDrawdownDollar) {
      maxDrawdownDollar = currentDrawdownDollar;
    }
    if (peakEquity > 0) {
      const currentDrawdownPct = (currentDrawdownDollar / peakEquity) * 100;
      if (currentDrawdownPct > maxDrawdownPercent) {
        maxDrawdownPercent = currentDrawdownPct;
      }
    }
  }

  return {
    totalTrades,
    winCount,
    lossCount,
    breakEvenCount,
    winRate: Number(winRate.toFixed(2)),
    lossRate: Number(lossRate.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancyR: Number(expectancyR.toFixed(2)),
    expectancyDollar: Number(expectancyDollar.toFixed(2)),
    avgWinDollar: Number(avgWinDollar.toFixed(2)),
    avgLossDollar: Number(avgLossDollar.toFixed(2)),
    winLossRatio: Number(winLossRatio.toFixed(2)),
    maxDrawdownDollar: Number(maxDrawdownDollar.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    longCount,
    shortCount,
    longShortRatio: Number(longShortRatio.toFixed(2)),
  };
}

export interface EquityPoint {
  index: number;
  tradeId: string;
  date: string;
  symbol: string;
  pnl: number;
  pnlR: number;
  cumPnl: number;
  cumPnlR: number;
}

export function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());
  let cumPnl = 0;
  let cumPnlR = 0;

  return sorted.map((t, idx) => {
    cumPnl += t.pnl;
    cumPnlR += t.pnlR;
    return {
      index: idx + 1,
      tradeId: t.id,
      date: t.closeTime.split('T')[0] || t.closeTime,
      symbol: t.symbol,
      pnl: t.pnl,
      pnlR: t.pnlR,
      cumPnl: Number(cumPnl.toFixed(2)),
      cumPnlR: Number(cumPnlR.toFixed(2)),
    };
  });
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export function buildDistributionHistogram(
  trades: Trade[],
  metric: 'pnl' | 'pnlR' = 'pnlR',
  binCount = 10
): { bins: HistogramBin[]; min: number; max: number; binWidth: number } {
  if (!trades.length) {
    return { bins: [], min: 0, max: 0, binWidth: 0 };
  }

  const values = trades.map(t => (metric === 'pnl' ? t.pnl : t.pnlR));
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min = min - 1;
    max = max + 1;
  }

  const rawWidth = (max - min) / binCount;
  const binWidth = rawWidth === 0 ? 1 : rawWidth;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < binCount; i++) {
    const bMin = min + i * binWidth;
    const bMax = bMin + binWidth;
    bins.push({
      min: Number(bMin.toFixed(2)),
      max: Number(bMax.toFixed(2)),
      count: 0,
      percentage: 0,
    });
  }

  for (const v of values) {
    const binIdx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / binWidth)));
    bins[binIdx].count++;
  }

  for (const b of bins) {
    b.percentage = Number(((b.count / trades.length) * 100).toFixed(1));
  }

  return { bins, min: Number(min.toFixed(2)), max: Number(max.toFixed(2)), binWidth: Number(binWidth.toFixed(2)) };
}

export interface ScatterPoint {
  x: number;
  y: number;
  tradeId: string;
  symbol: string;
  label: string;
}

export function buildScatterPoints(
  trades: Trade[],
  xField: string,
  yMetric: 'pnl' | 'pnlR' = 'pnlR'
): ScatterPoint[] {
  const points: ScatterPoint[] = [];

  for (const t of trades) {
    let xVal: number | null = null;

    if (xField === 'size') {
      xVal = t.size;
    } else if (xField === 'openPrice') {
      xVal = t.openPrice;
    } else if (xField === 'holdingMinutes') {
      const open = new Date(t.openTime).getTime();
      const close = new Date(t.closeTime).getTime();
      xVal = Math.max(0, Math.round((close - open) / 60000));
    } else if (t.customAttributes && t.customAttributes[xField] !== undefined) {
      const parsed = parseFloat(t.customAttributes[xField]);
      if (!isNaN(parsed)) {
        xVal = parsed;
      }
    }

    if (xVal !== null) {
      points.push({
        x: xVal,
        y: yMetric === 'pnl' ? t.pnl : t.pnlR,
        tradeId: t.id,
        symbol: t.symbol,
        label: `${t.symbol} [${t.direction}]`,
      });
    }
  }

  return points;
}
