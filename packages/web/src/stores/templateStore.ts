/**
 * Zustand store for the redesigned calculator system.
 * Centralized Input Hub + Drag-and-Drop Calculator Builder.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Decimal from 'decimal.js';
import { initSupabaseSync } from './supabaseSync';
import type {
    Category,
    InputDefinition,
    InputGroup,
    InputType,
    DropdownOption,
    Calculator,
    CalculatorFormula,
    FormulaToken,
    LocalRate,
    RefTree,
    ReferenceItem,
    UserTempItem,
} from '../types/calculator';

// ─── Helpers ─────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

const labelToKey = (label: string): string =>
    label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `field_${Date.now()}`;

// ─── Store Interface ─────────────────────────────────────────────────

interface AppStore {
    // ── Categories ──
    categories: Category[];
    addCategory: (name: string, parentId: string | null) => void;
    renameCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;
    getCategoryChildren: (parentId: string | null) => Category[];
    getCategoryBreadcrumb: (id: string) => Category[];
    reorderCategories: (orderedIds: string[]) => void;

    // ── Input Definitions (Centralized Hub) ──
    inputDefinitions: InputDefinition[];
    inputGroups: InputGroup[];
    addInput: (type: InputType) => string;
    removeInput: (id: string) => void;
    updateInput: (id: string, updates: Partial<InputDefinition>) => void;
    moveInput: (id: string, direction: 'up' | 'down') => void;
    getInputUsage: (id: string) => { calcId: string; calcName: string }[];
    addInputGroup: (name: string) => string;
    removeInputGroup: (id: string) => void;
    updateInputGroup: (id: string, updates: Partial<InputGroup>) => void;

    // ── Input Dropdown Options ──
    addDropdownOption: (inputId: string) => void;
    removeDropdownOption: (inputId: string, optionId: string) => void;
    updateDropdownOption: (inputId: string, optionId: string, updates: Partial<DropdownOption>) => void;

    // ── Input Reference Items ──
    addReferenceItem: (inputId: string) => void;
    removeReferenceItem: (inputId: string, itemId: string) => void;
    updateReferenceItem: (inputId: string, itemId: string, updates: Partial<ReferenceItem>) => void;

    // ── Input Ref Tree ──
    setRefTree: (inputId: string, refTree: RefTree | undefined) => void;

    // ── Calculators ──
    calculators: Calculator[];
    createCalculator: (categoryId: string, name: string) => string;
    updateCalculator: (id: string, updates: Partial<Calculator>) => void;
    deleteCalculator: (id: string) => void;
    getCalculatorForCategory: (categoryId: string) => Calculator | undefined;
    getCalculatorsForCategory: (categoryId: string) => Calculator[];

    // ── Additional Charges (linked to a parent calculator) ──
    createCharge: (parentCalcId: string, name: string) => string;
    getChargesForCalculator: (calcId: string) => Calculator[];
    duplicateCalculator: (calcId: string, targetCategoryId: string) => string;

    // ── Calculator Formulas ──
    addFormula: (calcId: string) => string;
    removeFormula: (calcId: string, formulaId: string) => void;
    updateFormula: (calcId: string, formulaId: string, updates: Partial<CalculatorFormula>) => void;
    setFormulaTokens: (calcId: string, formulaId: string, tokens: FormulaToken[]) => void;
    insertFormulaToken: (calcId: string, formulaId: string, index: number, token: FormulaToken) => void;
    moveFormula: (calcId: string, formulaId: string, direction: 'up' | 'down') => void;

    // ── Calculator Used Inputs ──
    addUsedInput: (calcId: string, inputId: string) => void;
    removeUsedInput: (calcId: string, inputId: string) => void;

    // ── Calculator Local Rates ──
    addLocalRate: (calcId: string) => string;
    removeLocalRate: (calcId: string, rateId: string) => void;
    updateLocalRate: (calcId: string, rateId: string, updates: Partial<LocalRate>) => void;

    // ── Calculation Engine ──
    calculateResult: (
        calc: Calculator,
        inputs: Record<string, string>,
        selectedDropdowns: Record<string, string>,
        userTempItems: UserTempItem[],
        externalFormulaValues?: Record<string, string>,
    ) => {
        formulaResults: Record<string, string>;
        total: string;
    };
}

// ─── Store Implementation ────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
    persist(
        (set, get) => ({
            // ══════════════════════════════════════════════════════════════════
            // CATEGORIES
            // ══════════════════════════════════════════════════════════════════

            categories: [],

            addCategory(name, parentId) {
                const siblings = get().categories.filter((c) => c.parentId === parentId);
                set({
                    categories: [
                        ...get().categories,
                        {
                            id: uid(),
                            name,
                            parentId,
                            order: siblings.length,
                        },
                    ],
                });
            },

            renameCategory(id, name) {
                set({ categories: get().categories.map((c) => (c.id === id ? { ...c, name } : c)) });
            },

            deleteCategory(id) {
                const getAllDescendants = (parentId: string): string[] => {
                    const children = get().categories.filter((c) => c.parentId === parentId);
                    return children.flatMap((c) => [c.id, ...getAllDescendants(c.id)]);
                };
                const toDelete = new Set([id, ...getAllDescendants(id)]);
                set({
                    categories: get().categories.filter((c) => !toDelete.has(c.id)),
                    calculators: get().calculators.filter((c) => !toDelete.has(c.categoryId)),
                });
            },

            reorderCategories(orderedIds) {
                set({
                    categories: get().categories.map((c) => {
                        const idx = orderedIds.indexOf(c.id);
                        return idx >= 0 ? { ...c, order: idx } : c;
                    }),
                });
            },

            getCategoryChildren(parentId) {
                return get()
                    .categories.filter((c) => c.parentId === parentId)
                    .sort((a, b) => a.order - b.order);
            },

            getCategoryBreadcrumb(id) {
                const cats = get().categories;
                const chain: Category[] = [];
                let current = cats.find((c) => c.id === id);
                while (current) {
                    chain.unshift(current);
                    current = current.parentId ? cats.find((c) => c.id === current!.parentId) : undefined;
                }
                return chain;
            },

            // ══════════════════════════════════════════════════════════════════
            // INPUT DEFINITIONS (CENTRALIZED HUB)
            // ══════════════════════════════════════════════════════════════════

            inputDefinitions: [],
            inputGroups: [],

            addInput(type) {
                const id = uid();
                const order = get().inputDefinitions.length;
                const defaultNames: Record<InputType, string> = {
                    number: 'New Input',
                    dropdown: 'New Dropdown',
                    fixed: 'New Fixed Cost',
                };
                const name = defaultNames[type];
                const newInput: InputDefinition = {
                    id,
                    name,
                    key: labelToKey(name) + '_' + order,
                    type,
                    rate: '0',
                    order,
                    fixedValue: type === 'fixed' ? '0' : undefined,
                    dropdownOptions: type === 'dropdown' ? [] : undefined,
                    isRequired: false,
                };
                set({ inputDefinitions: [...get().inputDefinitions, newInput] });
                return id;
            },

            removeInput(id) {
                set({
                    inputDefinitions: get().inputDefinitions.filter((i) => i.id !== id),
                    // Also remove from all calculators' usedInputIds
                    calculators: get().calculators.map((c) => ({
                        ...c,
                        usedInputIds: c.usedInputIds.filter((iid) => iid !== id),
                        // Remove tokens referencing this input from all formulas
                        formulas: c.formulas.map((f) => ({
                            ...f,
                            tokens: f.tokens.filter((t) => !(t.type === 'input' && t.value === id)),
                        })),
                    })),
                });
            },

            updateInput(id, updates) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== id) return i;
                        const updated = { ...i, ...updates };
                        // Auto-update key when name changes
                        if (updates.name && !updates.key) {
                            updated.key = labelToKey(updates.name) + '_' + i.order;
                        }
                        return updated;
                    }),
                });
            },

            moveInput(id, direction) {
                const defs = [...get().inputDefinitions].sort((a, b) => a.order - b.order);
                const idx = defs.findIndex((d) => d.id === id);
                if (idx < 0) return;
                const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (swapIdx < 0 || swapIdx >= defs.length) return;
                const tempOrder = defs[idx].order;
                defs[idx] = { ...defs[idx], order: defs[swapIdx].order };
                defs[swapIdx] = { ...defs[swapIdx], order: tempOrder };
                set({ inputDefinitions: defs });
            },

            getInputUsage(id) {
                return get()
                    .calculators.filter((c) => c.usedInputIds.includes(id))
                    .map((c) => ({ calcId: c.id, calcName: c.name }));
            },

            addInputGroup(name) {
                const id = uid();
                set({
                    inputGroups: [
                        ...get().inputGroups,
                        { id, name, order: get().inputGroups.length },
                    ],
                });
                return id;
            },

            removeInputGroup(id) {
                set({
                    inputGroups: get().inputGroups.filter((g) => g.id !== id),
                    inputDefinitions: get().inputDefinitions.map((i) =>
                        i.groupId === id ? { ...i, groupId: undefined } : i,
                    ),
                });
            },

            updateInputGroup(id, updates) {
                set({
                    inputGroups: get().inputGroups.map((g) =>
                        g.id === id ? { ...g, ...updates } : g,
                    ),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // DROPDOWN OPTIONS (on Input Definitions)
            // ══════════════════════════════════════════════════════════════════

            addDropdownOption(inputId) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== inputId) return i;
                        const opts = i.dropdownOptions || [];
                        return {
                            ...i,
                            dropdownOptions: [
                                ...opts,
                                { id: uid(), label: '', value: '', rate: '0' },
                            ],
                        };
                    }),
                });
            },

            removeDropdownOption(inputId, optionId) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== inputId) return i;
                        return {
                            ...i,
                            dropdownOptions: (i.dropdownOptions || []).filter((o) => o.id !== optionId),
                        };
                    }),
                });
            },

            updateDropdownOption(inputId, optionId, updates) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== inputId) return i;
                        return {
                            ...i,
                            dropdownOptions: (i.dropdownOptions || []).map((o) => {
                                if (o.id !== optionId) return o;
                                const merged = { ...o, ...updates };
                                // Auto-generate value (key) from label
                                if (updates.label !== undefined) {
                                    merged.value = labelToKey(updates.label);
                                }
                                return merged;
                            }),
                        };
                    }),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // REFERENCE ITEMS (on Input Definitions)
            // ══════════════════════════════════════════════════════════════════

            addReferenceItem(inputId) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== inputId) return i;
                        const items = i.referenceItems || [];
                        return {
                            ...i,
                            referenceItems: [
                                ...items,
                                { id: uid(), name: '', value: '0' },
                            ],
                        };
                    }),
                });
            },

            removeReferenceItem(inputId, itemId) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== inputId) return i;
                        return {
                            ...i,
                            referenceItems: (i.referenceItems || []).filter((r) => r.id !== itemId),
                        };
                    }),
                });
            },

            updateReferenceItem(inputId, itemId, updates) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) => {
                        if (i.id !== inputId) return i;
                        return {
                            ...i,
                            referenceItems: (i.referenceItems || []).map((r) =>
                                r.id === itemId ? { ...r, ...updates } : r,
                            ),
                        };
                    }),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // REF TREE (on Input Definitions)
            // ══════════════════════════════════════════════════════════════════

            setRefTree(inputId, refTree) {
                set({
                    inputDefinitions: get().inputDefinitions.map((i) =>
                        i.id === inputId ? { ...i, refTree } : i,
                    ),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // CALCULATORS
            // ══════════════════════════════════════════════════════════════════

            calculators: [],

            createCalculator(categoryId, name) {
                const id = uid();
                set({
                    calculators: [
                        ...get().calculators,
                        {
                            id,
                            name,
                            categoryId,
                            formulas: [],
                            localRates: [],
                            usedInputIds: [],
                        },
                    ],
                });
                return id;
            },

            deleteCalculator(id) {
                set({ calculators: get().calculators.filter((c) => c.id !== id) });
            },

            updateCalculator(id, updates) {
                set({
                    calculators: get().calculators.map((c) =>
                        c.id === id ? { ...c, ...updates } : c,
                    ),
                });
            },

            getCalculatorForCategory(categoryId) {
                return get().calculators.find((c) => c.categoryId === categoryId && !c.isCharge);
            },

            getCalculatorsForCategory(categoryId) {
                return get().calculators.filter((c) => c.categoryId === categoryId && !c.isCharge);
            },

            // ══════════════════════════════════════════════════════════════════
            // ADDITIONAL CHARGES (linked to a parent calculator)
            // ══════════════════════════════════════════════════════════════════

            createCharge(parentCalcId, name) {
                const parent = get().calculators.find((c) => c.id === parentCalcId);
                if (!parent) return '';
                const id = uid();
                set({
                    calculators: [
                        ...get().calculators,
                        {
                            id,
                            name,
                            categoryId: parent.categoryId,
                            formulas: [],
                            localRates: [],
                            usedInputIds: [],
                            isCharge: true,
                            parentCalcId,
                        },
                    ],
                });
                return id;
            },

            getChargesForCalculator(calcId) {
                return get().calculators.filter((c) => c.isCharge && c.parentCalcId === calcId);
            },

            duplicateCalculator(calcId, targetCategoryId) {
                const source = get().calculators.find((c) => c.id === calcId);
                if (!source) return '';

                // Helper: clone a single calculator (or charge) with new IDs
                const cloneCalc = (
                    src: Calculator,
                    overrides: Partial<Calculator>,
                ): Calculator => {
                    const newId = uid();

                    // Build old→new formula ID map
                    const formulaIdMap: Record<string, string> = {};
                    src.formulas.forEach((f) => {
                        formulaIdMap[f.id] = uid();
                    });

                    // Clone formulas with new IDs and remapped formula_ref tokens
                    const newFormulas: CalculatorFormula[] = src.formulas.map((f) => ({
                        ...f,
                        id: formulaIdMap[f.id],
                        key: labelToKey(f.label) + '_' + formulaIdMap[f.id].slice(0, 4),
                        tokens: f.tokens.map((t) => {
                            if (t.type === 'formula_ref' && formulaIdMap[t.value]) {
                                return { ...t, value: formulaIdMap[t.value] };
                            }
                            return { ...t };
                        }),
                    }));

                    // Clone local rates with new IDs
                    const newLocalRates: LocalRate[] = src.localRates.map((lr) => ({
                        ...lr,
                        id: uid(),
                    }));

                    return {
                        ...src,
                        id: newId,
                        formulas: newFormulas,
                        localRates: newLocalRates,
                        usedInputIds: [...src.usedInputIds],
                        ...overrides,
                    };
                };

                // Clone the main calculator
                const newCalc = cloneCalc(source, {
                    name: source.name + ' (Copy)',
                    categoryId: targetCategoryId,
                });

                // Clone all linked charges
                const charges = get().calculators.filter(
                    (c) => c.isCharge && c.parentCalcId === calcId,
                );
                const newCharges = charges.map((charge) =>
                    cloneCalc(charge, {
                        categoryId: targetCategoryId,
                        isCharge: true,
                        parentCalcId: newCalc.id,
                    }),
                );

                // Push all new calculators at once
                set({
                    calculators: [
                        ...get().calculators,
                        newCalc,
                        ...newCharges,
                    ],
                });

                return newCalc.id;
            },

            // ══════════════════════════════════════════════════════════════════
            // CALCULATOR FORMULAS
            // ══════════════════════════════════════════════════════════════════

            addFormula(calcId) {
                const id = uid();
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        const order = c.formulas.length;
                        return {
                            ...c,
                            formulas: [
                                ...c.formulas,
                                {
                                    id,
                                    label: `Formula ${order + 1}`,
                                    key: `formula_${order + 1}`,
                                    tokens: [],
                                    order,
                                    isTotal: false,
                                },
                            ],
                        };
                    }),
                });
                return id;
            },

            removeFormula(calcId, formulaId) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            formulas: c.formulas.filter((f) => f.id !== formulaId),
                        };
                    }),
                });
            },

            updateFormula(calcId, formulaId, updates) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            formulas: c.formulas.map((f) =>
                                f.id === formulaId ? { ...f, ...updates } : f,
                            ),
                        };
                    }),
                });
            },

            setFormulaTokens(calcId, formulaId, tokens) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            formulas: c.formulas.map((f) =>
                                f.id === formulaId ? { ...f, tokens } : f,
                            ),
                        };
                    }),
                });
            },

            insertFormulaToken(calcId, formulaId, index, token) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            formulas: c.formulas.map((f) => {
                                if (f.id !== formulaId) return f;
                                const newTokens = [...f.tokens];
                                newTokens.splice(index, 0, token);
                                return { ...f, tokens: newTokens };
                            }),
                        };
                    }),
                });
            },

            moveFormula(calcId, formulaId, direction) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        const sorted = [...c.formulas].sort((a, b) => a.order - b.order);
                        const idx = sorted.findIndex((f) => f.id === formulaId);
                        if (idx < 0) return c;
                        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                        if (swapIdx < 0 || swapIdx >= sorted.length) return c;
                        const tempOrder = sorted[idx].order;
                        sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
                        sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };
                        return { ...c, formulas: sorted };
                    }),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // CALCULATOR USED INPUTS
            // ══════════════════════════════════════════════════════════════════

            addUsedInput(calcId, inputId) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId || c.usedInputIds.includes(inputId)) return c;
                        return { ...c, usedInputIds: [...c.usedInputIds, inputId] };
                    }),
                });
            },

            removeUsedInput(calcId, inputId) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            usedInputIds: c.usedInputIds.filter((iid) => iid !== inputId),
                            // Also remove tokens referencing this input
                            formulas: c.formulas.map((f) => ({
                                ...f,
                                tokens: f.tokens.filter((t) => !(t.type === 'input' && t.value === inputId)),
                            })),
                        };
                    }),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // CALCULATOR LOCAL RATES
            // ══════════════════════════════════════════════════════════════════

            addLocalRate(calcId) {
                const id = uid();
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            localRates: [
                                ...c.localRates,
                                { id, name: '', rate: '0' },
                            ],
                        };
                    }),
                });
                return id;
            },

            removeLocalRate(calcId, rateId) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            localRates: c.localRates.filter((r) => r.id !== rateId),
                        };
                    }),
                });
            },

            updateLocalRate(calcId, rateId, updates) {
                set({
                    calculators: get().calculators.map((c) => {
                        if (c.id !== calcId) return c;
                        return {
                            ...c,
                            localRates: c.localRates.map((r) =>
                                r.id === rateId ? { ...r, ...updates } : r,
                            ),
                        };
                    }),
                });
            },

            // ══════════════════════════════════════════════════════════════════
            // CALCULATION ENGINE
            // ══════════════════════════════════════════════════════════════════

            calculateResult(calc, inputValues, selectedDropdowns, userTempItems, externalFormulaValues) {
                const inputDefs = get().inputDefinitions;
                const formulaResults: Record<string, string> = {};

                // Build a value map: input keys → their values
                const valueMap: Record<string, Decimal> = {};

                // Seed with external formula values (e.g. parent calculator results for charges)
                if (externalFormulaValues) {
                    for (const [id, val] of Object.entries(externalFormulaValues)) {
                        try {
                            valueMap[id] = new Decimal(val || '0');
                        } catch {
                            valueMap[id] = new Decimal(0);
                        }
                    }
                }

                // Populate from input definitions
                for (const inputDef of inputDefs) {
                    if (!calc.usedInputIds.includes(inputDef.id)) continue;

                    if (inputDef.type === 'number') {
                        const val = inputValues[inputDef.key];
                        valueMap[inputDef.id] = val ? new Decimal(val || '0') : new Decimal(0);
                    } else if (inputDef.type === 'dropdown') {
                        const selected = selectedDropdowns[inputDef.key];
                        if (selected && inputDef.dropdownOptions) {
                            const opt = inputDef.dropdownOptions.find((o) => o.value === selected);
                            valueMap[inputDef.id] = opt ? new Decimal(opt.rate || '0') : new Decimal(0);
                        } else {
                            valueMap[inputDef.id] = new Decimal(0);
                        }
                    } else if (inputDef.type === 'fixed') {
                        valueMap[inputDef.id] = new Decimal(inputDef.fixedValue || '0');
                    }
                }

                // Add local rates to value map
                for (const lr of calc.localRates) {
                    valueMap[`local_${lr.id}`] = new Decimal(lr.rate || '0');
                }

                // Evaluate formulas in order
                const sortedFormulas = [...calc.formulas].sort((a, b) => a.order - b.order);

                for (const formula of sortedFormulas) {
                    try {
                        const result = evaluateTokens(formula.tokens, valueMap);
                        formulaResults[formula.key] = result.toFixed(2);
                        valueMap[formula.id] = result; // Allow later formulas to reference
                    } catch {
                        formulaResults[formula.key] = '0';
                        valueMap[formula.id] = new Decimal(0);
                    }
                }

                // Calculate total — sum of all formulas marked as total, or last formula
                let total = new Decimal(0);
                const totalFormulas = sortedFormulas.filter((f) => f.isTotal);
                if (totalFormulas.length > 0) {
                    for (const f of totalFormulas) {
                        total = total.plus(new Decimal(formulaResults[f.key] || '0'));
                    }
                } else if (sortedFormulas.length > 0) {
                    const last = sortedFormulas[sortedFormulas.length - 1];
                    total = new Decimal(formulaResults[last.key] || '0');
                }

                // Add user temp items
                for (const item of userTempItems) {
                    if (item.rate) {
                        total = total.plus(new Decimal(item.rate || '0'));
                    }
                }

                return {
                    formulaResults,
                    total: total.toFixed(2),
                };
            },
        }),
        {
            name: 'arovave-calculator-v2',
        },
    ),
);


// ─── Supabase Sync ──────────────────────────────────────────────────
// Auto-initialize sync on module load (delay lets store hydrate from localStorage first)
setTimeout(() => { initSupabaseSync(useAppStore); }, 500);


// ─── Token Evaluator ────────────────────────────────────────────────

function evaluateTokens(tokens: FormulaToken[], values: Record<string, Decimal>): Decimal {
    if (tokens.length === 0) return new Decimal(0);

    // Build an expression string and evaluate using basic shunting-yard
    const outputQueue: Decimal[] = [];
    const operatorStack: string[] = [];

    const precedence: Record<string, number> = {
        '+': 1,
        '-': 1,
        '×': 2,
        '*': 2,
        '÷': 2,
        '/': 2,
        '%': 2,
    };

    const applyOp = (op: string, b: Decimal, a: Decimal): Decimal => {
        switch (op) {
            case '+': return a.plus(b);
            case '-': return a.minus(b);
            case '×': case '*': return a.times(b);
            case '÷': case '/': return b.isZero() ? new Decimal(0) : a.div(b);
            case '%': return a.times(b).div(100);
            default: return new Decimal(0);
        }
    };

    for (const token of tokens) {
        if (token.type === 'input' || token.type === 'formula_ref') {
            const val = values[token.value] || new Decimal(0);
            outputQueue.push(val);
        } else if (token.type === 'number') {
            outputQueue.push(new Decimal(token.value || '0'));
        } else if (token.type === 'bracket') {
            if (token.value === '(') {
                operatorStack.push('(');
            } else if (token.value === ')') {
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                    const op = operatorStack.pop()!;
                    if (outputQueue.length < 2) break;
                    const b = outputQueue.pop()!;
                    const a = outputQueue.pop()!;
                    outputQueue.push(applyOp(op, b, a));
                }
                operatorStack.pop(); // remove '('
            }
        } else if (token.type === 'operator') {
            while (
                operatorStack.length > 0 &&
                operatorStack[operatorStack.length - 1] !== '(' &&
                (precedence[operatorStack[operatorStack.length - 1]] || 0) >=
                (precedence[token.value] || 0)
            ) {
                const op = operatorStack.pop()!;
                if (outputQueue.length < 2) break;
                const b = outputQueue.pop()!;
                const a = outputQueue.pop()!;
                outputQueue.push(applyOp(op, b, a));
            }
            operatorStack.push(token.value);
        }
    }

    // Drain remaining operators
    while (operatorStack.length > 0) {
        const op = operatorStack.pop()!;
        if (op === '(' || op === ')') continue;
        if (outputQueue.length < 2) break;
        const b = outputQueue.pop()!;
        const a = outputQueue.pop()!;
        outputQueue.push(applyOp(op, b, a));
    }

    return outputQueue.length > 0 ? outputQueue[0] : new Decimal(0);
}
