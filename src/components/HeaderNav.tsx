import React from 'react';
import type { MainTab } from '../types.ts';

interface HeaderNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  pendingCount: number;
  totalCommittedCount: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  totalCommittedCount,
}) => {
  return (
    <header className="h-[42px] border-b border-zinc-800 bg-zinc-950 px-3 flex items-center justify-between text-xs select-none overflow-x-auto whitespace-nowrap">
      {/* Navigation tabs - TEXT ONLY as per Icon XOR Text Rule */}
      <nav className="flex items-center gap-1 font-mono shrink-0">
        <button
          onClick={() => onSelectTab('OVERVIEW')}
          className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
            currentTab === 'OVERVIEW'
              ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
          }`}
        >
          [ÁTTEKINTÉS]
        </button>

        <button
          onClick={() => onSelectTab('TABLE')}
          className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
            currentTab === 'TABLE'
              ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
          }`}
        >
          [TÁBLÁZAT]
        </button>

        <button
          onClick={() => onSelectTab('STAGING')}
          className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
            currentTab === 'STAGING'
              ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
          }`}
        >
          [FELDOLGOZÓ ({pendingCount})]
        </button>

        <button
          onClick={() => onSelectTab('ANALYTICS')}
          className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
            currentTab === 'ANALYTICS'
              ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
          }`}
        >
          [VIZSGÁLAT & GRAFIKONOK]
        </button>

        <button
          onClick={() => onSelectTab('SCHEMA')}
          className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
            currentTab === 'SCHEMA'
              ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
          }`}
        >
          [STRUKTÚRA ÉPÍTŐ]
        </button>
      </nav>

      {/* Terminal Status Ticker */}
      <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400">
        <div>
          VÉGLEGESÍTETT: <span className="text-zinc-200 font-semibold">{totalCommittedCount}</span>
        </div>
        <div className="h-3 w-px bg-zinc-800" />
        <div>
          FÜGGŐBEN: <span className={pendingCount > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-500'}>{pendingCount}</span>
        </div>
        <div className="h-3 w-px bg-zinc-800" />
        <div className="text-emerald-500 font-semibold">
          KVANT_MOTOR // AKTÍV
        </div>
      </div>
    </header>
  );
};
