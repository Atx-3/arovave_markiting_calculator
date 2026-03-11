/**
 * Core types for the redesigned calculator system.
 * Centralized Input Hub + Drag-and-Drop Calculator Builder.
 */

// ─── Category Tree ────────────────────────────────────────────────────

export interface Category {
    id: string;
    name: string;
    parentId: string | null;
    order: number;
}

// ─── Centralized Input Definitions ────────────────────────────────────

export type InputType = 'number' | 'dropdown' | 'fixed';

export interface DropdownOption {
    id: string;
    label: string;
    value: string;
    rate: string;
}

export interface ReferenceItem {
    id: string;
    name: string;
    value: string;
}

// ─── Reference Tree (Drill-Down Rate Lookup) ──────────────────────────

export interface RefTreeNode {
    id: string;
    name: string;
    children?: RefTreeNode[];
    rate?: string;
}

export interface RefTree {
    levels: string[];
    nodes: RefTreeNode[];
}

/**
 * A global input definition — shared across all calculators.
 * Rates are managed centrally from one place.
 */
export interface InputDefinition {
    id: string;
    name: string;
    key: string;
    type: InputType;
    rate: string;
    fixedValue?: string;
    dropdownOptions?: DropdownOption[];
    refTree?: RefTree;
    referenceItems?: ReferenceItem[];
    order: number;
    groupId?: string;
    isRequired?: boolean;
    hidden?: boolean;       // hidden from sales page but still used in calculations
}

// ─── Input Groups ─────────────────────────────────────────────────────

export interface InputGroup {
    id: string;
    name: string;
    order: number;
}

// ─── Calculator Formulas ──────────────────────────────────────────────

export type FormulaTokenType = 'input' | 'operator' | 'number' | 'bracket' | 'formula_ref';

export interface FormulaToken {
    type: FormulaTokenType;
    value: string;      // inputDef ID (for 'input'), operator symbol, number string, or formula ID
    label?: string;     // display label
}

export interface CalculatorFormula {
    id: string;
    label: string;
    key: string;
    tokens: FormulaToken[];
    isTotal?: boolean;
    hidden?: boolean;       // hidden from sales page but still contributes to totals
    order: number;
}

// ─── Calculator-Specific Local Rates ──────────────────────────────────

export interface LocalRate {
    id: string;
    name: string;
    rate: string;
    inputId?: string;   // optional link to an InputDefinition
}

// ─── Calculator ───────────────────────────────────────────────────────

export interface Calculator {
    id: string;
    name: string;
    categoryId: string;
    formulas: CalculatorFormula[];
    localRates: LocalRate[];
    usedInputIds: string[];
    profitPercent?: string; // Profit % added on top of subtotal
    gstPercent?: string;    // GST % added on top of (subtotal + profit)
    isCharge?: boolean;     // true = this is an additional charge, not a standalone calculator
    parentCalcId?: string;  // links charge to its parent calculator
}

// ─── User Calculation State (Sales Side) ──────────────────────────────

export interface UserTempItem {
    id: string;
    name: string;
    rate: string;
}
