import type { Trade, SchemaNode, ConstraintRule } from '../types.ts';

// Helper to generate a realistic dark candlestick SVG data URL for screenshots
export function createCandleSvgDataUrl(
  title: string,
  symbol: string,
  direction: 'LONG' | 'SHORT',
  isWin: boolean
): string {
  const width = 800;
  const height = 450;
  const bg = '#09090b';
  const grid = '#18181b';
  const border = '#27272a';
  const text = '#a1a1aa';
  const green = '#22c55e';
  const red = '#ef4444';

  const candles = [];
  let price = direction === 'LONG' ? 100 : 120;
  const count = 28;

  for (let i = 0; i < count; i++) {
    const x = 50 + i * 25;
    const isUp = i === count - 1 ? isWin : Math.sin(i) > 0;
    const change = (Math.random() * 6 - 2.8) * (isWin && i > count - 6 ? (direction === 'LONG' ? 1.5 : -1.5) : 1);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    price = close;

    const candleColor = close >= open ? green : red;
    const yTop = 380 - (Math.max(open, close) - 80) * 4;
    const yBottom = 380 - (Math.min(open, close) - 80) * 4;
    const yHigh = 380 - (high - 80) * 4;
    const yLow = 380 - (low - 80) * 4;
    const candleHeight = Math.max(2, yBottom - yTop);

    candles.push(`
      <line x1="${x + 6}" y1="${yHigh}" x2="${x + 6}" y2="${yLow}" stroke="${candleColor}" stroke-width="1.5" />
      <rect x="${x}" y="${yTop}" width="12" height="${candleHeight}" fill="${candleColor}" />
    `);
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${bg}"/>
      <!-- Grid -->
      <line x1="40" y1="80" x2="760" y2="80" stroke="${grid}" stroke-width="1" />
      <line x1="40" y1="160" x2="760" y2="160" stroke="${grid}" stroke-width="1" />
      <line x1="40" y1="240" x2="760" y2="240" stroke="${grid}" stroke-width="1" />
      <line x1="40" y1="320" x2="760" y2="320" stroke="${grid}" stroke-width="1" />
      <line x1="40" y1="400" x2="760" y2="400" stroke="${border}" stroke-width="1" />
      <line x1="40" y1="40" x2="40" y2="400" stroke="${border}" stroke-width="1" />
      <line x1="760" y1="40" x2="760" y2="400" stroke="${border}" stroke-width="1" />

      <!-- Candlesticks -->
      ${candles.join('')}

      <!-- Terminal Header Info -->
      <text x="50" y="32" fill="#e4e4e7" font-family="monospace" font-size="14" font-weight="bold">${symbol} 5M // ${direction} [${title}]</text>
      <text x="580" y="32" fill="${text}" font-family="monospace" font-size="11">EXEC_LOG: 2026-10-14 14:30 UTC</text>
      <text x="50" y="430" fill="${text}" font-family="monospace" font-size="10">BARS: 28 | SCALE: 100-140 | TICKS: NORMALIZED</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_SCHEMA_NODES: SchemaNode[] = [
  {
    id: 'node_setup',
    parentId: null,
    name: 'Setup & Modell',
    type: 'TEXT',
    isRequired: true,
    children: [
      {
        id: 'node_breakout',
        parentId: 'node_setup',
        name: 'Kitörés (Breakout)',
        type: 'BOOLEAN',
        isRequired: false,
      },
      {
        id: 'node_pullback',
        parentId: 'node_setup',
        name: 'Visszateszt (Pullback)',
        type: 'BOOLEAN',
        isRequired: false,
      },
      {
        id: 'node_mean_reversion',
        parentId: 'node_setup',
        name: 'Átlaghoz Visszatérés (Mean Rev)',
        type: 'BOOLEAN',
        isRequired: false,
      },
    ],
  },
  {
    id: 'node_momentum',
    parentId: null,
    name: 'Momentum & Hullám',
    type: 'TEXT',
    isRequired: false,
    children: [
      {
        id: 'node_elliott_wave',
        parentId: 'node_momentum',
        name: 'Elliott 3. Hullám',
        type: 'BOOLEAN',
        isRequired: false,
      },
      {
        id: 'node_pitchfork',
        parentId: 'node_momentum',
        name: 'Andrews Pitchfork',
        type: 'BOOLEAN',
        isRequired: false,
      },
      {
        id: 'node_vol_ratio',
        parentId: 'node_momentum',
        name: 'Volumen Többlet %',
        type: 'PERCENTAGE',
        isRequired: false,
      },
    ],
  },
  {
    id: 'node_execution',
    parentId: null,
    name: 'Végrehajtás & Kockázat',
    type: 'TEXT',
    isRequired: false,
    children: [
      {
        id: 'node_retracement',
        parentId: 'node_execution',
        name: 'Visszahúzódás Mélység %',
        type: 'PERCENTAGE',
        isRequired: true, // Required field!
      },
      {
        id: 'node_slippage',
        parentId: 'node_execution',
        name: 'Csúszás (Tick)',
        type: 'NUMBER',
        isRequired: false,
      },
      {
        id: 'node_htf_aligned',
        parentId: 'node_execution',
        name: 'HTF Trenddel Azonos',
        type: 'BOOLEAN',
        isRequired: true, // Required field!
      },
    ],
  },
];

export const INITIAL_CONSTRAINTS: ConstraintRule[] = [
  {
    id: 'rule_1',
    sourceNodeId: 'node_breakout',
    targetNodeId: 'node_pullback',
    type: 'MUTUALLY_EXCLUSIVE',
  },
  {
    id: 'rule_2',
    sourceNodeId: 'node_pitchfork',
    targetNodeId: 'node_elliott_wave',
    type: 'MUTUALLY_EXCLUSIVE',
  },
  {
    id: 'rule_3',
    sourceNodeId: 'node_breakout',
    targetNodeId: 'node_vol_ratio',
    type: 'REQUIRES',
  },
];

export const INITIAL_COMMITTED_TRADES: Trade[] = [
  {
    id: 'TRD_1001',
    ticketId: 'TK_88910',
    symbol: 'NQ_F',
    direction: 'LONG',
    openTime: '2026-09-18T13:30:00Z',
    closeTime: '2026-09-18T14:15:00Z',
    size: 2,
    openPrice: 20120.5,
    closePrice: 20195.0,
    pnl: 1490.0,
    pnlR: 2.8,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('14:15 TP Reached', 'NQ_F', 'LONG', true)],
    markdownNote: `# Nyitási lendület kitörés\n\n- Londoni csúcs likviditási söprés után azonnali visszafordulás\n- Kockázat: 26 pont ($520)\n- Hozam: 74.5 pont ($1490)\n- Végrehajtás csúszás nélkül.`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_elliott_wave: true,
      node_vol_ratio: 145,
      node_retracement: 38.2,
      node_slippage: 0,
      node_htf_aligned: true,
    },
  },
  {
    id: 'TRD_1002',
    ticketId: 'TK_88912',
    symbol: 'NQ_F',
    direction: 'SHORT',
    openTime: '2026-09-19T15:00:00Z',
    closeTime: '2026-09-19T15:20:00Z',
    size: 1,
    openPrice: 20250.0,
    closePrice: 20280.0,
    pnl: -600.0,
    pnlR: -1.0,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('15:20 SL Hit', 'NQ_F', 'SHORT', false)],
    markdownNote: `# Felső zóna elutasítás próbálkozás\n\n- Az ellenállás nem tartott, azonnali stop kiütés.\n- Fegyelmezett kilépés, nem volt tilt vagy átlagolás.`,
    customAttributes: {
      node_setup: 'Pullback',
      node_breakout: false,
      node_pullback: true,
      node_retracement: 61.8,
      node_slippage: 1,
      node_htf_aligned: false,
    },
  },
  {
    id: 'TRD_1003',
    ticketId: 'TK_88925',
    symbol: 'ES_F',
    direction: 'LONG',
    openTime: '2026-09-22T14:00:00Z',
    closeTime: '2026-09-22T16:00:00Z',
    size: 3,
    openPrice: 5780.25,
    closePrice: 5802.5,
    pnl: 3337.5,
    pnlR: 3.5,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('16:00 Target 2', 'ES_F', 'LONG', true)],
    markdownNote: `# Trendkövető mély visszateszt\n\n- 4H trendirányú vételi zóna\n- 3 kontraktus, részleges zárás 5795-nél.`,
    customAttributes: {
      node_setup: 'Pullback',
      node_breakout: false,
      node_pullback: true,
      node_pitchfork: true,
      node_retracement: 50.0,
      node_slippage: 0,
      node_htf_aligned: true,
    },
  },
  {
    id: 'TRD_1004',
    ticketId: 'TK_88940',
    symbol: 'EURUSD',
    direction: 'SHORT',
    openTime: '2026-09-25T08:30:00Z',
    closeTime: '2026-09-25T09:15:00Z',
    size: 5,
    openPrice: 1.092,
    closePrice: 1.0885,
    pnl: 1750.0,
    pnlR: 2.1,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('09:15 London TP', 'EURUSD', 'SHORT', true)],
    markdownNote: `# London Open Short sweep\n\n- Ázsiai csúcsok elvétele, majd hirtelen lefordulás.`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_vol_ratio: 180,
      node_retracement: 50.0,
      node_slippage: 0,
      node_htf_aligned: true,
    },
  },
  {
    id: 'TRD_1005',
    ticketId: 'TK_88955',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    openTime: '2026-09-28T11:00:00Z',
    closeTime: '2026-09-28T11:45:00Z',
    size: 0.5,
    openPrice: 67200.0,
    closePrice: 66900.0,
    pnl: -150.0,
    pnlR: -1.0,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('11:45 SL Out', 'BTCUSDT', 'LONG', false)],
    markdownNote: `# Hétvégi tartománykitörési álca\n\n- Gyenge volumen, a kitörés elakadt.`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_vol_ratio: 110,
      node_retracement: 23.6,
      node_slippage: 2,
      node_htf_aligned: false,
    },
  },
  {
    id: 'TRD_1006',
    ticketId: 'TK_88970',
    symbol: 'NQ_F',
    direction: 'LONG',
    openTime: '2026-10-01T13:45:00Z',
    closeTime: '2026-10-01T14:35:00Z',
    size: 2,
    openPrice: 20300.0,
    closePrice: 20390.0,
    pnl: 1800.0,
    pnlR: 3.0,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('14:35 Runner TP', 'NQ_F', 'LONG', true)],
    markdownNote: `# ISM adatközlés utáni momentum\n\n- Tiszta 3. hullámos elmozdulás 5 percesen.`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_elliott_wave: true,
      node_vol_ratio: 220,
      node_retracement: 38.2,
      node_slippage: 1,
      node_htf_aligned: true,
    },
  },
  {
    id: 'TRD_1007',
    ticketId: 'TK_88982',
    symbol: 'ES_F',
    direction: 'SHORT',
    openTime: '2026-10-03T15:10:00Z',
    closeTime: '2026-10-03T15:40:00Z',
    size: 2,
    openPrice: 5820.0,
    closePrice: 5828.5,
    pnl: -850.0,
    pnlR: -1.1,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('15:40 Stopped', 'ES_F', 'SHORT', false)],
    markdownNote: `# Csúcs-ellenállás teszt elbukott\n\n- Erős vásárlók lépték át a szintet.`,
    customAttributes: {
      node_setup: 'Mean Rev',
      node_mean_reversion: true,
      node_retracement: 78.6,
      node_slippage: 0,
      node_htf_aligned: false,
    },
  },
  {
    id: 'TRD_1008',
    ticketId: 'TK_88995',
    symbol: 'NQ_F',
    direction: 'LONG',
    openTime: '2026-10-06T14:10:00Z',
    closeTime: '2026-10-06T15:05:00Z',
    size: 2,
    openPrice: 20410.0,
    closePrice: 20475.0,
    pnl: 1300.0,
    pnlR: 2.2,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('15:05 Clean Exit', 'NQ_F', 'LONG', true)],
    markdownNote: `# VWAP visszateszt pattintás\n\n- Intranapi támasz megtartotta az árat.`,
    customAttributes: {
      node_setup: 'Pullback',
      node_breakout: false,
      node_pullback: true,
      node_retracement: 50.0,
      node_slippage: 0,
      node_htf_aligned: true,
    },
  },
  {
    id: 'TRD_1009',
    ticketId: 'TK_89010',
    symbol: 'AAPL',
    direction: 'LONG',
    openTime: '2026-10-08T13:35:00Z',
    closeTime: '2026-10-08T14:50:00Z',
    size: 200,
    openPrice: 232.5,
    closePrice: 236.0,
    pnl: 700.0,
    pnlR: 2.0,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('14:50 Target Hit', 'AAPL', 'LONG', true)],
    markdownNote: `# Technológiai szektor kitörés\n\n- Relatív erő az indexekhez képest.`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_vol_ratio: 160,
      node_retracement: 38.2,
      node_slippage: 0,
      node_htf_aligned: true,
    },
  },
  {
    id: 'TRD_1010',
    ticketId: 'TK_89025',
    symbol: 'NQ_F',
    direction: 'SHORT',
    openTime: '2026-10-10T16:00:00Z',
    closeTime: '2026-10-10T16:25:00Z',
    size: 2,
    openPrice: 20550.0,
    closePrice: 20480.0,
    pnl: 1400.0,
    pnlR: 2.4,
    status: 'COMMITTED',
    screenshots: [createCandleSvgDataUrl('16:25 EOD Dump', 'NQ_F', 'SHORT', true)],
    markdownNote: `# Zárás előtti profitrealizálás lejtmenet\n\n- Sikeres eladás a napi csúcs alól.`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_vol_ratio: 130,
      node_retracement: 50.0,
      node_slippage: 0,
      node_htf_aligned: true,
    },
  },
];

export const INITIAL_PENDING_TRADES: Trade[] = [
  {
    id: 'TRD_PENDING_01',
    ticketId: 'TK_90111',
    symbol: 'NQ_F',
    direction: 'LONG',
    openTime: '2026-10-14T14:15:00Z',
    closeTime: '2026-10-14T14:45:00Z',
    size: 2,
    openPrice: 20420.0,
    closePrice: 20490.0,
    pnl: 1400.0,
    pnlR: 2.8,
    status: 'PENDING',
    screenshots: [
      createCandleSvgDataUrl('2026-10-14_14-30-00.png', 'NQ_F', 'LONG', true),
      createCandleSvgDataUrl('2026-10-14_14-45-00.png [TP]', 'NQ_F', 'LONG', true),
    ],
    markdownNote: `# NQ Nyitási Söprés utáni kitörés\n\n- Nyitás 20420\n- Célár elérve 20490-nél\n- 5 perces támasz megerősítés`,
    customAttributes: {
      node_setup: 'Breakout',
      node_breakout: true,
      node_pullback: false,
      node_vol_ratio: 165,
      // intentionally missing node_retracement & node_htf_aligned to demonstrate strict commit button disable
    },
  },
  {
    id: 'TRD_PENDING_02',
    ticketId: 'TK_90114',
    symbol: 'ES_F',
    direction: 'SHORT',
    openTime: '2026-10-14T15:10:00Z',
    closeTime: '2026-10-14T15:35:00Z',
    size: 1,
    openPrice: 5870.0,
    closePrice: 5882.0,
    pnl: -600.0,
    pnlR: -1.0,
    status: 'PENDING',
    screenshots: [createCandleSvgDataUrl('2026-10-14_15-20-00.png', 'ES_F', 'SHORT', false)],
    markdownNote: `# ES Ellenállási teszt elbukva\n\n- Belépés 5870\n- Stop kivéve 5882-nél`,
    customAttributes: {},
  },
  {
    id: 'TRD_PENDING_03',
    ticketId: 'TK_90118',
    symbol: 'EURUSD',
    direction: 'LONG',
    openTime: '2026-10-14T08:00:00Z',
    closeTime: '2026-10-14T09:10:00Z',
    size: 4,
    openPrice: 1.085,
    closePrice: 1.0895,
    pnl: 1800.0,
    pnlR: 2.25,
    status: 'PENDING',
    screenshots: [createCandleSvgDataUrl('2026-10-14_08-30-00.png', 'EURUSD', 'LONG', true)],
    markdownNote: `# London Open kitörés\n\n- ECB beszéd előtti felhalmozás`,
    customAttributes: {},
  },
  {
    id: 'TRD_PENDING_04',
    ticketId: 'TK_90122',
    symbol: 'BTCUSDT',
    direction: 'SHORT',
    openTime: '2026-10-14T12:00:00Z',
    closeTime: '2026-10-14T12:40:00Z',
    size: 0.5,
    openPrice: 68400.0,
    closePrice: 67700.0,
    pnl: 350.0,
    pnlR: 1.75,
    status: 'PENDING',
    screenshots: [createCandleSvgDataUrl('2026-10-14_12-15-00.png', 'BTCUSDT', 'SHORT', true)],
    markdownNote: `# Likviditás elvétel 68.5k alatt\n\n- Gyors scalp elmozdulás`,
    customAttributes: {},
  },
];
