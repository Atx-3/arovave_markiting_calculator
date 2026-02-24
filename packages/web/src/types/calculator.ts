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

// ─── Calculator ───────────────────────────────────────────────────────

export interface Calculator {
    id: string;
    name: string;
    categoryId: string;
    rows: CalculatorRow[];
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
