import type { Trade, SchemaNode, ConstraintRule } from '../types.ts';

/**
 * Creates unique key: Instrumentum + Nyitási idő + Zárási idő + Méret
 */
export function generateTradeDeduplicationKey(
  trade: Pick<Trade, 'symbol' | 'openTime' | 'closeTime' | 'size'>
): string {
  const normSymbol = (trade.symbol || '').trim().toUpperCase();
  const normOpen = (trade.openTime || '').trim();
  const normClose = (trade.closeTime || '').trim();
  const normSize = Number(trade.size || 0).toFixed(4);
  return `${normSymbol}__${normOpen}__${normClose}__${normSize}`;
}

export function deduplicateIncomingTrades(
  incomingTrades: Trade[],
  existingTrades: Trade[]
): { uniqueTrades: Trade[]; duplicateCount: number } {
  const existingKeys = new Set(existingTrades.map(generateTradeDeduplicationKey));
  const uniqueTrades: Trade[] = [];
  let duplicateCount = 0;

  for (const trade of incomingTrades) {
    const key = generateTradeDeduplicationKey(trade);
    if (existingKeys.has(key)) {
      duplicateCount++;
    } else {
      existingKeys.add(key);
      uniqueTrades.push(trade);
    }
  }

  return { uniqueTrades, duplicateCount };
}

/**
 * Parses timestamp from screenshot filename such as:
 * - 2026-10-14_14-30-00.png
 * - 20261014_143000.png
 * - 2026-10-14T14-30-00.png
 * - shot_2026-10-14_1430.png
 */
export function parseScreenshotTimestamp(filename: string): number | null {
  if (!filename) return null;

  // Match YYYY-MM-DD[_T]HH-mm-ss or HH:mm:ss or YYYYMMDD_HHmmss
  const clean = filename.replace(/\.[^/.]+$/, ''); // remove extension

  // Pattern 1: 2026-10-14_14-30-00 or 2026-10-14_14:30:00
  const m1 = clean.match(/(\d{4})-(\d{2})-(\d{2})[_T](\d{2})[-:](\d{2})(?:[-:](\d{2}))?/);
  if (m1) {
    const [, yr, mo, dy, hr, mi, sc] = m1;
    const date = new Date(Date.UTC(
      parseInt(yr, 10),
      parseInt(mo, 10) - 1,
      parseInt(dy, 10),
      parseInt(hr, 10),
      parseInt(mi, 10),
      parseInt(sc || '0', 10)
    ));
    return date.getTime();
  }

  // Pattern 2: 20261014_143000
  const m2 = clean.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (m2) {
    const [, yr, mo, dy, hr, mi, sc] = m2;
    const date = new Date(Date.UTC(
      parseInt(yr, 10),
      parseInt(mo, 10) - 1,
      parseInt(dy, 10),
      parseInt(hr, 10),
      parseInt(mi, 10),
      parseInt(sc, 10)
    ));
    return date.getTime();
  }

  return null;
}

/**
 * Matches a screenshot filename to a pending trade based on openTime and closeTime window
 */
export function matchScreenshotToTrades(
  filename: string,
  trades: Trade[],
  toleranceMs: number = 30 * 60 * 1000 // 30 minutes tolerance
): Trade | null {
  const ts = parseScreenshotTimestamp(filename);
  if (ts === null) return null;

  for (const trade of trades) {
    const openTs = new Date(trade.openTime).getTime();
    const closeTs = new Date(trade.closeTime).getTime();

    if (isNaN(openTs) || isNaN(closeTs)) continue;

    const minTs = Math.min(openTs, closeTs) - toleranceMs;
    const maxTs = Math.max(openTs, closeTs) + toleranceMs;

    if (ts >= minTs && ts <= maxTs) {
      return trade;
    }
  }

  return null;
}

export interface FlatSchemaNode extends SchemaNode {
  path: string;
  depth: number;
}

export function flattenSchemaNodes(nodes: SchemaNode[], parentPath = '', depth = 0): FlatSchemaNode[] {
  let result: FlatSchemaNode[] = [];
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({
      ...node,
      path: currentPath,
      depth,
    });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenSchemaNodes(node.children, currentPath, depth + 1));
    }
  }
  return result;
}

export interface ValidationResult {
  isValid: boolean;
  missingRequired: Array<{ nodeId: string; name: string }>;
  violatedConstraints: Array<{ ruleId: string; description: string }>;
}

export function validateTradeCustomAttributes(
  attributes: Record<string, any> = {},
  schemaTree: SchemaNode[],
  constraintRules: ConstraintRule[]
): ValidationResult {
  const flatNodes = flattenSchemaNodes(schemaTree);
  const nodeMap = new Map(flatNodes.map(n => [n.id, n]));
  const missingRequired: Array<{ nodeId: string; name: string }> = [];
  const violatedConstraints: Array<{ ruleId: string; description: string }> = [];

  // Check required fields
  for (const node of flatNodes) {
    if (node.isRequired) {
      const val = attributes[node.id];
      const isSet = val !== undefined && val !== null && val !== '' && val !== false;
      if (!isSet) {
        missingRequired.push({ nodeId: node.id, name: node.name });
      }
    }
  }

  // Check constraint rules
  for (const rule of constraintRules) {
    const sourceNode = nodeMap.get(rule.sourceNodeId);
    const targetNode = nodeMap.get(rule.targetNodeId);
    if (!sourceNode || !targetNode) continue;

    const sourceVal = attributes[rule.sourceNodeId];
    const targetVal = attributes[rule.targetNodeId];

    const sourceIsSet = sourceVal !== undefined && sourceVal !== null && sourceVal !== '' && sourceVal !== false;
    const targetIsSet = targetVal !== undefined && targetVal !== null && targetVal !== '' && targetVal !== false;

    if (rule.type === 'MUTUALLY_EXCLUSIVE') {
      if (sourceIsSet && targetIsSet) {
        violatedConstraints.push({
          ruleId: rule.id,
          description: `"${sourceNode.name}" ÉS "${targetNode.name}" nem választható egyszerre!`,
        });
      }
    } else if (rule.type === 'REQUIRES') {
      if (sourceIsSet && !targetIsSet) {
        violatedConstraints.push({
          ruleId: rule.id,
          description: `"${sourceNode.name}" megköveteli: "${targetNode.name}"!`,
        });
      }
    }
  }

  return {
    isValid: missingRequired.length === 0 && violatedConstraints.length === 0,
    missingRequired,
    violatedConstraints,
  };
}
