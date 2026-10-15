import React, { useState, useRef, useMemo } from 'react';
import type { Trade, ChartType, ChartSeriesConfig } from '../types.ts';
import {
  buildEquityCurve,
  buildDistributionHistogram,
  buildScatterPoints,
  EquityPoint,
} from '../utils/math.ts';
import { filterTrades } from '../utils/filterEngine.ts';

interface TerminalChartProps {
  allTrades: Trade[];
  seriesList: ChartSeriesConfig[];
  chartType: ChartType;
  height?: number;
  showControls?: boolean;
}

export const TerminalChart: React.FC<TerminalChartProps> = ({
  allTrades,
  seriesList,
  chartType,
  height = 420,
  showControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomX, setZoomX] = useState<number>(1);
  const [zoomY, setZoomY] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<number>(0);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; text: string } | null>(null);

  // Compute series data for Equity Curve
  const equitySeriesData = useMemo(() => {
    if (chartType !== 'EQUITY') return [];
    return seriesList
      .filter(s => s.visible)
      .map(s => {
        const filtered = filterTrades(allTrades, s.filters);
        const points = buildEquityCurve(filtered);
        return {
          seriesId: s.id,
          label: s.label,
          color: s.color,
          points,
        };
      });
  }, [allTrades, seriesList, chartType]);

  // Compute distribution data
  const distributionData = useMemo(() => {
    if (chartType !== 'DISTRIBUTION') return null;
    const activeSeries = seriesList.find(s => s.visible) || seriesList[0];
    const filtered = activeSeries ? filterTrades(allTrades, activeSeries.filters) : allTrades;
    return {
      hist: buildDistributionHistogram(filtered, 'pnlR', 12),
      color: activeSeries ? activeSeries.color : '#22c55e',
      label: activeSeries ? activeSeries.label : 'Összes',
    };
  }, [allTrades, seriesList, chartType]);

  // Compute scatter data
  const scatterData = useMemo(() => {
    if (chartType !== 'SCATTER') return null;
    const activeSeries = seriesList.find(s => s.visible) || seriesList[0];
    const filtered = activeSeries ? filterTrades(allTrades, activeSeries.filters) : allTrades;
    return {
      points: buildScatterPoints(filtered, 'size', 'pnlR'),
      color: activeSeries ? activeSeries.color : '#38bdf8',
      label: activeSeries ? activeSeries.label : 'Méret vs PnL (R)',
    };
  }, [allTrades, seriesList, chartType]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart(e.clientX - panX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Dimensions
  const paddingLeft = 65;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;
  const chartWidth = 850 * zoomX;
  const chartHeight = height - paddingTop - paddingBottom;

  // Zoom helpers
  const handleZoomX = (delta: number) => {
    setZoomX(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  const handleZoomY = (delta: number) => {
    setZoomY(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  const handleResetZoom = () => {
    setZoomX(1);
    setZoomY(1);
    setPanX(0);
  };

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-none w-full select-none">
      {/* Chart Top Controls Bar */}
      {showControls && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 font-mono text-[11px] tracking-wider uppercase">
              TÉRKÉP: {chartType}
            </span>
            {/* Series legends */}
            <div className="flex items-center gap-3">
              {seriesList.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: s.color }} />
                  <span className={s.visible ? 'text-zinc-200' : 'text-zinc-600'}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-[10px] mr-1">TENGELY SKÁLA:</span>
            <button
              onClick={() => handleZoomX(0.25)}
              className="px-2 py-0.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px]"
            >
              [X +]
            </button>
            <button
              onClick={() => handleZoomX(-0.25)}
              className="px-2 py-0.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px]"
            >
              [X -]
            </button>
            <button
              onClick={() => handleZoomY(0.25)}
              className="px-2 py-0.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px]"
            >
              [Y +]
            </button>
            <button
              onClick={() => handleZoomY(-0.25)}
              className="px-2 py-0.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px]"
            >
              [Y -]
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px]"
            >
              [1:1 ALAP]
            </button>
          </div>
        </div>
      )}

      {/* SVG Canvas Area */}
      <div
        ref={containerRef}
        className="relative overflow-hidden cursor-crosshair w-full"
        style={{ height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {chartType === 'EQUITY' && (
          <EquityCurveSvg
            seriesData={equitySeriesData}
            width={chartWidth}
            height={height}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingTop={paddingTop}
            paddingBottom={paddingBottom}
            zoomY={zoomY}
            panX={panX}
            onHoverPoint={setHoveredPoint}
          />
        )}

        {chartType === 'DISTRIBUTION' && distributionData && (
          <DistributionSvg
            data={distributionData}
            width={chartWidth}
            height={height}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingTop={paddingTop}
            paddingBottom={paddingBottom}
            zoomY={zoomY}
            panX={panX}
            onHoverPoint={setHoveredPoint}
          />
        )}

        {chartType === 'SCATTER' && scatterData && (
          <ScatterSvg
            data={scatterData}
            width={chartWidth}
            height={height}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingTop={paddingTop}
            paddingBottom={paddingBottom}
            zoomY={zoomY}
            panX={panX}
            onHoverPoint={setHoveredPoint}
          />
        )}

        {/* Hover info overlay badge */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 px-2 py-1 text-[11px] bg-zinc-900 border border-zinc-700 text-zinc-200 font-mono shadow-none"
            style={{ left: Math.min(hoveredPoint.x + 12, 650), top: Math.max(10, hoveredPoint.y - 30) }}
          >
            {hoveredPoint.text}
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------
// EQUITY CURVE SVG RENDERER
// ----------------------------------------------------
interface EquityCurveSvgProps {
  seriesData: Array<{ seriesId: string; label: string; color: string; points: EquityPoint[] }>;
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  zoomY: number;
  panX: number;
  onHoverPoint: (pt: { x: number; y: number; text: string } | null) => void;
}

const EquityCurveSvg: React.FC<EquityCurveSvgProps> = ({
  seriesData,
  width,
  height,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
  zoomY,
  panX,
  onHoverPoint,
}) => {
  // Find global min and max Y (PnL)
  const allPoints = seriesData.flatMap(s => s.points);
  const maxTrades = Math.max(1, ...seriesData.map(s => s.points.length));

  let minY = 0;
  let maxY = 100;
  if (allPoints.length > 0) {
    minY = Math.min(0, ...allPoints.map(p => p.cumPnl));
    maxY = Math.max(100, ...allPoints.map(p => p.cumPnl));
  }

  // Apply Y zoom
  const ySpan = (maxY - minY) || 100;
  const effectiveMinY = minY - (ySpan * (1 / zoomY - 1)) / 2;
  const effectiveMaxY = maxY + (ySpan * (1 / zoomY - 1)) / 2;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const scaleX = (idx: number) => paddingLeft + panX + (idx / maxTrades) * innerWidth;
  const scaleY = (val: number) => {
    const norm = (val - effectiveMinY) / (effectiveMaxY - effectiveMinY || 1);
    return paddingTop + (1 - norm) * innerHeight;
  };

  const zeroY = scaleY(0);

  // Y-axis grid lines (5 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => {
    const val = effectiveMinY + frac * (effectiveMaxY - effectiveMinY);
    return { val, y: scaleY(val) };
  });

  return (
    <svg
      width="100%"
      height={height}
      className="overflow-visible"
      onMouseLeave={() => onHoverPoint(null)}
    >
      {/* Background Grid */}
      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line
            x1={paddingLeft}
            y1={t.y}
            x2={width - paddingRight}
            y2={t.y}
            stroke="#27272a"
            strokeWidth="1"
            strokeDasharray={t.val === 0 ? undefined : '2 2'}
          />
          <text
            x={paddingLeft - 8}
            y={t.y + 4}
            fill="#71717a"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="end"
          >
            ${t.val.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Zero line */}
      <line
        x1={paddingLeft}
        y1={zeroY}
        x2={width - paddingRight}
        y2={zeroY}
        stroke="#52525b"
        strokeWidth="1.2"
      />

      {/* Series Lines & Dots */}
      {seriesData.map(s => {
        if (!s.points.length) return null;
        const coords = s.points.map(pt => ({
          x: scaleX(pt.index),
          y: scaleY(pt.cumPnl),
          pt,
        }));

        const pathData = coords.reduce((acc, c, idx) => {
          return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
        }, '');

        return (
          <g key={s.seriesId}>
            <path
              d={pathData}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {coords.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={3}
                fill={c.pt.pnl >= 0 ? '#22c55e' : '#ef4444'}
                stroke="#09090b"
                strokeWidth="1"
                className="hover:scale-150 transition-transform cursor-pointer"
                onMouseEnter={() =>
                  onHoverPoint({
                    x: c.x,
                    y: c.y,
                    text: `#${c.pt.index} | ${c.pt.symbol} | PnL: $${c.pt.pnl.toFixed(2)} (${c.pt.pnlR}R) | Kum: $${c.pt.cumPnl.toFixed(2)}`,
                  })
                }
              />
            ))}
          </g>
        );
      })}

      {/* X Axis Labels */}
      <g>
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="#3f3f46"
          strokeWidth="1"
        />
        {Array.from({ length: Math.min(10, maxTrades) }, (_, i) => {
          const tradeNum = Math.round((i / Math.min(10, maxTrades)) * maxTrades) || 1;
          const x = scaleX(tradeNum);
          return (
            <text
              key={i}
              x={x}
              y={height - paddingBottom + 16}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              #{tradeNum}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

// ----------------------------------------------------
// DISTRIBUTION HISTOGRAM SVG RENDERER
// ----------------------------------------------------
interface DistributionSvgProps {
  data: {
    hist: { bins: Array<{ min: number; max: number; count: number; percentage: number }>; min: number; max: number; binWidth: number };
    color: string;
    label: string;
  };
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  zoomY: number;
  panX: number;
  onHoverPoint: (pt: { x: number; y: number; text: string } | null) => void;
}

const DistributionSvg: React.FC<DistributionSvgProps> = ({
  data,
  width,
  height,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
  zoomY,
  panX,
  onHoverPoint,
}) => {
  const { bins } = data.hist;
  const maxCount = Math.max(1, ...bins.map(b => b.count));
  const effectiveMaxCount = maxCount / zoomY;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const barWidth = innerWidth / (bins.length || 1);

  return (
    <svg
      width="100%"
      height={height}
      className="overflow-visible"
      onMouseLeave={() => onHoverPoint(null)}
    >
      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
        const countVal = (frac * effectiveMaxCount).toFixed(0);
        const y = paddingTop + (1 - frac) * innerHeight;
        return (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#27272a"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 8}
              y={y + 4}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {countVal} db
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {bins.map((b, i) => {
        const x = paddingLeft + panX + i * barWidth;
        const barHeight = (b.count / effectiveMaxCount) * innerHeight;
        const y = paddingTop + innerHeight - barHeight;
        const isWin = b.min >= 0;

        return (
          <g key={i}>
            <rect
              x={x + 2}
              y={y}
              width={Math.max(2, barWidth - 4)}
              height={Math.max(0, barHeight)}
              fill={isWin ? '#22c55e' : '#ef4444'}
              opacity="0.8"
              stroke="#27272a"
              strokeWidth="1"
              onMouseEnter={() =>
                onHoverPoint({
                  x: x + barWidth / 2,
                  y,
                  text: `Sáv: [${b.min}R .. ${b.max}R] | Kötések: ${b.count} (${b.percentage}%)`,
                })
              }
            />
            <text
              x={x + barWidth / 2}
              y={height - paddingBottom + 16}
              fill="#71717a"
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {b.min}R
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ----------------------------------------------------
// SCATTER PLOT SVG RENDERER
// ----------------------------------------------------
interface ScatterSvgProps {
  data: {
    points: Array<{ x: number; y: number; tradeId: string; symbol: string; label: string }>;
    color: string;
    label: string;
  };
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  zoomY: number;
  panX: number;
  onHoverPoint: (pt: { x: number; y: number; text: string } | null) => void;
}

const ScatterSvg: React.FC<ScatterSvgProps> = ({
  data,
  width,
  height,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
  zoomY,
  panX,
  onHoverPoint,
}) => {
  const { points } = data;
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);

  const minX = Math.min(0, ...xValues);
  const maxX = Math.max(5, ...xValues);
  const minY = Math.min(-2, ...yValues);
  const maxY = Math.max(5, ...yValues);

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const effectiveSpanY = (maxY - minY) / zoomY || 1;
  const effectiveMinY = minY;
  const effectiveMaxY = minY + effectiveSpanY;

  const scaleX = (val: number) => paddingLeft + panX + ((val - minX) / (maxX - minX || 1)) * innerWidth;
  const scaleY = (val: number) => {
    const norm = (val - effectiveMinY) / (effectiveMaxY - effectiveMinY || 1);
    return paddingTop + (1 - norm) * innerHeight;
  };

  return (
    <svg
      width="100%"
      height={height}
      className="overflow-visible"
      onMouseLeave={() => onHoverPoint(null)}
    >
      {/* Zero line for Y */}
      <line
        x1={paddingLeft}
        y1={scaleY(0)}
        x2={width - paddingRight}
        y2={scaleY(0)}
        stroke="#52525b"
        strokeWidth="1"
      />

      {/* Grid lines */}
      {[0, 0.33, 0.66, 1].map((frac, idx) => {
        const val = effectiveMinY + frac * (effectiveMaxY - effectiveMinY);
        const y = scaleY(val);
        return (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#27272a"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text
              x={paddingLeft - 8}
              y={y + 4}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {val.toFixed(1)}R
            </text>
          </g>
        );
      })}

      {/* Scatter Points */}
      {points.map((p, i) => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);
        const isWin = p.y >= 0;

        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={5}
            fill={isWin ? '#22c55e' : '#ef4444'}
            stroke="#09090b"
            strokeWidth="1.5"
            opacity="0.85"
            className="hover:scale-150 transition-transform cursor-pointer"
            onMouseEnter={() =>
              onHoverPoint({
                x: cx,
                y: cy,
                text: `${p.label} | X: ${p.x} | Y: ${p.y}R`,
              })
            }
          />
        );
      })}
    </svg>
  );
};
