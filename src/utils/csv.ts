import type { Trade, SchemaNode } from '../types.ts';
import { flattenSchemaNodes } from './staging.ts';

export function exportTradesToCsv(trades: Trade[], schemaNodes: SchemaNode[]): string {
  const flatNodes = flattenSchemaNodes(schemaNodes);
  
  const baseHeaders = [
    'Trade ID',
    'Ticket ID',
    'Symbol',
    'Direction',
    'Open Time',
    'Close Time',
    'Size',
    'Open Price',
    'Close Price',
    'PnL ($)',
    'PnL (R)',
    'Status',
  ];

  const customHeaders = flatNodes.map(n => `ATTR_${n.name.replace(/,/g, '')}`);
  const allHeaders = [...baseHeaders, ...customHeaders, 'Notes'];

  const rows = trades.map(t => {
    const baseCols = [
      `"${t.id}"`,
      `"${t.ticketId || ''}"`,
      `"${t.symbol}"`,
      `"${t.direction}"`,
      `"${t.openTime}"`,
      `"${t.closeTime}"`,
      t.size,
      t.openPrice,
      t.closePrice,
      t.pnl,
      t.pnlR,
      `"${t.status}"`,
    ];

    const customCols = flatNodes.map(n => {
      const val = t.customAttributes ? t.customAttributes[n.id] : '';
      if (val === undefined || val === null) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    });

    const noteCol = `"${(t.markdownNote || '').replace(/"/g, '""')}"`;

    return [...baseCols, ...customCols, noteCol].join(',');
  });

  return [allHeaders.join(','), ...rows].join('\n');
}

export function parseCsvToTrades(csvText: string): Trade[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  
  const findIndex = (names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const symbolIdx = findIndex(['symbol', 'instrument', 'ticker', 'asset']);
  const directionIdx = findIndex(['direction', 'type', 'side', 'action']);
  const openTimeIdx = findIndex(['open time', 'opentime', 'entry time', 'open_time']);
  const closeTimeIdx = findIndex(['close time', 'closetime', 'exit time', 'close_time']);
  const sizeIdx = findIndex(['size', 'volume', 'lots', 'contracts', 'qty']);
  const openPriceIdx = findIndex(['open price', 'openprice', 'entry price', 'entry_price']);
  const closePriceIdx = findIndex(['close price', 'closeprice', 'exit price', 'exit_price']);
  const pnlIdx = findIndex(['pnl', 'profit', 'net profit', 'gain']);
  const pnlRIdx = findIndex(['r-multiple', 'pnl r', 'pnlr', 'r', 'multiple']);

  const trades: Trade[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Regex for CSV split handling quotes
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(lines[i])) !== null) {
      let str = match[1];
      if (str === undefined) break;
      if (str.startsWith('"') && str.endsWith('"')) {
        str = str.substring(1, str.length - 1).replace(/""/g, '"');
      }
      cols.push(str.trim());
      if (regex.lastIndex >= lines[i].length) break;
    }

    if (cols.length < 3) continue;

    const symbol = symbolIdx !== -1 && cols[symbolIdx] ? cols[symbolIdx].toUpperCase() : 'NQ_F';
    const rawDir = directionIdx !== -1 && cols[directionIdx] ? cols[directionIdx].toUpperCase() : 'LONG';
    const direction: 'LONG' | 'SHORT' = rawDir.includes('SHORT') || rawDir.includes('SELL') ? 'SHORT' : 'LONG';
    
    const nowIso = new Date().toISOString();
    const openTime = openTimeIdx !== -1 && cols[openTimeIdx] ? cols[openTimeIdx] : nowIso;
    const closeTime = closeTimeIdx !== -1 && cols[closeTimeIdx] ? cols[closeTimeIdx] : nowIso;
    
    const size = sizeIdx !== -1 ? (parseFloat(cols[sizeIdx]) || 1) : 1;
    const openPrice = openPriceIdx !== -1 ? (parseFloat(cols[openPriceIdx]) || 100) : 100;
    const closePrice = closePriceIdx !== -1 ? (parseFloat(cols[closePriceIdx]) || 105) : 105;
    
    let pnl = pnlIdx !== -1 ? parseFloat(cols[pnlIdx]) : NaN;
    if (isNaN(pnl)) {
      pnl = direction === 'LONG' ? (closePrice - openPrice) * size : (openPrice - closePrice) * size;
    }

    let pnlR = pnlRIdx !== -1 ? parseFloat(cols[pnlRIdx]) : NaN;
    if (isNaN(pnlR)) {
      // Estimate 1R as approximately $150 or percentage
      pnlR = pnl >= 0 ? pnl / 150 : pnl / 150;
    }

    trades.push({
      id: `TRD_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      symbol,
      direction,
      openTime,
      closeTime,
      size,
      openPrice: Number(openPrice.toFixed(2)),
      closePrice: Number(closePrice.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      pnlR: Number(pnlR.toFixed(2)),
      status: 'PENDING',
      screenshots: [],
      markdownNote: '',
      customAttributes: {},
    });
  }

  return trades;
}
