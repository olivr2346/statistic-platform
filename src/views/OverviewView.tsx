import React, { useState, useMemo } from 'react';
import type { Trade, TimeframeFilter } from '../types.ts';
import { calculateTradingMetrics, filterTradesByTimeframe } from '../utils/math.ts';
import { TerminalChart } from '../components/TerminalChart.tsx';

interface OverviewViewProps {
  committedTrades: Trade[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({ committedTrades }) => {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('ALL');

  // Filter trades by timeframe
  const filteredTrades = useMemo(() => {
    return filterTradesByTimeframe(committedTrades, timeframe);
  }, [committedTrades, timeframe]);

  // Compute metrics
  const metrics = useMemo(() => {
    return calculateTradingMetrics(filteredTrades);
  }, [filteredTrades]);

  // Instrument breakdown table
  const symbolStats = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of filteredTrades) {
      const list = map.get(t.symbol) || [];
      list.push(t);
      map.set(t.symbol, list);
    }

    return Array.from(map.entries()).map(([sym, trades]) => {
      const symMetrics = calculateTradingMetrics(trades);
      return {
        symbol: sym,
        count: trades.length,
        winRate: symMetrics.winRate,
        profitFactor: symMetrics.profitFactor,
        expectancyR: symMetrics.expectancyR,
        netProfit: symMetrics.netProfit,
      };
    });
  }, [filteredTrades]);

  return (
    <div className="h-[calc(100vh-42px)] overflow-hidden flex flex-col p-2.5 gap-2.5 bg-zinc-950 font-mono select-none">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">IDŐTÁV SZŰRŐ:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTimeframe('ALL')}
              className={`tui-bracket-btn btn-sm ${timeframe === 'ALL' ? 'is-selected' : ''}`}
            >
              Összes
            </button>
            <button
              onClick={() => setTimeframe('LAST_100')}
              className={`tui-bracket-btn btn-sm ${timeframe === 'LAST_100' ? 'is-selected' : ''}`}
            >
              Utolsó 100
            </button>
            <button
              onClick={() => setTimeframe('LAST_50')}
              className={`tui-bracket-btn btn-sm ${timeframe === 'LAST_50' ? 'is-selected' : ''}`}
            >
              Utolsó 50
            </button>
            <button
              onClick={() => setTimeframe('30D')}
              className={`tui-bracket-btn btn-sm ${timeframe === '30D' ? 'is-selected' : ''}`}
            >
              30 nap
            </button>
            <button
              onClick={() => setTimeframe('7D')}
              className={`tui-bracket-btn btn-sm ${timeframe === '7D' ? 'is-selected' : ''}`}
            >
              7 nap
            </button>
          </div>
        </div>

        <div className="text-xs text-zinc-400">
          MINTAMÉRET: <span className="text-zinc-100 font-bold">{filteredTrades.length}</span> / {committedTrades.length} KÖTÉS
        </div>
      </div>

      {/* Exact Mathematical Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
        {/* Win Rate */}
        <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">TALÁLATI ARÁNY (WIN RATE)</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {metrics.winRate.toFixed(2)}<span className="text-sm font-normal text-zinc-400">%</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            W: <span className="text-emerald-400">{metrics.winCount}</span> | L: <span className="text-rose-400">{metrics.lossCount}</span>
          </div>
        </div>

        {/* Expectancy */}
        <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">VÁRHATÓ ÉRTÉK (EXPECTANCY)</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {metrics.expectancyR >= 0 ? '+' : ''}{metrics.expectancyR.toFixed(2)}<span className="text-sm font-normal text-zinc-400"> R</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            {metrics.expectancyDollar >= 0 ? '+' : ''}${metrics.expectancyDollar.toFixed(2)} / trade
          </div>
        </div>

        {/* Profit Factor */}
        <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">PROFIT FAKTOR (PROFIT FACTOR)</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {metrics.profitFactor >= 999 ? 'INF' : metrics.profitFactor.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            GP: ${metrics.grossProfit.toFixed(0)} | GL: ${metrics.grossLoss.toFixed(0)}
          </div>
        </div>

        {/* Avg Win / Avg Loss */}
        <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">ÁTLAG NYERŐ / VESZTŐ</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {metrics.winLossRatio.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            +${metrics.avgWinDollar.toFixed(0)} / -${metrics.avgLossDollar.toFixed(0)}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">MAX DRAWDOWN</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            -{metrics.maxDrawdownPercent.toFixed(2)}<span className="text-sm font-normal text-zinc-400">%</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            CSÚCS-VÖLGY: -${metrics.maxDrawdownDollar.toFixed(2)}
          </div>
        </div>

        {/* Long / Short & Trades */}
        <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 flex flex-col justify-between">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">KÖTÉSEK & L/S ARÁNY</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {metrics.totalTrades} <span className="text-sm font-normal text-zinc-400">({metrics.longShortRatio.toFixed(2)} L/S)</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            LONG: {metrics.longCount} | SHORT: {metrics.shortCount}
          </div>
        </div>
      </div>

      {/* Lower Section: Split Canvas & Breakdown Table (fitting in 100vh) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
        {/* Left: Terminal Equity Curve */}
        <div className="col-span-8 flex flex-col border border-zinc-800 bg-zinc-900/20 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs">
            <span className="text-zinc-300 font-bold tracking-wider">KUMULATÍV EGYENLEG (EQUITY GÖRBE)</span>
            <span className="text-zinc-400 text-[11px]">
              NET PNL: <span className={metrics.netProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {metrics.netProfit >= 0 ? '+' : ''}${metrics.netProfit.toFixed(2)}
              </span>
            </span>
          </div>
          <div className="flex-1 min-h-0 p-1">
            <TerminalChart
              allTrades={filteredTrades}
              seriesList={[
                {
                  id: 's_main',
                  label: 'Kumulatív Egyenleg',
                  color: '#22c55e',
                  filters: [],
                  visible: true,
                },
              ]}
              chartType="EQUITY"
              height={280}
              showControls={false}
            />
          </div>
        </div>

        {/* Right: Asset & Strategy Performance Table */}
        <div className="col-span-4 flex flex-col border border-zinc-800 bg-zinc-900/20 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs font-bold text-zinc-300">
            INSTRUMENTUM BONTÁS
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800 text-[10px]">
                <tr>
                  <th className="py-1.5 px-2.5">TICKER</th>
                  <th className="py-1.5 px-2">DB</th>
                  <th className="py-1.5 px-2">WIN%</th>
                  <th className="py-1.5 px-2">PF</th>
                  <th className="py-1.5 px-2">EXP(R)</th>
                  <th className="py-1.5 px-2 text-right">PNL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                {symbolStats.map(s => (
                  <tr key={s.symbol} className="hover:bg-zinc-800/30">
                    <td className="py-1.5 px-2.5 font-bold text-zinc-200">{s.symbol}</td>
                    <td className="py-1.5 px-2 text-zinc-400">{s.count}</td>
                    <td className="py-1.5 px-2 text-zinc-300">{s.winRate.toFixed(1)}%</td>
                    <td className="py-1.5 px-2 text-zinc-300">{s.profitFactor.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-zinc-300">{s.expectancyR.toFixed(2)}R</td>
                    <td className={`py-1.5 px-2 text-right font-bold ${s.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.netProfit >= 0 ? '+' : ''}${s.netProfit.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-2 border-t border-zinc-800 text-[10px] text-zinc-400 flex justify-between bg-zinc-900/30">
            <span>SZÁMÍTÁSI MÓDSZER: EXAKT KVANT</span>
            <span>NO-SCROLL 100VH</span>
          </div>
        </div>
      </div>
    </div>
  );
};
