/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { MainTab, Trade, SchemaNode, ConstraintRule } from './types.ts';
import {
  INITIAL_COMMITTED_TRADES,
  INITIAL_PENDING_TRADES,
  INITIAL_SCHEMA_NODES,
  INITIAL_CONSTRAINTS,
} from './data/seedData.ts';
import { HeaderNav } from './components/HeaderNav.tsx';
import { OverviewView } from './views/OverviewView.tsx';
import { TableView } from './views/TableView.tsx';
import { StagingView } from './views/StagingView.tsx';
import { AnalyticsView } from './views/AnalyticsView.tsx';
import { SchemaBuilderView } from './views/SchemaBuilderView.tsx';

export default function App() {
  const [currentTab, setCurrentTab] = useState<MainTab>('OVERVIEW');
  const [committedTrades, setCommittedTrades] = useState<Trade[]>(INITIAL_COMMITTED_TRADES);
  const [pendingTrades, setPendingTrades] = useState<Trade[]>(INITIAL_PENDING_TRADES);
  const [schemaTree, setSchemaTree] = useState<SchemaNode[]>(INITIAL_SCHEMA_NODES);
  const [constraintRules, setConstraintRules] = useState<ConstraintRule[]>(INITIAL_CONSTRAINTS);

  // Commit trade from Staging
  const handleCommitTrade = (trade: Trade) => {
    setCommittedTrades(prev => [trade, ...prev]);
    setPendingTrades(prev => prev.filter(t => t.id !== trade.id));
  };

  // Add newly imported trades to Staging
  const handleAddPendingTrades = (newTrades: Trade[]) => {
    setPendingTrades(prev => [...prev, ...newTrades]);
  };

  // Update pending trade in place (attributes, screenshots, note)
  const handleUpdatePendingTrade = (updated: Trade) => {
    setPendingTrades(prev => prev.map(t => (t.id === updated.id ? updated : t)));
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-200 font-mono select-none antialiased">
      {/* Top Header Navigation (Text-Only tabs, Icon XOR Text compliant) */}
      <HeaderNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingTrades.length}
      />

      {/* Main View Router - Each view is a dedicated 100vh full-page view without pop-ups */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {currentTab === 'OVERVIEW' && (
          <OverviewView committedTrades={committedTrades} />
        )}

        {currentTab === 'TABLE' && (
          <TableView committedTrades={committedTrades} schemaTree={schemaTree} />
        )}

        {currentTab === 'STAGING' && (
          <StagingView
            pendingTrades={pendingTrades}
            committedTrades={committedTrades}
            schemaTree={schemaTree}
            constraintRules={constraintRules}
            onCommitTrade={handleCommitTrade}
            onAddPendingTrades={handleAddPendingTrades}
            onUpdatePendingTrade={handleUpdatePendingTrade}
            onNavigateToTable={() => setCurrentTab('TABLE')}
          />
        )}

        {currentTab === 'ANALYTICS' && (
          <AnalyticsView committedTrades={committedTrades} schemaTree={schemaTree} />
        )}

        {currentTab === 'SCHEMA' && (
          <SchemaBuilderView
            schemaTree={schemaTree}
            constraintRules={constraintRules}
            onUpdateSchemaTree={setSchemaTree}
            onUpdateConstraints={setConstraintRules}
          />
        )}
      </main>
    </div>
  );
}
