export interface Trade {
  id: string;
  ticketId?: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  openTime: string;
  closeTime: string;
  size: number;
  openPrice: number;
  closePrice: number;
  pnl: number;
  pnlR: number;
  status: 'PENDING' | 'COMMITTED';
  screenshots: string[]; // Fájlnevek vagy Blob/Data URL-ek
  markdownNote: string;  // Külön .md jegyzet tartalma
  customAttributes: Record<string, any>; // Dinamikus kategóriákból származó értékek
}

export interface SchemaNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'BOOLEAN' | 'NUMBER' | 'PERCENTAGE' | 'TEXT';
  isRequired: boolean;
  children?: SchemaNode[];
}

export interface ConstraintRule {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: 'MUTUALLY_EXCLUSIVE' | 'REQUIRES';
}

export type TimeframeFilter = 'ALL' | 'LAST_100' | 'LAST_50' | '30D' | '7D';

export type FilterOperator = 
  | 'EQUALS' 
  | 'NOT_EQUALS' 
  | 'GREATER' 
  | 'LESS' 
  | 'GREATER_EQUALS' 
  | 'LESS_EQUALS' 
  | 'CONTAINS';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export interface FilterRule {
  id: string;
  field: string; // 'symbol' | 'direction' | 'pnl' | 'pnlR' | 'size' | custom attribute ID
  isCustomAttr: boolean;
  operator: FilterOperator;
  value: string | number | boolean;
  logic: LogicalOperator; // Logic applied relative to previous rule
}

export interface ChartSeriesConfig {
  id: string;
  label: string;
  color: string;
  filters: FilterRule[];
  visible: boolean;
}

export type ChartType = 'EQUITY' | 'DISTRIBUTION' | 'SCATTER';

export type MainTab = 'OVERVIEW' | 'TABLE' | 'STAGING' | 'ANALYTICS' | 'SCHEMA';
