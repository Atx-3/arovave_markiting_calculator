/**
 * Zustand store for the redesigned calculator system.
 * Categories + Calculators + Temp Items — all local state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Decimal from 'decimal.js';
import type {
    Category,
    Calculator,
    CalculatorRow,
    DropdownOption,
    RowType,
    Operation,
    TempItem,
    CostBlock,
    CostBlockType,
    BlockFormula,
} from '../types/calculator';

// ─── Helpers ─────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

// ─── Store Interface ─────────────────────────────────────────────────

interface AppStore {
    // ── Categories ──
    categories: Category[];
    addCategory: (name: string, parentId: string | null) => void;
    renameCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;
    getCategoryChildren: (parentId: string | null) => Category[];
    getCategoryBreadcrumb: (id: string) => Category[];

    // ── Calculators ──
    calculators: Calculator[];
    selectedCalculatorId: string | null;
    selectCalculator: (id: string | null) => void;
    createCalculator: (categoryId: string, name: string) => void;
    deleteCalculator: (id: string) => void;
    getCalculatorForCategory: (categoryId: string) => Calculator | undefined;

    // ── Calculator Rows ──
    addRow: (calculatorId: string) => void;
    addCalculatedRow: (calculatorId: string, label: string, key: string, formula: { operands: string[]; operation: Operation }) => void;
    removeRow: (calculatorId: string, rowId: string) => void;
    updateRow: (calculatorId: string, rowId: string, updates: Partial<CalculatorRow>) => void;
    moveRow: (calculatorId: string, rowId: string, direction: 'up' | 'down') => void;
    setGrandTotalRow: (calculatorId: string, rowId: string) => void;

    // ── Dropdown Options ──
    addDropdownOption: (calculatorId: string, rowId: string) => void;
    removeDropdownOption: (calculatorId: string, rowId: string, optionIndex: number) => void;
    updateDropdownOption: (
        calculatorId: string,
        rowId: string,
        optionIndex: number,
        updates: Partial<DropdownOption>
    ) => void;

    // ── Formula ──
    updateRowFormula: (
        calculatorId: string,
        rowId: string,
        formula: { operands: string[]; operation: Operation }
    ) => void;
    addFormulaOperand: (calculatorId: string, rowId: string, operand: string) => void;
    removeFormulaOperand: (calculatorId: string, rowId: string, operandIndex: number) => void;

    // ── Cost Blocks ──
    addCostBlock: (calculatorId: string, label: string, blockType: CostBlockType) => void;
    updateCostBlock: (calculatorId: string, blockId: string, updates: Partial<CostBlock>) => void;
    removeCostBlock: (calculatorId: string, blockId: string) => void;
    moveCostBlock: (calculatorId: string, blockId: string, direction: 'up' | 'down') => void;
    addBlockFormula: (calculatorId: string, blockId: string, formula: Omit<BlockFormula, 'id'>) => void;
    updateBlockFormula: (calculatorId: string, blockId: string, formulaId: string, updates: Partial<BlockFormula>) => void;
    removeBlockFormula: (calculatorId: string, blockId: string, formulaId: string) => void;

    // ── Temp Items (per-calculator reference list) ──
    addTempItem: (calculatorId: string, name: string, rate: string) => void;
    removeTempItem: (calculatorId: string, itemId: string) => void;
    updateTempItem: (calculatorId: string, itemId: string, updates: Partial<TempItem>) => void;

    // ── Calculation ──
    calculateResult: (
        calculator: Calculator,
        inputs: Record<string, string>,
        selectedDropdowns: Record<string, string>,
        userTempItems: { name: string; rate: string }[]
    ) => { rowResults: Record<string, string>; total: string; blockResults?: { blockKey: string; label: string; value: string; isActive: boolean }[] };
}

// ─── Store Implementation ────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
    persist(
        (set, get) => ({
            // ══════════════════════════════════════════════════════════════════
            // CATEGORIES
            // ══════════════════════════════════════════════════════════════════

            categories: [],

            addCategory: (name, parentId) =>
                set((s) => ({
                    categories: [
                        ...s.categories,
                        {
                            id: uid(),
                            name,
                            parentId,
                            order: s.categories.filter((c) => c.parentId === parentId).length + 1,
                        },
                    ],
                })),

            renameCategory: (id, name) =>
                set((s) => ({
                    categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
                })),

            deleteCategory: (id) => {
                // Recursively delete all children
                const getAllDescendants = (parentId: string): string[] => {
                    const children = get().categories.filter((c) => c.parentId === parentId);
                    return children.flatMap((c) => [c.id, ...getAllDescendants(c.id)]);
                };
                const idsToDelete = [id, ...getAllDescendants(id)];
                set((s) => ({
                    categories: s.categories.filter((c) => !idsToDelete.includes(c.id)),
                    calculators: s.calculators.filter((calc) => !idsToDelete.includes(calc.categoryId)),
                }));
            },

            getCategoryChildren: (parentId) =>
                get()
                    .categories.filter((c) => c.parentId === parentId)
                    .sort((a, b) => a.order - b.order),

            getCategoryBreadcrumb: (id) => {
                const result: Category[] = [];
                let current = get().categories.find((c) => c.id === id);
                while (current) {
                    result.unshift(current);
                    current = current.parentId
                        ? get().categories.find((c) => c.id === current!.parentId)
                        : undefined;
                }
                return result;
            },

            // ══════════════════════════════════════════════════════════════════
            // CALCULATORS
            // ══════════════════════════════════════════════════════════════════

            calculators: [],
            selectedCalculatorId: null,

            selectCalculator: (id) => set({ selectedCalculatorId: id }),

            createCalculator: (categoryId, name) => {
                const newCalc: Calculator = {
                    id: uid(),
                    name,
                    categoryId,
                    rows: [],
                    costBlocks: [],
                    tempItems: [],
                };
                set((s) => ({
                    calculators: [...s.calculators, newCalc],
                    selectedCalculatorId: newCalc.id,
                }));
            },

            deleteCalculator: (id) =>
                set((s) => ({
                    calculators: s.calculators.filter((c) => c.id !== id),
                    selectedCalculatorId: s.selectedCalculatorId === id ? null : s.selectedCalculatorId,
                })),

            getCalculatorForCategory: (categoryId) =>
                get().calculators.find((c) => c.categoryId === categoryId),

            // ══════════════════════════════════════════════════════════════════
            // CALCULATOR ROWS
            // ══════════════════════════════════════════════════════════════════

            addRow: (calculatorId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: [
                                    ...calc.rows,
                                    {
                                        id: uid(),
                                        order: calc.rows.length + 1,
                                        label: '',
                                        key: '',
                                        type: 'input' as RowType,
                                    },
                                ],
                            }
                            : calc
                    ),
                })),

            addCalculatedRow: (calculatorId, label, key, formula) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) => {
                        if (calc.id !== calculatorId) return calc;
                        // Only auto-set isTotal if no other row already has it
                        const hasExistingTotal = calc.rows.some((r) => r.isTotal);
                        return {
                            ...calc,
                            rows: [
                                ...calc.rows,
                                {
                                    id: uid(),
                                    order: calc.rows.length + 1,
                                    label,
                                    key,
                                    type: 'calculated' as RowType,
                                    formula,
                                    isTotal: !hasExistingTotal,
                                },
                            ],
                        };
                    }),
                })),

            setGrandTotalRow: (calculatorId, rowId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) => ({
                                    ...r,
                                    isTotal: r.id === rowId,
                                })),
                            }
                            : calc
                    ),
                })),

            removeRow: (calculatorId, rowId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows
                                    .filter((r) => r.id !== rowId)
                                    .map((r, i) => ({ ...r, order: i + 1 })),
                            }
                            : calc
                    ),
                })),

            updateRow: (calculatorId, rowId, updates) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId ? { ...r, ...updates } : r
                                ),
                            }
                            : calc
                    ),
                })),

            moveRow: (calculatorId, rowId, direction) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) => {
                        if (calc.id !== calculatorId) return calc;
                        const rows = [...calc.rows];
                        const index = rows.findIndex((r) => r.id === rowId);
                        if (index < 0) return calc;
                        const target = direction === 'up' ? index - 1 : index + 1;
                        if (target < 0 || target >= rows.length) return calc;
                        [rows[index], rows[target]] = [rows[target], rows[index]];
                        return {
                            ...calc,
                            rows: rows.map((r, i) => ({ ...r, order: i + 1 })),
                        };
                    }),
                })),

            // ══════════════════════════════════════════════════════════════════
            // DROPDOWN OPTIONS
            // ══════════════════════════════════════════════════════════════════

            addDropdownOption: (calculatorId, rowId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId
                                        ? {
                                            ...r,
                                            dropdownOptions: [
                                                ...(r.dropdownOptions || []),
                                                { label: '', value: '', rate: '0' },
                                            ],
                                        }
                                        : r
                                ),
                            }
                            : calc
                    ),
                })),

            removeDropdownOption: (calculatorId, rowId, optionIndex) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId
                                        ? {
                                            ...r,
                                            dropdownOptions: (r.dropdownOptions || []).filter(
                                                (_, i) => i !== optionIndex
                                            ),
                                        }
                                        : r
                                ),
                            }
                            : calc
                    ),
                })),

            updateDropdownOption: (calculatorId, rowId, optionIndex, updates) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId
                                        ? {
                                            ...r,
                                            dropdownOptions: (r.dropdownOptions || []).map((opt, i) =>
                                                i === optionIndex ? { ...opt, ...updates } : opt
                                            ),
                                        }
                                        : r
                                ),
                            }
                            : calc
                    ),
                })),

            // ══════════════════════════════════════════════════════════════════
            // FORMULA
            // ══════════════════════════════════════════════════════════════════

            updateRowFormula: (calculatorId, rowId, formula) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId ? { ...r, formula } : r
                                ),
                            }
                            : calc
                    ),
                })),

            addFormulaOperand: (calculatorId, rowId, operand) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId
                                        ? {
                                            ...r,
                                            formula: {
                                                operation: r.formula?.operation || '+',
                                                operands: [...(r.formula?.operands || []), operand],
                                            },
                                        }
                                        : r
                                ),
                            }
                            : calc
                    ),
                })),

            removeFormulaOperand: (calculatorId, rowId, operandIndex) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                rows: calc.rows.map((r) =>
                                    r.id === rowId && r.formula
                                        ? {
                                            ...r,
                                            formula: {
                                                ...r.formula,
                                                operands: r.formula.operands.filter((_, i) => i !== operandIndex),
                                            },
                                        }
                                        : r
                                ),
                            }
                            : calc
                    ),
                })),

            // ══════════════════════════════════════════════════════════════════
            // TEMP ITEMS (per-calculator)
            // ══════════════════════════════════════════════════════════════════

            addTempItem: (calculatorId, name, rate) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? { ...calc, tempItems: [...calc.tempItems, { id: uid(), name, rate }] }
                            : calc
                    ),
                })),

            removeTempItem: (calculatorId, itemId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? { ...calc, tempItems: calc.tempItems.filter((t) => t.id !== itemId) }
                            : calc
                    ),
                })),

            updateTempItem: (calculatorId, itemId, updates) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                tempItems: calc.tempItems.map((t) =>
                                    t.id === itemId ? { ...t, ...updates } : t
                                ),
                            }
                            : calc
                    ),
                })),

            // ══════════════════════════════════════════════════════════════════
            // COST BLOCKS
            // ══════════════════════════════════════════════════════════════════

            addCostBlock: (calculatorId, label, blockType) => {
                const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'block';
                set((s) => ({
                    calculators: s.calculators.map((calc) => {
                        if (calc.id !== calculatorId) return calc;
                        const blocks = calc.costBlocks || [];
                        const newBlock: CostBlock = {
                            id: uid(),
                            key: `${key}_${blocks.length + 1}`,
                            label,
                            orderIndex: blocks.length + 1,
                            blockType,
                            isActive: true,
                            isOptional: false,
                            outputKey: '',
                            formulas: [],
                        };
                        return { ...calc, costBlocks: [...blocks, newBlock] };
                    }),
                }));
            },

            updateCostBlock: (calculatorId, blockId, updates) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                costBlocks: (calc.costBlocks || []).map((b) =>
                                    b.id === blockId ? { ...b, ...updates } : b
                                ),
                            }
                            : calc
                    ),
                })),

            removeCostBlock: (calculatorId, blockId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                costBlocks: (calc.costBlocks || [])
                                    .filter((b) => b.id !== blockId)
                                    .map((b, i) => ({ ...b, orderIndex: i + 1 })),
                            }
                            : calc
                    ),
                })),

            moveCostBlock: (calculatorId, blockId, direction) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) => {
                        if (calc.id !== calculatorId) return calc;
                        const blocks = [...(calc.costBlocks || [])];
                        const index = blocks.findIndex((b) => b.id === blockId);
                        if (index < 0) return calc;
                        const target = direction === 'up' ? index - 1 : index + 1;
                        if (target < 0 || target >= blocks.length) return calc;
                        [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
                        return {
                            ...calc,
                            costBlocks: blocks.map((b, i) => ({ ...b, orderIndex: i + 1 })),
                        };
                    }),
                })),

            addBlockFormula: (calculatorId, blockId, formula) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                costBlocks: (calc.costBlocks || []).map((b) => {
                                    if (b.id !== blockId) return b;
                                    const newFormula: BlockFormula = { ...formula, id: uid() };
                                    const updatedFormulas = [...b.formulas, newFormula];
                                    return {
                                        ...b,
                                        formulas: updatedFormulas,
                                        // Auto-set outputKey to the last formula's outputKey
                                        outputKey: newFormula.outputKey,
                                    };
                                }),
                            }
                            : calc
                    ),
                })),

            updateBlockFormula: (calculatorId, blockId, formulaId, updates) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                costBlocks: (calc.costBlocks || []).map((b) =>
                                    b.id === blockId
                                        ? {
                                            ...b,
                                            formulas: b.formulas.map((f) =>
                                                f.id === formulaId ? { ...f, ...updates } : f
                                            ),
                                        }
                                        : b
                                ),
                            }
                            : calc
                    ),
                })),

            removeBlockFormula: (calculatorId, blockId, formulaId) =>
                set((s) => ({
                    calculators: s.calculators.map((calc) =>
                        calc.id === calculatorId
                            ? {
                                ...calc,
                                costBlocks: (calc.costBlocks || []).map((b) => {
                                    if (b.id !== blockId) return b;
                                    const updatedFormulas = b.formulas
                                        .filter((f) => f.id !== formulaId)
                                        .map((f, i) => ({ ...f, orderIndex: i + 1 }));
                                    return {
                                        ...b,
                                        formulas: updatedFormulas,
                                        outputKey: updatedFormulas.length > 0
                                            ? updatedFormulas[updatedFormulas.length - 1].outputKey
                                            : '',
                                    };
                                }),
                            }
                            : calc
                    ),
                })),

            // ══════════════════════════════════════════════════════════════════
            // CALCULATION ENGINE
            // ══════════════════════════════════════════════════════════════════

            calculateResult: (calculator, inputs, selectedDropdowns, userTempItems) => {
                const rowResults: Record<string, string> = {};

                // Process rows in order (same as before)
                for (const row of calculator.rows) {
                    if (!row.key) continue;

                    try {
                        if (row.type === 'input') {
                            rowResults[row.key] = inputs[row.key] || '0';
                        } else if (row.type === 'fixed') {
                            rowResults[row.key] = row.fixedValue || '0';
                        } else if (row.type === 'dropdown') {
                            const selectedValue = selectedDropdowns[row.key];
                            const option = row.dropdownOptions?.find((o) => o.value === selectedValue);
                            rowResults[row.key] = option?.rate || '0';
                        } else if (row.type === 'calculated' && row.formula) {
                            const { operands, operation } = row.formula;
                            if (operands.length === 0) {
                                rowResults[row.key] = '0';
                                continue;
                            }

                            let result = new Decimal(resolveOperand(operands[0], rowResults, calculator.rows));
                            const op = operation as string;

                            // Handle unary operators first (only use first operand)
                            if (op === '√') {
                                result = result.sqrt();
                            } else if (op === 'abs') {
                                result = result.abs();
                            } else if (op === 'round') {
                                result = result.round();
                            } else if (op === 'ceil') {
                                result = Decimal.ceil(result);
                            } else if (op === 'floor') {
                                result = Decimal.floor(result);
                            } else if (op === 'min') {
                                for (let i = 1; i < operands.length; i++) {
                                    const val = new Decimal(resolveOperand(operands[i], rowResults, calculator.rows));
                                    result = Decimal.min(result, val);
                                }
                            } else if (op === 'max') {
                                for (let i = 1; i < operands.length; i++) {
                                    const val = new Decimal(resolveOperand(operands[i], rowResults, calculator.rows));
                                    result = Decimal.max(result, val);
                                }
                            } else if (op === 'avg') {
                                for (let i = 1; i < operands.length; i++) {
                                    const val = new Decimal(resolveOperand(operands[i], rowResults, calculator.rows));
                                    result = result.plus(val);
                                }
                                result = result.dividedBy(operands.length);
                            } else {
                                // Binary operators: applied sequentially
                                for (let i = 1; i < operands.length; i++) {
                                    const val = new Decimal(resolveOperand(operands[i], rowResults, calculator.rows));
                                    switch (op) {
                                        case '+': result = result.plus(val); break;
                                        case '-':
                                        case '−': result = result.minus(val); break;
                                        case '×':
                                        case '*': result = result.times(val); break;
                                        case '÷':
                                        case '/': result = val.isZero() ? result : result.dividedBy(val); break;
                                        case '%': result = result.times(val).dividedBy(100); break;
                                        case '^': result = result.pow(val); break;
                                    }
                                }
                            }
                            rowResults[row.key] = result.toDecimalPlaces(2).toString();
                        }
                    } catch {
                        rowResults[row.key] = '0';
                    }
                }

                // Process cost blocks (if any)
                const blockResults: { blockKey: string; label: string; value: string; isActive: boolean }[] = [];
                const costBlocks = (calculator.costBlocks || []).filter((b) => b.isActive);
                costBlocks.sort((a, b) => a.orderIndex - b.orderIndex);

                for (const block of costBlocks) {
                    // Execute each formula in the block
                    const sortedFormulas = [...block.formulas].sort((a, b) => a.orderIndex - b.orderIndex);
                    for (const formula of sortedFormulas) {
                        try {
                            if (formula.operands.length === 0) {
                                rowResults[formula.outputKey] = '0';
                                continue;
                            }

                            let result = new Decimal(resolveOperand(formula.operands[0], rowResults, calculator.rows));

                            if (formula.operationType === 'sum') {
                                // Sum: accumulate all operands
                                for (let i = 1; i < formula.operands.length; i++) {
                                    const val = new Decimal(resolveOperand(formula.operands[i], rowResults, calculator.rows));
                                    result = result.plus(val);
                                }
                            } else {
                                for (let i = 1; i < formula.operands.length; i++) {
                                    const val = new Decimal(resolveOperand(formula.operands[i], rowResults, calculator.rows));
                                    switch (formula.operationType) {
                                        case '+': result = result.plus(val); break;
                                        case '-': result = result.minus(val); break;
                                        case '×': result = result.times(val); break;
                                        case '÷': result = val.isZero() ? result : result.dividedBy(val); break;
                                    }
                                }
                            }
                            rowResults[formula.outputKey] = result.toDecimalPlaces(2).toString();
                        } catch {
                            rowResults[formula.outputKey] = '0';
                        }
                    }

                    // Record block output
                    blockResults.push({
                        blockKey: block.key,
                        label: block.label,
                        value: rowResults[block.outputKey] || '0',
                        isActive: block.isActive,
                    });
                }

                // Find total row or use last calculated row or last block output
                const totalRow = calculator.rows.find((r) => r.isTotal);
                let total = new Decimal(totalRow ? rowResults[totalRow.key] || '0' : '0');

                if (!totalRow && costBlocks.length > 0) {
                    // Use last block's output as total
                    const lastBlock = costBlocks[costBlocks.length - 1];
                    total = new Decimal(rowResults[lastBlock.outputKey] || '0');
                } else if (!totalRow) {
                    const lastCalc = [...calculator.rows].reverse().find((r) => r.type === 'calculated' && r.key);
                    if (lastCalc) total = new Decimal(rowResults[lastCalc.key] || '0');
                }

                // Add user temp items
                for (const item of userTempItems) {
                    try {
                        total = total.plus(new Decimal(item.rate || '0'));
                    } catch {
                        // skip invalid
                    }
                }

                return {
                    rowResults,
                    total: total.toDecimalPlaces(2).toString(),
                    blockResults: blockResults.length > 0 ? blockResults : undefined,
                };
            },
        }),
        {
            name: 'arovave-calculator-store',
            partialize: (state: AppStore) => ({
                categories: state.categories,
                calculators: state.calculators,
                selectedCalculatorId: state.selectedCalculatorId,
            }),
        }
    )
);

// Helper: resolve an operand to a decimal string
// Also accepts rows array to look up by row ID (for backward compat with old data)
function resolveOperand(operand: string, rowResults: Record<string, string>, rows?: { id: string; key: string }[]): string {
    // If it's a row key, use the result
    if (operand in rowResults) return rowResults[operand];
    // If it's a row ID, find the row key first
    if (rows) {
        const row = rows.find((r) => r.id === operand);
        if (row && row.key in rowResults) return rowResults[row.key];
    }
    // If it's a dropdown rate reference like "material.rate"
    if (operand.endsWith('.rate')) {
        const baseKey = operand.replace('.rate', '');
        if (baseKey in rowResults) return rowResults[baseKey];
    }
    // Otherwise treat as literal number
    return operand;
}

