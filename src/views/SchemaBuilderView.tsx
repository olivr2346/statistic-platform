import React, { useState } from 'react';
import type { SchemaNode, ConstraintRule } from '../types.ts';
import { flattenSchemaNodes } from '../utils/staging.ts';

interface SchemaBuilderViewProps {
  schemaTree: SchemaNode[];
  constraintRules: ConstraintRule[];
  onUpdateSchemaTree: (nodes: SchemaNode[]) => void;
  onUpdateConstraints: (rules: ConstraintRule[]) => void;
}

export const SchemaBuilderView: React.FC<SchemaBuilderViewProps> = ({
  schemaTree,
  constraintRules,
  onUpdateSchemaTree,
  onUpdateConstraints,
}) => {
  // Mode: 'TREE' or 'CONSTRAINTS'
  const [activeTab, setActiveTab] = useState<'TREE' | 'CONSTRAINTS'>('TREE');

  // Form State for Adding/Editing Node (Direct In-Page Form, Zero Modals!)
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState<string>('');
  const [nodeType, setNodeType] = useState<SchemaNode['type']>('BOOLEAN');
  const [nodeRequired, setNodeRequired] = useState<boolean>(false);

  // Constraint Rule Form State
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [constraintType, setConstraintType] = useState<ConstraintRule['type']>('MUTUALLY_EXCLUSIVE');

  const flatNodes = flattenSchemaNodes(schemaTree);

  // Recursively add child node
  const addNodeRecursive = (
    nodes: SchemaNode[],
    parentId: string | null,
    newNode: SchemaNode
  ): SchemaNode[] => {
    if (parentId === null) {
      return [...nodes, newNode];
    }
    return nodes.map(node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newNode],
        };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: addNodeRecursive(node.children, parentId, newNode),
        };
      }
      return node;
    });
  };

  // Recursively update node
  const updateNodeRecursive = (
    nodes: SchemaNode[],
    id: string,
    updates: Partial<SchemaNode>
  ): SchemaNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: updateNodeRecursive(node.children, id, updates),
        };
      }
      return node;
    });
  };

  // Recursively delete node
  const deleteNodeRecursive = (nodes: SchemaNode[], id: string): SchemaNode[] => {
    return nodes
      .filter(node => node.id !== id)
      .map(node => {
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: deleteNodeRecursive(node.children, id),
          };
        }
        return node;
      });
  };

  const handleSaveNode = () => {
    if (!nodeName.trim()) return;

    if (editingNodeId) {
      // Edit existing node
      const updated = updateNodeRecursive(schemaTree, editingNodeId, {
        name: nodeName.trim(),
        type: nodeType,
        isRequired: nodeRequired,
      });
      onUpdateSchemaTree(updated);
      setEditingNodeId(null);
    } else {
      // Create new node
      const newNode: SchemaNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        parentId: targetParentId,
        name: nodeName.trim(),
        type: nodeType,
        isRequired: nodeRequired,
        children: [],
      };
      const updated = addNodeRecursive(schemaTree, targetParentId, newNode);
      onUpdateSchemaTree(updated);
    }

    // Reset form
    setNodeName('');
    setNodeType('BOOLEAN');
    setNodeRequired(false);
    setTargetParentId(null);
  };

  const startEditNode = (node: SchemaNode) => {
    setEditingNodeId(node.id);
    setTargetParentId(node.parentId);
    setNodeName(node.name);
    setNodeType(node.type);
    setNodeRequired(node.isRequired);
  };

  const getSubtreeIds = (nodes: SchemaNode[], targetId: string): string[] => {
    const findAndCollect = (list: SchemaNode[]): string[] | null => {
      for (const node of list) {
        if (node.id === targetId) {
          const collect = (n: SchemaNode): string[] => [n.id, ...(n.children ? n.children.flatMap(collect) : [])];
          return collect(node);
        }
        if (node.children && node.children.length > 0) {
          const res = findAndCollect(node.children);
          if (res) return res;
        }
      }
      return null;
    };
    return findAndCollect(nodes) || [targetId];
  };

  const handleDeleteNode = (id: string) => {
    const idsToRemove = new Set(getSubtreeIds(schemaTree, id));
    const updated = deleteNodeRecursive(schemaTree, id);
    onUpdateSchemaTree(updated);
    // Also remove any constraints referring to this node or any of its descendant children
    onUpdateConstraints(
      constraintRules.filter(r => !idsToRemove.has(r.sourceNodeId) && !idsToRemove.has(r.targetNodeId))
    );
    if (editingNodeId && idsToRemove.has(editingNodeId)) {
      setEditingNodeId(null);
      setNodeName('');
    }
  };

  // Constraint rules handlers
  const handleAddConstraint = () => {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return;

    const newRule: ConstraintRule = {
      id: `rule_${Date.now()}`,
      sourceNodeId,
      targetNodeId,
      type: constraintType,
    };
    onUpdateConstraints([...constraintRules, newRule]);
    setSourceNodeId('');
    setTargetNodeId('');
  };

  const handleDeleteConstraint = (id: string) => {
    onUpdateConstraints(constraintRules.filter(r => r.id !== id));
  };

  // Render tree node recursive component
  const renderTreeNode = (node: SchemaNode, depth = 0) => {
    const isEditing = editingNodeId === node.id;

    return (
      <div key={node.id} className="flex flex-col">
        <div
          className={`flex items-center justify-between py-1.5 px-2 border-b border-zinc-900 ${
            isEditing ? 'bg-zinc-800' : 'hover:bg-zinc-900/40'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono text-[10px]">{depth > 0 ? '↳ ' : '■ '}</span>
            <span className="text-zinc-200 font-bold text-xs">{node.name}</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-400">
              {node.type}
            </span>
            {node.isRequired && (
              <span className="px-1.5 py-0.2 text-[9px] bg-amber-950 text-amber-400 border border-amber-800 font-bold">
                KÖTELEZŐ
              </span>
            )}
          </div>

          {/* Action buttons (Kinetikus Bracket Gombok) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setTargetParentId(node.id);
                setEditingNodeId(null);
                setNodeName('');
                setNodeType('BOOLEAN');
                setNodeRequired(false);
              }}
              className="tui-bracket-btn btn-xs"
            >
              + ALKATEGÓRIA
            </button>
            <button
              onClick={() => startEditNode(node)}
              className="tui-bracket-btn btn-xs"
            >
              SZERKESZTÉS
            </button>
            <button
              onClick={() => handleDeleteNode(node.id)}
              className="tui-bracket-btn btn-xs btn-danger"
            >
              TÖRLÉS
            </button>
          </div>
        </div>

        {/* Recursive Children */}
        {node.children && node.children.map(child => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-42px)] flex flex-col p-2.5 gap-2 bg-zinc-950 font-mono select-none overflow-hidden">
      {/* Top Switcher */}
      <div className="flex items-center justify-between border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 shrink-0 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 uppercase tracking-wider text-[11px] mr-2">STRUKTÚRA ÉPÍTŐ:</span>
          <button
            onClick={() => setActiveTab('TREE')}
            className={`tui-bracket-btn btn-sm ${activeTab === 'TREE' ? 'is-selected' : ''}`}
          >
            VÉGTELEN KATEGÓRIAFA ({flatNodes.length} ELEM)
          </button>
          <button
            onClick={() => setActiveTab('CONSTRAINTS')}
            className={`tui-bracket-btn btn-sm ${activeTab === 'CONSTRAINTS' ? 'is-selected' : ''}`}
          >
            ÖSSZEFÉRHETETLENSÉGI MÁTRIX ({constraintRules.length} SZABÁLY)
          </button>
        </div>

        <div className="text-[11px] text-zinc-400">
          STÁTUSZ: <span className="text-emerald-400 font-bold">ÉLES ÉRVÉNYESÍTŐ AKTÍV</span>
        </div>
      </div>

      {/* Main Split Layout */}
      {activeTab === 'TREE' ? (
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
          {/* Tree Explorer (7 Cols) */}
          <div className="col-span-7 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs font-bold text-zinc-300">
              <span>HIERARCHIKUS KATEGÓRIAFA</span>
              <button
                onClick={() => {
                  setTargetParentId(null);
                  setEditingNodeId(null);
                  setNodeName('');
                  setNodeType('TEXT');
                  setNodeRequired(false);
                }}
                className="tui-bracket-btn btn-xs"
              >
                + ÚJ FŐKATEGÓRIA
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {schemaTree.map(root => renderTreeNode(root, 0))}
            </div>
          </div>

          {/* Node Editor Form (5 Cols) - Dedicated In-Page Form (No Popups!) */}
          <div className="col-span-5 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden text-xs">
            <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 font-bold text-zinc-300">
              {editingNodeId ? 'CSOMÓPONT SZERKESZTÉSE' : targetParentId ? 'ÚJ ALKATEGÓRIA HOZZÁADÁSA' : 'ÚJ FŐKATEGÓRIA HOZZÁADÁSA'}
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {targetParentId && !editingNodeId && (
                <div className="p-2 border border-zinc-800 bg-zinc-900/40 text-[11px] text-zinc-400">
                  Szülő elem:{' '}
                  <span className="text-zinc-200 font-bold">
                    {flatNodes.find(n => n.id === targetParentId)?.name}
                  </span>
                </div>
              )}

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Csomópont Megnevezése:</label>
                <input
                  type="text"
                  value={nodeName}
                  onChange={e => setNodeName(e.target.value)}
                  placeholder="Pl. Elliott Hullám, Retracement, Stop Run..."
                  className="w-full bg-zinc-900/60 border border-zinc-700 p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Adattípus:</label>
                <select
                  value={nodeType}
                  onChange={e => setNodeType(e.target.value as SchemaNode['type'])}
                  className="w-full bg-zinc-900/60 border border-zinc-700 p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                >
                  <option value="BOOLEAN">Logikai (Igen/Nem címke)</option>
                  <option value="NUMBER">Egész szám (Number)</option>
                  <option value="PERCENTAGE">Százalék (% mélység)</option>
                  <option value="TEXT">Szöveg (Text megadás)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2.5 bg-zinc-900/30">
                  <input
                    type="checkbox"
                    checked={nodeRequired}
                    onChange={e => setNodeRequired(e.target.checked)}
                    className="rounded-none bg-zinc-950 border-zinc-700 text-zinc-200 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-zinc-200 text-xs">KÖTELEZŐ MEZŐ</span>
                    <span className="block text-[10px] text-zinc-400">
                      Ha be van kapcsolva, a Staging Commit gomb inaktív marad, amíg ez a mező nincs kitöltve.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center gap-2">
                <button
                  onClick={handleSaveNode}
                  disabled={!nodeName.trim()}
                  className="flex-1 tui-bracket-btn btn-accent is-selected"
                >
                  CSOMÓPONT MENTÉSE
                </button>
                {editingNodeId && (
                  <button
                    onClick={() => {
                      setEditingNodeId(null);
                      setNodeName('');
                    }}
                    className="tui-bracket-btn btn-sm"
                  >
                    MÉGSE
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CONSTRAINTS VIEW */
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
          {/* Constraints Table (7 Cols) */}
          <div className="col-span-7 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-xs font-bold text-zinc-300">
              DEFINIÁLT ÖSSZEFÉRHETETLENSÉGI & FÜGGŐSÉGI SZABÁLYOK
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-900 text-zinc-400 text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-1.5 px-2.5">FORRÁS ELEM</th>
                    <th className="py-1.5 px-2">KAPCSOLAT TÍPUSA</th>
                    <th className="py-1.5 px-2">CÉL ELEM</th>
                    <th className="py-1.5 px-2 text-right">MŰVELET</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                  {constraintRules.map(rule => {
                    const source = flatNodes.find(n => n.id === rule.sourceNodeId);
                    const target = flatNodes.find(n => n.id === rule.targetNodeId);

                    return (
                      <tr key={rule.id} className="hover:bg-zinc-900/40">
                        <td className="py-2 px-2.5 font-bold text-zinc-200">
                          {source ? source.name : rule.sourceNodeId}
                        </td>
                        <td className="py-2 px-2">
                          {rule.type === 'MUTUALLY_EXCLUSIVE' ? (
                            <span className="px-1.5 py-0.5 text-[9px] bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                              KIZÁRJA (MUTUALLY_EXCLUSIVE)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                              MEGKÖVETELI (REQUIRES)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-bold text-zinc-200">
                          {target ? target.name : rule.targetNodeId}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={() => handleDeleteConstraint(rule.id)}
                            className="tui-bracket-btn btn-xs btn-danger"
                          >
                            TÖRLÉS
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* New Constraint Form (5 Cols) */}
          <div className="col-span-5 border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden text-xs">
            <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 font-bold text-zinc-300">
              ÚJ KORLÁTOZÁS LÉTREHOZÁSA
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Forrás Csomópont:</label>
                <select
                  value={sourceNodeId}
                  onChange={e => setSourceNodeId(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-zinc-700 p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                >
                  <option value="">-- Válasszon forrás elemet --</option>
                  {flatNodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.path} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Korlátozás Típusa:</label>
                <select
                  value={constraintType}
                  onChange={e => setConstraintType(e.target.value as ConstraintRule['type'])}
                  className="w-full bg-zinc-900/60 border border-zinc-700 p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                >
                  <option value="MUTUALLY_EXCLUSIVE">
                    Kizárja egymást (Ha Forrás be van jelölve, Cél nem választható)
                  </option>
                  <option value="REQUIRES">
                    Megköveteli (Ha Forrás be van jelölve, Cél kötelezően kitöltendő)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Cél Csomópont:</label>
                <select
                  value={targetNodeId}
                  onChange={e => setTargetNodeId(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-zinc-700 p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                >
                  <option value="">-- Válasszon cél elemet --</option>
                  {flatNodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.path} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleAddConstraint}
                  disabled={!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId}
                  className="w-full tui-bracket-btn btn-accent is-selected"
                >
                  SZABÁLY RÖGZÍTÉSE A MÁTRIXBAN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
