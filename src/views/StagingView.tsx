import React, { useState, useMemo, useRef } from 'react';
import type { Trade, SchemaNode, ConstraintRule } from '../types.ts';
import {
  validateTradeCustomAttributes,
  flattenSchemaNodes,
  deduplicateIncomingTrades,
  matchScreenshotToTrades,
  parseScreenshotTimestamp,
} from '../utils/staging.ts';
import { parseCsvToTrades } from '../utils/csv.ts';
import { createCandleSvgDataUrl } from '../data/seedData.ts';

interface StagingViewProps {
  pendingTrades: Trade[];
  committedTrades: Trade[];
  schemaTree: SchemaNode[];
  constraintRules: ConstraintRule[];
  onCommitTrade: (trade: Trade) => void;
  onAddPendingTrades: (trades: Trade[]) => void;
  onUpdatePendingTrade: (trade: Trade) => void;
  onNavigateToTable: () => void;
}

type StagingSubView = 'WORKSTATION' | 'CSV_IMPORT' | 'SCREENSHOT_DROP';

export const StagingView: React.FC<StagingViewProps> = ({
  pendingTrades,
  committedTrades,
  schemaTree,
  constraintRules,
  onCommitTrade,
  onAddPendingTrades,
  onUpdatePendingTrade,
  onNavigateToTable,
}) => {
  const [subView, setSubView] = useState<StagingSubView>('WORKSTATION');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [markdownMode, setMarkdownMode] = useState<'EDIT' | 'PREVIEW'>('EDIT');

  // Zoom & Pan state for Screenshot viewer
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // CSV Import State
  const [csvInput, setCsvInput] = useState<string>('');
  const [importReport, setImportReport] = useState<{ total: number; unique: number; duplicates: number } | null>(null);
  const [stagedImportTrades, setStagedImportTrades] = useState<Trade[]>([]);

  // Screenshot Batch State
  const [batchFileList, setBatchFileList] = useState<Array<{ name: string; size: number; matchedTradeId: string | null }>>([]);
  const [batchDataUrls, setBatchDataUrls] = useState<Record<string, string>>({});

  const currentTrade = pendingTrades[currentIndex] || null;
  const flatNodes = useMemo(() => flattenSchemaNodes(schemaTree), [schemaTree]);

  // Real-time validation of current trade
  const validation = useMemo(() => {
    if (!currentTrade) return { isValid: false, missingRequired: [], violatedConstraints: [] };
    return validateTradeCustomAttributes(
      currentTrade.customAttributes || {},
      schemaTree,
      constraintRules
    );
  }, [currentTrade, schemaTree, constraintRules]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panPos.x, y: e.clientY - panPos.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanPos({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoomLevel(prev => Math.max(0.4, Math.min(4, prev + delta)));
  };

  const resetZoomPan = () => {
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
  };

  // Stepper handlers
  const handlePrevTrade = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setCurrentImageIndex(0);
      resetZoomPan();
    }
  };

  const handleNextTrade = () => {
    if (currentIndex < pendingTrades.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentImageIndex(0);
      resetZoomPan();
    }
  };

  // Field change handler
  const handleAttributeChange = (nodeId: string, value: any) => {
    if (!currentTrade) return;
    const updatedAttributes = {
      ...(currentTrade.customAttributes || {}),
      [nodeId]: value,
    };
    onUpdatePendingTrade({
      ...currentTrade,
      customAttributes: updatedAttributes,
    });
  };

  // Note change handler
  const handleNoteChange = (text: string) => {
    if (!currentTrade) return;
    onUpdatePendingTrade({
      ...currentTrade,
      markdownNote: text,
    });
  };

  // Strict commit handler
  const handleCommit = () => {
    if (!currentTrade || !validation.isValid) return;
    const committed: Trade = {
      ...currentTrade,
      status: 'COMMITTED',
    };
    onCommitTrade(committed);
    // Auto advance (stay at current index or clamp)
    if (currentIndex >= pendingTrades.length - 1) {
      setCurrentIndex(Math.max(0, pendingTrades.length - 2));
    }
    setCurrentImageIndex(0);
    resetZoomPan();
  };

  // CSV parsing
  const handleProcessCsv = () => {
    if (!csvInput.trim()) return;
    const parsed = parseCsvToTrades(csvInput);
    const existing = [...committedTrades, ...pendingTrades];
    const { uniqueTrades, duplicateCount } = deduplicateIncomingTrades(parsed, existing);
    setImportReport({
      total: parsed.length,
      unique: uniqueTrades.length,
      duplicates: duplicateCount,
    });
    setStagedImportTrades(uniqueTrades);
  };

  const handleAcceptImportedTrades = () => {
    if (!stagedImportTrades.length) return;
    onAddPendingTrades(stagedImportTrades);
    setStagedImportTrades([]);
    setCsvInput('');
    setImportReport(null);
    setSubView('WORKSTATION');
  };

  const handleLoadSampleCsv = () => {
    const sample = `Symbol,Direction,Open Time,Close Time,Size,Open Price,Close Price,PnL,PnL R
NQ_F,LONG,2026-10-14T17:00:00Z,2026-10-14T17:35:00Z,2,20460.00,20515.00,1100.00,2.2
ES_F,SHORT,2026-10-14T18:10:00Z,2026-10-14T18:40:00Z,1,5890.00,5898.00,-400.00,-1.0
BTCUSDT,LONG,2026-10-14T19:00:00Z,2026-10-14T19:50:00Z,0.5,67800.00,68450.00,325.00,1.6
NQ_F,LONG,2026-09-18T13:30:00Z,2026-09-18T14:15:00Z,2,20120.50,20195.00,1490.00,2.8`; // contains 1 duplicate!
    setCsvInput(sample);
  };

  // Batch Screenshot handling
  const handleBatchFileSelect = (files: FileList | null) => {
    if (!files) return;
    const items: Array<{ name: string; size: number; matchedTradeId: string | null }> = [];
    const urls: Record<string, string> = {};

    Array.from(files).forEach(file => {
      const matched = matchScreenshotToTrades(file.name, pendingTrades);
      items.push({
        name: file.name,
        size: file.size,
        matchedTradeId: matched ? matched.id : null,
      });

      // Create object URL
      urls[file.name] = URL.createObjectURL(file);
    });

    setBatchFileList(items);
    setBatchDataUrls(urls);
  };

  const handleSimulateSampleScreenshots = () => {
    const samples = [
      { name: '2026-10-14_14-30-00.png', tradeId: pendingTrades[0]?.id || null },
      { name: '2026-10-14_15-20-00.png', tradeId: pendingTrades[1]?.id || null },
      { name: '2026-10-14_08-30-00.png', tradeId: pendingTrades[2]?.id || null },
      { name: '2026-10-14_12-15-00.png', tradeId: pendingTrades[3]?.id || null },
    ];

    const urls: Record<string, string> = {};
    samples.forEach(s => {
      urls[s.name] = createCandleSvgDataUrl(s.name, 'BATCH_ATTACH', 'LONG', true);
    });

    setBatchFileList(
      samples.map(s => ({
        name: s.name,
        size: 104200,
        matchedTradeId: s.tradeId,
      }))
    );
    setBatchDataUrls(urls);
  };

  const handleCommitBatchScreenshots = () => {
    // Group all matched screenshots by tradeId to avoid overwriting in state updates
    const screenshotsByTrade = new Map<string, string[]>();

    batchFileList.forEach(item => {
      if (item.matchedTradeId && batchDataUrls[item.name]) {
        const list = screenshotsByTrade.get(item.matchedTradeId) || [];
        list.push(batchDataUrls[item.name]);
        screenshotsByTrade.set(item.matchedTradeId, list);
      }
    });

    screenshotsByTrade.forEach((urls, tradeId) => {
      const trd = pendingTrades.find(t => t.id === tradeId);
      if (trd) {
        onUpdatePendingTrade({
          ...trd,
          screenshots: [...trd.screenshots, ...urls],
        });
      }
    });

    setBatchFileList([]);
    setBatchDataUrls({});
    setSubView('WORKSTATION');
  };

  return (
    <div className="h-[calc(100vh-42px)] flex flex-col p-2.5 gap-2 bg-zinc-950 font-mono select-none overflow-hidden">
      {/* Subview Selector Bar */}
      <div className="flex items-center justify-between border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 shrink-0 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 uppercase tracking-wider text-[11px] mr-2">FELDOLGOZÓ ÜZEMMÓD:</span>
          <button
            onClick={() => setSubView('WORKSTATION')}
            className={`tui-bracket-btn btn-sm ${subView === 'WORKSTATION' ? 'is-selected' : ''}`}
          >
            MUNKAÁLLOMÁS ({pendingTrades.length})
          </button>
          <button
            onClick={() => setSubView('CSV_IMPORT')}
            className={`tui-bracket-btn btn-sm ${subView === 'CSV_IMPORT' ? 'is-selected' : ''}`}
          >
            CSV IMPORT & DEDUPLIKÁCIÓ
          </button>
          <button
            onClick={() => setSubView('SCREENSHOT_DROP')}
            className={`tui-bracket-btn btn-sm ${subView === 'SCREENSHOT_DROP' ? 'is-selected' : ''}`}
          >
            BATCH KÉP PÁROSÍTÓ
          </button>
        </div>

        <div className="text-[11px] text-zinc-400">
          STAGING SORBAN: <span className="text-amber-400 font-bold">{pendingTrades.length}</span> KÖTÉS VÁRAKOZIK
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUBVIEW 1: WORKSTATION (Split 100vh Screen with Stepper) */}
      {/* ======================================================== */}
      {subView === 'WORKSTATION' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {pendingTrades.length === 0 ? (
            <div className="flex-1 border border-zinc-800 bg-zinc-900/20 flex flex-col items-center justify-center gap-3">
              <div className="text-emerald-400 text-lg font-bold">MINDEN FÜGGŐ KÖTÉS FELDOLGOZVA ÉS COMMIT-OLVA!</div>
              <div className="text-xs text-zinc-500 max-w-md text-center">
                A Staging előszoba üres. Nincs további jóváhagyásra vagy kategorizálásra váró day trade.
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={onNavigateToTable}
                  className="tui-bracket-btn btn-sm"
                >
                  TÁBLÁZAT MEGTEKINTÉSE
                </button>
                <button
                  onClick={() => setSubView('CSV_IMPORT')}
                  className="tui-bracket-btn btn-sm"
                >
                  ÚJ CSV IMPORTÁLÁSA
                </button>
              </div>
            </div>
          ) : (
            currentTrade && (
              <>
                {/* Stepper & Raw Data Summary Header */}
                <div className="border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 flex items-center justify-between shrink-0 text-xs">
                  {/* Stepper Buttons (Kinetikus Bracket Gombok) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevTrade}
                      disabled={currentIndex === 0}
                      className="tui-bracket-btn btn-xs"
                    >
                      &lt; ELŐZŐ
                    </button>
                    <span className="font-bold text-zinc-100 px-1">
                      KÖTÉS {currentIndex + 1} / {pendingTrades.length}
                    </span>
                    <button
                      onClick={handleNextTrade}
                      disabled={currentIndex === pendingTrades.length - 1}
                      className="tui-bracket-btn btn-xs"
                    >
                      KÖVETKEZŐ &gt;
                    </button>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center gap-4 text-[11px]">
                    <div>
                      ID: <span className="text-zinc-100 font-bold">{currentTrade.id}</span>
                    </div>
                    <div className="h-3 w-px bg-zinc-800" />
                    <div>
                      SZIMBÓLUM: <span className="text-zinc-100 font-bold">{currentTrade.symbol}</span>
                    </div>
                    <div className="h-3 w-px bg-zinc-800" />
                    <div>
                      IRÁNY:{' '}
                      <span className={currentTrade.direction === 'LONG' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {currentTrade.direction}
                      </span>
                    </div>
                    <div className="h-3 w-px bg-zinc-800" />
                    <div>
                      MÉRET: <span className="text-zinc-200 font-bold">{currentTrade.size}</span>
                    </div>
                    <div className="h-3 w-px bg-zinc-800" />
                    <div>
                      BELÉPŐ: <span className="text-zinc-200">${currentTrade.openPrice.toFixed(2)}</span> → KILÉPŐ:{' '}
                      <span className="text-zinc-200">${currentTrade.closePrice.toFixed(2)}</span>
                    </div>
                    <div className="h-3 w-px bg-zinc-800" />
                    <div>
                      PNL:{' '}
                      <span className={currentTrade.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {currentTrade.pnl >= 0 ? '+' : ''}${currentTrade.pnl.toFixed(2)} ({currentTrade.pnlR}R)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 Columns Split Layout */}
                <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
                  {/* Column 1: Zoom & Pan Screenshot Viewer (5 Cols) */}
                  <div className="col-span-5 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                    {/* Viewer Header */}
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs">
                      <span className="text-zinc-300 font-bold text-[11px]">
                        SCREENSHOT NÉZŐKE ({currentTrade.screenshots.length} KÉP)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setZoomLevel(prev => Math.min(4, prev + 0.25))}
                          className="tui-bracket-btn btn-xs"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setZoomLevel(prev => Math.max(0.4, prev - 0.25))}
                          className="tui-bracket-btn btn-xs"
                        >
                          -
                        </button>
                        <button
                          onClick={resetZoomPan}
                          className="tui-bracket-btn btn-xs"
                        >
                          1:1 ALAP
                        </button>
                      </div>
                    </div>

                    {/* Canvas/Image Drag Surface */}
                    <div
                      className="flex-1 relative overflow-hidden bg-black flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onWheel={handleWheel}
                    >
                      {currentTrade.screenshots.length > 0 ? (
                        <img
                          src={currentTrade.screenshots[currentImageIndex] || currentTrade.screenshots[0]}
                          alt="Trade capture"
                          style={{
                            transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel})`,
                            transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                            maxWidth: '92%',
                            maxHeight: '92%',
                            userSelect: 'none',
                            pointerEvents: 'none',
                          }}
                          className="object-contain"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <div className="text-zinc-600 text-xs font-mono">NINCS CSATOLT KÉP EHHEZ A KÖTÉSHEZ</div>
                          <button
                            onClick={() => {
                              const dummyUrl = createCandleSvgDataUrl(
                                `${currentTrade.symbol} MANUAL`,
                                currentTrade.symbol,
                                currentTrade.direction,
                                currentTrade.pnl >= 0
                              );
                              onUpdatePendingTrade({
                                ...currentTrade,
                                screenshots: [dummyUrl],
                              });
                            }}
                            className="mt-3 tui-bracket-btn btn-sm btn-accent"
                          >
                            SZIMULÁLT KÉP CSATOLÁSA
                          </button>
                        </div>
                      )}

                      {/* Zoom Indicator */}
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-zinc-900/90 border border-zinc-800 text-[10px] text-zinc-400">
                        ZOOM: {(zoomLevel * 100).toFixed(0)}% | PAN: {panPos.x},{panPos.y}
                      </div>
                    </div>

                    {/* Image Switcher Bar */}
                    {currentTrade.screenshots.length > 1 && (
                      <div className="flex items-center gap-1.5 p-1.5 border-t border-zinc-800 bg-zinc-900/40 overflow-x-auto text-xs">
                        {currentTrade.screenshots.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setCurrentImageIndex(idx);
                              resetZoomPan();
                            }}
                            className={`tui-bracket-btn btn-xs ${currentImageIndex === idx ? 'is-selected' : ''}`}
                          >
                            KÉP {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Dynamic Schema Category Form (4 Cols) */}
                  <div className="col-span-4 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs font-bold text-zinc-300">
                      DINAMIKUS KATEGÓRIAFA & ATTRIBÚTUMOK
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs font-mono">
                      {schemaTree.map(rootNode => (
                        <div key={rootNode.id} className="border border-zinc-800/80 p-2.5 bg-zinc-900/20">
                          {/* Root Node Header */}
                          <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-800/60">
                            <span className="font-bold text-zinc-200 text-xs tracking-wider">
                              {rootNode.name.toUpperCase()}
                            </span>
                            {rootNode.isRequired && (
                              <span className="text-[9px] text-amber-400 bg-amber-950/60 px-1 border border-amber-800">
                                * KÖTELEZŐ
                              </span>
                            )}
                          </div>

                          {/* Root input if it has value */}
                          {rootNode.type === 'TEXT' && (
                            <div className="mb-2">
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Érték:</label>
                              <input
                                type="text"
                                value={currentTrade.customAttributes?.[rootNode.id] || ''}
                                onChange={e => handleAttributeChange(rootNode.id, e.target.value)}
                                placeholder="Kategória megnevezés..."
                                className="w-full bg-zinc-950 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                              />
                            </div>
                          )}

                          {/* Children Nodes */}
                          {rootNode.children && rootNode.children.length > 0 && (
                            <div className="space-y-2.5 mt-2 pl-1 border-l-2 border-zinc-800">
                              {rootNode.children.map(child => {
                                const currentValue = currentTrade.customAttributes?.[child.id];

                                // Check if this node is disabled due to a MUTUALLY_EXCLUSIVE constraint rule!
                                const conflictRule = constraintRules.find(r => {
                                  if (r.type !== 'MUTUALLY_EXCLUSIVE') return false;
                                  if (r.sourceNodeId === child.id) {
                                    const targetVal = currentTrade.customAttributes?.[r.targetNodeId];
                                    return targetVal !== undefined && targetVal !== null && targetVal !== '' && targetVal !== false;
                                  }
                                  if (r.targetNodeId === child.id) {
                                    const sourceVal = currentTrade.customAttributes?.[r.sourceNodeId];
                                    return sourceVal !== undefined && sourceVal !== null && sourceVal !== '' && sourceVal !== false;
                                  }
                                  return false;
                                });

                                const isCurrentlyChecked = Boolean(currentValue);
                                const isDisabled = Boolean(conflictRule) && !isCurrentlyChecked;

                                return (
                                  <div key={child.id} className="text-xs">
                                    {child.type === 'BOOLEAN' ? (
                                      <label className={`flex items-center gap-2 cursor-pointer ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                        <input
                                          type="checkbox"
                                          disabled={isDisabled}
                                          checked={Boolean(currentValue)}
                                          onChange={e => handleAttributeChange(child.id, e.target.checked)}
                                          className="rounded-none bg-zinc-950 border-zinc-700 text-zinc-200 focus:ring-0"
                                        />
                                        <span className="text-zinc-300 font-mono text-[11px]">{child.name}</span>
                                        {child.isRequired && (
                                          <span className="text-[9px] text-amber-400">*</span>
                                        )}
                                      </label>
                                    ) : child.type === 'NUMBER' || child.type === 'PERCENTAGE' ? (
                                      <div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                                          <span>{child.name}</span>
                                          {child.isRequired && <span className="text-amber-400">* KÖTELEZŐ</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step={child.type === 'PERCENTAGE' ? '0.1' : '1'}
                                            value={currentValue !== undefined ? currentValue : ''}
                                            onChange={e =>
                                              handleAttributeChange(
                                                child.id,
                                                e.target.value === '' ? '' : parseFloat(e.target.value)
                                              )
                                            }
                                            placeholder="0.0"
                                            className="w-full bg-zinc-950 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                                          />
                                          {child.type === 'PERCENTAGE' && (
                                            <span className="text-zinc-500 text-xs">%</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                                          <span>{child.name}</span>
                                          {child.isRequired && <span className="text-amber-400">* KÖTELEZŐ</span>}
                                        </div>
                                        <input
                                          type="text"
                                          value={currentValue !== undefined ? currentValue : ''}
                                          onChange={e => handleAttributeChange(child.id, e.target.value)}
                                          placeholder="..."
                                          className="w-full bg-zinc-950 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                                        />
                                      </div>
                                    )}

                                    {/* Conflict rule disclaimer */}
                                    {isDisabled && (
                                      <div className="text-[9px] text-rose-400 mt-0.5 pl-5">
                                        (Összeférhetetlenség miatt inaktív)
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Commit Validation Status & Strict Commit Button */}
                    <div className="p-2.5 border-t border-zinc-800 bg-zinc-900/60 shrink-0">
                      {!validation.isValid && (
                        <div className="mb-2 p-1.5 border border-rose-900/80 bg-rose-950/40 text-[10px] text-rose-300 font-mono space-y-0.5">
                          <div className="font-bold">KÖTELEZŐ ELEMEK HIÁNYOZNAK:</div>
                          {validation.missingRequired.map(m => (
                            <div key={m.nodeId}>• {m.name} kitöltése kötelező</div>
                          ))}
                          {validation.violatedConstraints.map(v => (
                            <div key={v.ruleId}>• {v.description}</div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={handleCommit}
                        disabled={!validation.isValid}
                        className={`w-full tui-bracket-btn py-2 text-xs font-bold tracking-wider ${
                          validation.isValid ? 'is-selected btn-accent' : ''
                        }`}
                      >
                        TÁBLÁZATBA VÉGLEGESÍT
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Markdown Journal Editor (3 Cols) */}
                  <div className="col-span-3 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs">
                      <span className="text-zinc-300 font-bold text-[11px]">KERESKEDÉSI JEGYZET</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setMarkdownMode('EDIT')}
                          className={`tui-bracket-btn btn-xs ${markdownMode === 'EDIT' ? 'is-selected' : ''}`}
                        >
                          SZERKESZTŐ
                        </button>
                        <button
                          onClick={() => setMarkdownMode('PREVIEW')}
                          className={`tui-bracket-btn btn-xs ${markdownMode === 'PREVIEW' ? 'is-selected' : ''}`}
                        >
                          ELŐNÉZET
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 p-2 overflow-hidden flex flex-col bg-zinc-950">
                      {markdownMode === 'EDIT' ? (
                        <textarea
                          value={currentTrade.markdownNote || ''}
                          onChange={e => handleNoteChange(e.target.value)}
                          placeholder="# Kereskedési feljegyzés...&#10;- Belépési ok&#10;- Végrehajtás és pszichológia&#10;- Kilépés indoklása"
                          className="flex-1 w-full bg-zinc-950 text-zinc-200 p-2 text-xs font-mono resize-none focus:outline-none border border-zinc-800 focus:border-zinc-600"
                        />
                      ) : (
                        <div className="flex-1 overflow-y-auto p-2 bg-zinc-900/30 border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                          {currentTrade.markdownNote || '(Üres jegyzet)'}
                        </div>
                      )}
                    </div>

                    <div className="px-2 py-1 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between bg-zinc-900/40">
                      <span>FÁJL: notes/{currentTrade.id}.md</span>
                      <span>UTF-8 // RAW</span>
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBVIEW 2: CSV IMPORT & DEDUPLICATION                    */}
      {/* ======================================================== */}
      {subView === 'CSV_IMPORT' && (
        <div className="flex-1 min-h-0 border border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div>
              <div className="text-sm font-bold text-zinc-100 tracking-wider">CSV KÖTÉSEK IMPORTÁLÁSA & DEDUPLIKÁCIÓ</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Egyedi kulcs: [Instrumentum + Nyitás ideje + Zárás ideje + Méret]. A duplikátumok automatikusan kiszűrésre kerülnek.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadSampleCsv}
                className="tui-bracket-btn btn-sm"
              >
                MINTA CSV BEILLESZTÉSE
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
            <label className="text-xs text-zinc-400">Illessze be a brókertől exportált nyers CSV szöveget:</label>
            <textarea
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
              placeholder="Symbol,Direction,Open Time,Close Time,Size,Open Price,Close Price,PnL,PnL R&#10;NQ_F,LONG,2026-10-14T14:15:00Z,2026-10-14T14:45:00Z,2,20420.00,20490.00,1400.00,2.8"
              className="flex-1 w-full bg-zinc-900/50 border border-zinc-700 p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleProcessCsv}
              className="tui-bracket-btn btn-sm btn-accent"
            >
              CSV ELEMZÉSE ÉS IMPORTÁLÁSA
            </button>
          </div>

          {/* Import report */}
          {importReport && (
            <div className="border border-zinc-800 bg-zinc-900/40 p-3 space-y-2 text-xs">
              <div className="text-zinc-200 font-bold">IMPORTÁLÁSI JELENTÉS:</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 border border-zinc-800 bg-zinc-950">
                  <div className="text-[10px] text-zinc-500">BEOLVASOTT SOROK</div>
                  <div className="text-base font-bold text-zinc-100">{importReport.total}</div>
                </div>
                <div className="p-2 border border-zinc-800 bg-zinc-950">
                  <div className="text-[10px] text-zinc-500">ÚJ KÖTÉSEK (STAGINGBE KERÜL)</div>
                  <div className="text-base font-bold text-emerald-400">{importReport.unique}</div>
                </div>
                <div className="p-2 border border-zinc-800 bg-zinc-950">
                  <div className="text-[10px] text-zinc-500">KISZŰRT DUPLIKÁTUMOK</div>
                  <div className="text-base font-bold text-amber-400">{importReport.duplicates}</div>
                </div>
              </div>

              {stagedImportTrades.length > 0 && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleAcceptImportedTrades}
                    className="tui-bracket-btn btn-sm is-selected"
                  >
                    + {stagedImportTrades.length} KÖTÉS HOZZÁADÁSA A STAGINGHEZ
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBVIEW 3: BATCH SCREENSHOT DROP & AUTO MATCHING         */}
      {/* ======================================================== */}
      {subView === 'SCREENSHOT_DROP' && (
        <div className="flex-1 min-h-0 border border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div>
              <div className="text-sm font-bold text-zinc-100 tracking-wider">BATCH SCREENSHOT DROPZONE & AUTOMATA PÁROSÍTÁS</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                A fájlnevekben található időbélyegek (pl. 2026-10-14_14-30-00.png) automatikusan illesztésre kerülnek a nyitási/zárási ablakhoz.
              </div>
            </div>
            <button
              onClick={handleSimulateSampleScreenshots}
              className="tui-bracket-btn btn-sm"
            >
              MINTA KÉPEK SZIMULÁLÁSA
            </button>
          </div>

          {/* File input / dropzone container */}
          <div className="border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-6 flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-zinc-400 text-xs">Válasszon vagy húzzon be kereskedési képernyőképeket:</div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={e => handleBatchFileSelect(e.target.files)}
              className="text-xs text-zinc-400 file:mr-4 file:py-1 file:px-3 file:border file:border-zinc-700 file:bg-zinc-800 file:text-zinc-200 file:text-xs hover:file:bg-zinc-700 cursor-pointer"
            />
          </div>

          {/* Match Results Table */}
          {batchFileList.length > 0 && (
            <div className="flex-1 flex flex-col gap-2 min-h-0 border border-zinc-800 bg-zinc-900/30 p-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-xs">
                <span className="font-bold text-zinc-200">AUTOMATIKUS PÁROSÍTÁSI EREDMÉNYEK ({batchFileList.length} FÁJL)</span>
                <button
                  onClick={handleCommitBatchScreenshots}
                  className="tui-bracket-btn btn-sm is-selected"
                >
                  PÁROSÍTÁSOK MENTÉSE ÉS CSATOLÁSA
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900 text-zinc-400 text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-1 px-2">FÁJLNÉV</th>
                      <th className="py-1 px-2">IDŐBÉLYEG DETEKTÁLVA</th>
                      <th className="py-1 px-2">PÁROSÍTOTT KÖTÉS</th>
                      <th className="py-1 px-2 text-right">STÁTUSZ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                    {batchFileList.map((item, idx) => {
                      const ts = parseScreenshotTimestamp(item.name);
                      const dateStr = ts ? new Date(ts).toISOString().replace('T', ' ').slice(0, 19) : 'Nem azonosítható';
                      const isMatched = Boolean(item.matchedTradeId);

                      return (
                        <tr key={idx} className="hover:bg-zinc-800/20">
                          <td className="py-1.5 px-2 font-bold text-zinc-200">{item.name}</td>
                          <td className="py-1.5 px-2 text-zinc-400">{dateStr}</td>
                          <td className="py-1.5 px-2">
                            {item.matchedTradeId ? (
                              <span className="text-zinc-100 font-bold">{item.matchedTradeId}</span>
                            ) : (
                              <span className="text-zinc-500">Nincs egyező időablak</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {isMatched ? (
                              <span className="text-emerald-400 font-bold">[PÁROSÍTVA]</span>
                            ) : (
                              <span className="text-amber-400">[ÁRVA KÉP]</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
