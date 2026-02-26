/**
 * Core types for the redesigned Excel-like calculator builder.
 */

// ─── Category Tree ────────────────────────────────────────────────────

export interface Category {
    id: string;
    name: string;
    parentId: string | null;
    order: number;
}

// ─── Calculator Rows (Excel-like) ─────────────────────────────────────

export type RowType = 'input' | 'dropdown' | 'fixed' | 'calculated';
export type Operation = '+' | '-' | '×' | '÷';

export interface DropdownOption {
    label: string;
    value: string;
    rate: string; // Decimal string
}

export interface RowFormula {
    operands: string[]; // row keys or literal numbers
    operation: Operation;
}

export interface CalculatorRow {
    id: string;
    order: number;
    label: string;
    key: string;
    type: RowType;
    fixedValue?: string;
    dropdownOptions?: DropdownOption[];
    formula?: RowFormula;
    isTotal?: boolean;
    isRequired?: boolean;
}

// ─── Cost Blocks (Multi-Stage Pricing) ────────────────────────────────

export type CostBlockType =
    | 'area-based'
    | 'fixed-rate'
    | 'dropdown-rate'
    | 'per-piece'
    | 'aggregation';

export type BlockOperation = '+' | '-' | '×' | '÷' | 'sum';

export interface BlockFormula {
    id: string;
    outputKey: string;
    label: string;
    operationType: BlockOperation;
    operands: string[];   // row keys, literal numbers, or earlier formula outputKeys
    orderIndex: number;
}

export interface CostBlock {
    id: string;
    key: string;
    label: string;
    orderIndex: number;
    blockType: CostBlockType;
    isActive: boolean;
    isOptional: boolean;
    outputKey: string;    // must match one of its formulas' outputKey
    formulas: BlockFormula[];
}

// ─── Calculator ───────────────────────────────────────────────────────

export interface Calculator {
    id: string;
    name: string;
    categoryId: string;
    rows: CalculatorRow[];
    costBlocks: CostBlock[];
    tempItems: TempItem[]; // each calculator has its own temp list
}

// ─── Temp Items ───────────────────────────────────────────────────────

export interface TempItem {
    id: string;
    name: string;
    rate: string;
}

// ─── User Calculation State ───────────────────────────────────────────

export interface UserTempItem {
    id: string;
    name: string;
    rate: string;
}
