import React, { useState, useMemo } from 'react';
import type { Trade, SchemaNode } from '../types.ts';
import { flattenSchemaNodes } from '../utils/staging.ts';
import { exportTradesToCsv } from '../utils/csv.ts';

interface TableViewProps {
  committedTrades: Trade[];
  schemaTree: SchemaNode[];
}

type SortField = 'id' | 'openTime' | 'closeTime' | 'symbol' | 'direction' | 'size' | 'openPrice' | 'closePrice' | 'pnl' | 'pnlR';

export const TableView: React.FC<TableViewProps> = ({ committedTrades, schemaTree }) => {
  const [sortField, setSortField] = useState<SortField>('closeTime');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(
    committedTrades.length > 0 ? committedTrades[0].id : null
  );

  const flatNodes = useMemo(() => flattenSchemaNodes(schemaTree), [schemaTree]);

  // Filtering
  const filtered = useMemo(() => {
    return committedTrades.filter(t => {
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const inSymbol = t.symbol.toLowerCase().includes(q);
      const inId = t.id.toLowerCase().includes(q);
      const inNote = (t.markdownNote || '').toLowerCase().includes(q);
      return inSymbol || inId || inNote;
    });
  }, [committedTrades, directionFilter, searchQuery]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'openTime' || sortField === 'closeTime') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    const csvContent = exportTradesToCsv(committedTrades, schemaTree);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trade_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const jsonContent = JSON.stringify(committedTrades, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trade_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedTrade = useMemo(() => {
    return committedTrades.find(t => t.id === selectedTradeId) || null;
  }, [committedTrades, selectedTradeId]);

  return (
    <div className="h-[calc(100vh-42px)] flex flex-col p-2.5 gap-2 bg-zinc-950 font-mono select-none overflow-hidden">
      {/* Top Filter and Actions Toolbar */}
      <div className="flex items-center justify-between border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 uppercase tracking-wider text-[11px]">KERESÉS:</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Szűrés szimbólum, ID vagy jegyzet alapján..."
            className="bg-zinc-950 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-72"
          />

          <div className="h-4 w-px bg-zinc-800" />

          <span className="text-zinc-500 uppercase tracking-wider text-[11px]">IRÁNY:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDirectionFilter('ALL')}
              className={`tui-bracket-btn btn-sm ${directionFilter === 'ALL' ? 'is-selected' : ''}`}
            >
              MIND
            </button>
            <button
              onClick={() => setDirectionFilter('LONG')}
              className={`tui-bracket-btn btn-sm ${directionFilter === 'LONG' ? 'is-selected' : ''}`}
            >
              LONG
            </button>
            <button
              onClick={() => setDirectionFilter('SHORT')}
              className={`tui-bracket-btn btn-sm ${directionFilter === 'SHORT' ? 'is-selected' : ''}`}
            >
              SHORT
            </button>
          </div>
        </div>

        {/* Export Buttons - Kinetikus Bracket Gombok */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-[11px] mr-1">
            TALÁLATOK: <span className="text-zinc-200 font-bold">{sorted.length}</span> / {committedTrades.length}
          </span>
          <button
            onClick={handleExportCsv}
            className="tui-bracket-btn btn-sm"
          >
            CSV EXPORTÁLÁS
          </button>
          <button
            onClick={handleExportJson}
            className="tui-bracket-btn btn-sm"
          >
            JSON EXPORTÁLÁS
          </button>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 min-h-0 border border-zinc-800 bg-zinc-950 overflow-auto">
        <table className="w-full text-left text-xs font-mono border-collapse whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
            <tr>
              <th onClick={() => handleSort('id')} className="py-2 px-2.5 cursor-pointer hover:text-zinc-200">
                TRADE ID {sortField === 'id' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('openTime')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                NYITÁS {sortField === 'openTime' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('closeTime')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                ZÁRÁS {sortField === 'closeTime' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('symbol')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                SZIMBÓLUM {sortField === 'symbol' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('direction')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                IRÁNY {sortField === 'direction' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('size')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                MÉRET {sortField === 'size' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('openPrice')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                BELÉPŐ ÁR {sortField === 'openPrice' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('closePrice')} className="py-2 px-2 cursor-pointer hover:text-zinc-200">
                KILÉPŐ ÁR {sortField === 'closePrice' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('pnl')} className="py-2 px-2 cursor-pointer hover:text-zinc-200 text-right">
                PNL ($) {sortField === 'pnl' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('pnlR')} className="py-2 px-2 cursor-pointer hover:text-zinc-200 text-right">
                PNL (R) {sortField === 'pnlR' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              {/* Dynamic Schema Columns */}
              {flatNodes.map(node => (
                <th key={node.id} className="py-2 px-2 text-zinc-400 font-normal">
                  {node.name.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-[11px]">
            {sorted.map(trade => {
              const isSelected = trade.id === selectedTradeId;
              const isWin = trade.pnl >= 0;

              return (
                <tr
                  key={trade.id}
                  onClick={() => setSelectedTradeId(trade.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-800 text-zinc-100' : 'hover:bg-zinc-900/60 text-zinc-300'
                  }`}
                >
                  <td className="py-1.5 px-2.5 font-bold">{trade.id}</td>
                  <td className="py-1.5 px-2 text-zinc-400">{trade.openTime.replace('T', ' ').slice(0, 16)}</td>
                  <td className="py-1.5 px-2 text-zinc-400">{trade.closeTime.replace('T', ' ').slice(0, 16)}</td>
                  <td className="py-1.5 px-2 font-bold text-zinc-100">{trade.symbol}</td>
                  <td className="py-1.5 px-2">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold ${
                        trade.direction === 'LONG'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">{trade.size}</td>
                  <td className="py-1.5 px-2">{trade.openPrice.toFixed(2)}</td>
                  <td className="py-1.5 px-2">{trade.closePrice.toFixed(2)}</td>
                  <td className={`py-1.5 px-2 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isWin ? '+' : ''}${trade.pnl.toFixed(2)}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isWin ? '+' : ''}{trade.pnlR.toFixed(2)}R
                  </td>

                  {/* Dynamic Custom Attributes */}
                  {flatNodes.map(node => {
                    const rawVal = trade.customAttributes ? trade.customAttributes[node.id] : undefined;
                    let displayVal = '-';
                    if (rawVal !== undefined && rawVal !== null) {
                      if (typeof rawVal === 'boolean') {
                        displayVal = rawVal ? 'IGEN' : 'NEM';
                      } else {
                        displayVal = String(rawVal);
                      }
                    }

                    return (
                      <td key={node.id} className="py-1.5 px-2 text-zinc-400">
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* In-Page Bottom Inspection Pane (Strict No Modal Rule!) */}
      {selectedTrade && (
        <div className="h-auto md:h-32 shrink-0 border border-zinc-800 bg-zinc-900/40 p-2.5 flex flex-col md:flex-row gap-3 text-xs overflow-y-auto">
          <div className="w-full md:w-64 md:border-r border-zinc-800 md:pr-3 flex flex-col justify-between shrink-0">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">KIVÁLASZTOTT KÖTÉS RÉSZLETEI</div>
              <div className="text-sm font-bold text-zinc-100 mt-0.5">
                {selectedTrade.id} // {selectedTrade.symbol} [{selectedTrade.direction}]
              </div>
            </div>
            <div className="text-[11px] text-zinc-400 space-y-0.5 mt-1">
              <div>Belépő: ${selectedTrade.openPrice.toFixed(2)} → Kilépő: ${selectedTrade.closePrice.toFixed(2)}</div>
              <div>Méret: {selectedTrade.size} | Ticket: {selectedTrade.ticketId || 'N/A'}</div>
              <div>
                Eredmény: <span className={selectedTrade.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)} ({selectedTrade.pnlR}R)
                </span>
              </div>
            </div>
          </div>

          {/* Trade Markdown Note Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
              KERESKEDÉSI JEGYZET (MARKDOWN)
            </div>
            <div className="flex-1 min-h-[50px] overflow-y-auto bg-zinc-950/80 border border-zinc-800 p-2 text-[11px] text-zinc-300 whitespace-pre-wrap font-mono">
              {selectedTrade.markdownNote || '(Nincs rögzített kereskedési jegyzet)'}
            </div>
          </div>

          {/* Screenshots thumbnails */}
          <div className="w-full md:w-48 flex flex-col shrink-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
              CSATOLT KÉPEK ({selectedTrade.screenshots.length})
            </div>
            <div className="h-20 md:h-auto md:flex-1 bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center">
              {selectedTrade.screenshots.length > 0 ? (
                <img
                  src={selectedTrade.screenshots[0]}
                  alt="Trade thumbnail"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-zinc-600">NINCS KÉP</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
