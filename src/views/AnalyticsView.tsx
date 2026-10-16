import React, { useState, useMemo } from 'react';
import type { Trade, SchemaNode, ChartType, ChartSeriesConfig, FilterRule, LogicalOperator, FilterOperator } from '../types.ts';
import { flattenSchemaNodes } from '../utils/staging.ts';
import { filterTrades } from '../utils/filterEngine.ts';
import { calculateTradingMetrics } from '../utils/math.ts';
import { TerminalChart } from '../components/TerminalChart.tsx';

interface AnalyticsViewProps {
  committedTrades: Trade[];
  schemaTree: SchemaNode[];
}

const PALETTE = ['#22c55e', '#38bdf8', '#f59e0b', '#ec4899', '#a855f7', '#14b8a6'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ committedTrades, schemaTree }) => {
  const [chartType, setChartType] = useState<ChartType>('EQUITY');
  const [isSplitScreen, setIsSplitScreen] = useState<boolean>(false);

  // Flattened schema nodes for rule fields
  const flatNodes = useMemo(() => flattenSchemaNodes(schemaTree), [schemaTree]);

  // Primary Study Series List (Infinite Stacking)
  const [seriesList, setSeriesList] = useState<ChartSeriesConfig[]>([
    {
      id: 'series_all',
      label: 'Összes Kötés (Alapvonal)',
      color: '#22c55e',
      filters: [],
      visible: true,
    },
    {
      id: 'series_long',
      label: 'Csak Long Irány',
      color: '#38bdf8',
      filters: [
        {
          id: 'f_long_1',
          field: 'direction',
          isCustomAttr: false,
          operator: 'EQUALS',
          value: 'LONG',
          logic: 'AND',
        },
      ],
      visible: true,
    },
  ]);

  // Active series currently being edited in the Extreme Filter Engine
  const [activeSeriesId, setActiveSeriesId] = useState<string>('series_all');

  // Secondary Study Series for Split View (Study B)
  const [secondarySeriesList, setSecondarySeriesList] = useState<ChartSeriesConfig[]>([
    {
      id: 'series_breakouts',
      label: 'Breakout Setupok',
      color: '#f59e0b',
      filters: [
        {
          id: 'f_b1',
          field: 'node_breakout',
          isCustomAttr: true,
          operator: 'EQUALS',
          value: true,
          logic: 'AND',
        },
      ],
      visible: true,
    },
  ]);

  const activeSeries = useMemo(() => {
    return seriesList.find(s => s.id === activeSeriesId) || seriesList[0];
  }, [seriesList, activeSeriesId]);

  // Filtered trades for active series
  const activeSeriesTrades = useMemo(() => {
    if (!activeSeries) return [];
    return filterTrades(committedTrades, activeSeries.filters);
  }, [committedTrades, activeSeries]);

  const activeSeriesMetrics = useMemo(() => {
    return calculateTradingMetrics(activeSeriesTrades);
  }, [activeSeriesTrades]);

  // Series actions
  const handleAddSeries = () => {
    const nextIdx = seriesList.length;
    const newColor = PALETTE[nextIdx % PALETTE.length];
    const newId = `series_${Date.now()}`;
    const newSeries: ChartSeriesConfig = {
      id: newId,
      label: `Adatsor #${nextIdx + 1}`,
      color: newColor,
      filters: [],
      visible: true,
    };
    setSeriesList([...seriesList, newSeries]);
    setActiveSeriesId(newId);
  };

  const handleDeleteSeries = (id: string) => {
    if (seriesList.length <= 1) return;
    const remaining = seriesList.filter(s => s.id !== id);
    setSeriesList(remaining);
    if (activeSeriesId === id) {
      setActiveSeriesId(remaining[0].id);
    }
  };

  const handleUpdateSeriesColor = (id: string, color: string) => {
    setSeriesList(prev => prev.map(s => (s.id === id ? { ...s, color } : s)));
  };

  const handleToggleSeriesVisible = (id: string) => {
    setSeriesList(prev => prev.map(s => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  // Rule actions on active series
  const handleAddRule = () => {
    if (!activeSeries) return;
    const newRule: FilterRule = {
      id: `rule_${Date.now()}`,
      field: 'symbol',
      isCustomAttr: false,
      operator: 'EQUALS',
      value: 'NQ_F',
      logic: activeSeries.filters.length === 0 ? 'AND' : 'AND',
    };
    const updatedFilters = [...activeSeries.filters, newRule];
    setSeriesList(prev =>
      prev.map(s => (s.id === activeSeries.id ? { ...s, filters: updatedFilters } : s))
    );
  };

  const handleUpdateRule = (ruleId: string, patch: Partial<FilterRule>) => {
    if (!activeSeries) return;
    const updatedFilters = activeSeries.filters.map(r => (r.id === ruleId ? { ...r, ...patch } : r));
    setSeriesList(prev =>
      prev.map(s => (s.id === activeSeries.id ? { ...s, filters: updatedFilters } : s))
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!activeSeries) return;
    const updatedFilters = activeSeries.filters.filter(r => r.id !== ruleId);
    setSeriesList(prev =>
      prev.map(s => (s.id === activeSeries.id ? { ...s, filters: updatedFilters } : s))
    );
  };

  return (
    <div className="h-[calc(100vh-42px)] flex flex-col p-2.5 gap-2 bg-zinc-950 font-mono select-none overflow-hidden">
      {/* Top Toolbar: Chart Type & View Mode */}
      <div className="flex items-center justify-between border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 uppercase tracking-wider text-[11px]">GRAFIKON TÍPUS:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setChartType('EQUITY')}
              className={`tui-bracket-btn btn-sm ${chartType === 'EQUITY' ? 'is-selected' : ''}`}
            >
              EQUITY GÖRBE
            </button>
            <button
              onClick={() => setChartType('DISTRIBUTION')}
              className={`tui-bracket-btn btn-sm ${chartType === 'DISTRIBUTION' ? 'is-selected' : ''}`}
            >
              ELOSZLÁS / HISTOGRAM
            </button>
            <button
              onClick={() => setChartType('SCATTER')}
              className={`tui-bracket-btn btn-sm ${chartType === 'SCATTER' ? 'is-selected' : ''}`}
            >
              SZÓRÁSDIAGRAM (SCATTER)
            </button>
          </div>
        </div>

        {/* Split Screen Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 uppercase tracking-wider text-[11px] mr-1">MEGJELENÍTÉS:</span>
          <button
            onClick={() => setIsSplitScreen(false)}
            className={`tui-bracket-btn btn-sm ${!isSplitScreen ? 'is-selected' : ''}`}
          >
            EGYETLEN GRAFIKON
          </button>
          <button
            onClick={() => setIsSplitScreen(true)}
            className={`tui-bracket-btn btn-sm ${isSplitScreen ? 'is-selected' : ''}`}
          >
            OSZTOTT KÉPERNYŐ (SPLIT)
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
        {/* Left Side: Charts (8 Cols or 6/6 if split) */}
        <div className={`${isSplitScreen ? 'col-span-8' : 'col-span-8'} flex flex-col gap-2 min-h-0`}>
          {!isSplitScreen ? (
            // Single View
            <div className="flex-1 min-h-0 flex flex-col border border-zinc-800 bg-zinc-950 overflow-hidden">
              <TerminalChart
                allTrades={committedTrades}
                seriesList={seriesList}
                chartType={chartType}
                height={390}
                showControls={true}
              />

              {/* Real-time Math Summary for Active Series */}
              <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/40 grid grid-cols-5 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500 block text-[10px]">AKTÍV ADATSOR:</span>
                  <span className="font-bold text-zinc-200">{activeSeries?.label}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">TALÁLATI ARÁNY:</span>
                  <span className="font-bold text-zinc-100">{activeSeriesMetrics.winRate.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">PROFIT FAKTOR:</span>
                  <span className="font-bold text-zinc-100">{activeSeriesMetrics.profitFactor.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">EXPECTANCY (R):</span>
                  <span className="font-bold text-zinc-100">
                    {activeSeriesMetrics.expectancyR >= 0 ? '+' : ''}{activeSeriesMetrics.expectancyR.toFixed(2)}R
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">NETTO PNL:</span>
                  <span className={`font-bold ${activeSeriesMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${activeSeriesMetrics.netProfit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Split Screen View: 2 charts side by side
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
              {/* Study A */}
              <div className="border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                <div className="px-2 py-1 bg-zinc-900/80 border-b border-zinc-800 text-[10px] text-zinc-300 font-bold">
                  [VIZSGÁLAT A] // ELSŐDLEGES MODELL
                </div>
                <div className="flex-1 min-h-0">
                  <TerminalChart
                    allTrades={committedTrades}
                    seriesList={seriesList}
                    chartType={chartType}
                    height={360}
                    showControls={false}
                  />
                </div>
              </div>

              {/* Study B */}
              <div className="border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                <div className="px-2 py-1 bg-zinc-900/80 border-b border-zinc-800 text-[10px] text-zinc-300 font-bold">
                  [VIZSGÁLAT B] // KONTROLL / ÖSSZEHASONLÍTÁS
                </div>
                <div className="flex-1 min-h-0">
                  <TerminalChart
                    allTrades={committedTrades}
                    seriesList={secondarySeriesList}
                    chartType={chartType}
                    height={360}
                    showControls={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Series Manager & Extreme Filter Engine (4 Cols) */}
        <div className="col-span-4 flex flex-col border border-zinc-800 bg-zinc-950 min-h-0 overflow-hidden text-xs">
          {/* Stacking Series List Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/70 font-bold text-zinc-300">
            <span>ADATSOROK (STACKING)</span>
            <button
              onClick={handleAddSeries}
              className="tui-bracket-btn btn-xs"
            >
              + ÚJ ADATSOR
            </button>
          </div>

          {/* Series selector pill list */}
          <div className="p-2 border-b border-zinc-800 bg-zinc-900/30 flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {seriesList.map(s => {
              const isSelected = s.id === activeSeriesId;

              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSeriesId(s.id)}
                  className={`flex items-center justify-between p-1.5 border cursor-pointer ${
                    isSelected ? 'bg-zinc-800/90 border-zinc-600' : 'bg-zinc-950 border-zinc-800/60 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Color picker box */}
                    <input
                      type="color"
                      value={s.color}
                      onChange={e => handleUpdateSeriesColor(s.id, e.target.value)}
                      className="w-4 h-4 rounded-none cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={s.label}
                      onChange={e => {
                        const val = e.target.value;
                        setSeriesList(prev => prev.map(item => (item.id === s.id ? { ...item, label: val } : item)));
                      }}
                      className="bg-transparent border-none text-zinc-200 font-mono text-[11px] focus:outline-none w-36"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleToggleSeriesVisible(s.id);
                      }}
                      className={`tui-bracket-btn btn-xs ${s.visible ? 'is-selected' : ''}`}
                    >
                      {s.visible ? 'LÁTHATÓ' : 'REJTETT'}
                    </button>
                    {seriesList.length > 1 && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteSeries(s.id);
                        }}
                        className="tui-bracket-btn btn-xs btn-danger"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extreme Filter Engine for Active Series */}
          <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 font-bold text-zinc-300 text-[11px]">
              <span>EXTRÉM SZŰRŐMOTOR (KORLÁTLAN)</span>
              <button
                onClick={handleAddRule}
                className="tui-bracket-btn btn-xs"
              >
                + ÚJ SZABÁLY
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {activeSeries?.filters.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 text-xs font-mono">
                  Nincs aktív szűrőszabály. (Minden kötés bekerül ebbe az adatsorba).
                  <div className="mt-2">
                    <button
                      onClick={handleAddRule}
                      className="tui-bracket-btn btn-sm"
                    >
                      ELSŐ SZABÁLY HOZZÁADÁSA
                    </button>
                  </div>
                </div>
              ) : (
                activeSeries?.filters.map((rule, idx) => (
                  <div key={rule.id} className="p-2 border border-zinc-800 bg-zinc-900/30 flex flex-col gap-1.5">
                    {/* Logic row if not first rule */}
                    <div className="flex items-center justify-between">
                      {idx > 0 ? (
                        <div className="flex items-center gap-1">
                          {(['AND', 'OR', 'NOT'] as LogicalOperator[]).map(op => (
                            <button
                              key={op}
                              onClick={() => handleUpdateRule(rule.id, { logic: op })}
                              className={`tui-bracket-btn btn-xs ${rule.logic === op ? 'is-selected' : ''}`}
                            >
                              {op}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-bold">ALAPSZABÁLY #1</span>
                      )}

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="tui-bracket-btn btn-xs btn-danger"
                      >
                        TÖRLÉS
                      </button>
                    </div>

                    {/* Field & Operator & Value */}
                    <div className="grid grid-cols-12 gap-1 text-[11px]">
                      {/* Field selection */}
                      <select
                        value={rule.isCustomAttr ? `ATTR_${rule.field}` : rule.field}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.startsWith('ATTR_')) {
                            const attrId = val.replace('ATTR_', '');
                            handleUpdateRule(rule.id, { field: attrId, isCustomAttr: true });
                          } else {
                            handleUpdateRule(rule.id, { field: val, isCustomAttr: false });
                          }
                        }}
                        className="col-span-5 bg-zinc-950 border border-zinc-700 px-1 py-0.5 text-zinc-200 focus:outline-none"
                      >
                        <optgroup label="Alapmezők">
                          <option value="symbol">Szimbólum</option>
                          <option value="direction">Irány</option>
                          <option value="pnl">PnL ($)</option>
                          <option value="pnlR">PnL (R)</option>
                          <option value="size">Méret</option>
                        </optgroup>
                        <optgroup label="Kategóriafa attribútumok">
                          {flatNodes.map(n => (
                            <option key={n.id} value={`ATTR_${n.id}`}>
                              {n.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>

                      {/* Operator selection */}
                      <select
                        value={rule.operator}
                        onChange={e => handleUpdateRule(rule.id, { operator: e.target.value as FilterOperator })}
                        className="col-span-3 bg-zinc-950 border border-zinc-700 px-1 py-0.5 text-zinc-200 focus:outline-none"
                      >
                        <option value="EQUALS">==</option>
                        <option value="NOT_EQUALS">!=</option>
                        <option value="GREATER">&gt;</option>
                        <option value="LESS">&lt;</option>
                        <option value="GREATER_EQUALS">&gt;=</option>
                        <option value="LESS_EQUALS">&lt;=</option>
                        <option value="CONTAINS">tartalmaz</option>
                      </select>

                      {/* Value input */}
                      <input
                        type="text"
                        value={String(rule.value)}
                        onChange={e => handleUpdateRule(rule.id, { value: e.target.value })}
                        placeholder="Érték..."
                        className="col-span-4 bg-zinc-950 border border-zinc-700 px-1 py-0.5 text-zinc-100 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Filtered Count Ticker */}
            <div className="p-2 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-400">
              <span>TALÁLATOK:</span>
              <span className="text-zinc-100 font-bold">
                {activeSeriesTrades.length} / {committedTrades.length} KÖTÉS (
                {committedTrades.length > 0
                  ? ((activeSeriesTrades.length / committedTrades.length) * 100).toFixed(1)
                  : 0}
                %)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
