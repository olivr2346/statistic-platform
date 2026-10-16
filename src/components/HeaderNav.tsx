import React from 'react';
import type { MainTab } from '../types.ts';

interface HeaderNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  pendingCount: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
}) => {
  return (
    <header className="h-[42px] border-b border-zinc-800 bg-zinc-950 px-3 flex items-center justify-between text-xs select-none overflow-x-auto whitespace-nowrap">
      {/* Navigation tabs - Kinetikus Bracket Gombok [ ] -> [==] */}
      <nav className="flex items-center gap-2 font-mono shrink-0">
        <button
          onClick={() => onSelectTab('OVERVIEW')}
          className={`tui-bracket-btn ${currentTab === 'OVERVIEW' ? 'is-selected' : ''}`}
        >
          ÁTTEKINTÉS
        </button>

        <button
          onClick={() => onSelectTab('TABLE')}
          className={`tui-bracket-btn ${currentTab === 'TABLE' ? 'is-selected' : ''}`}
        >
          TÁBLÁZAT
        </button>

        <button
          onClick={() => onSelectTab('STAGING')}
          className={`tui-bracket-btn ${currentTab === 'STAGING' ? 'is-selected' : ''}`}
        >
          FELDOLGOZÓ ({pendingCount})
        </button>

        <button
          onClick={() => onSelectTab('ANALYTICS')}
          className={`tui-bracket-btn ${currentTab === 'ANALYTICS' ? 'is-selected' : ''}`}
        >
          VIZSGÁLAT & GRAFIKONOK
        </button>

        <button
          onClick={() => onSelectTab('SCHEMA')}
          className={`tui-bracket-btn ${currentTab === 'SCHEMA' ? 'is-selected' : ''}`}
        >
          STRUKTÚRA ÉPÍTŐ
        </button>
      </nav>

    </header>
  );
};
