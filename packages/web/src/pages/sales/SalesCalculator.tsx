import { useState, useMemo, useCallback } from 'react';
import {
    Calculator,
    ChevronRight,
    FolderOpen,
    ArrowLeft,
    Plus,
    X,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { RefTreeNode, Calculator as CalcType, InputDefinition } from '../../types/calculator';

// ═══════════════════════════════════════════════════════════════════════
// SALES CALCULATOR — Multi-Charge Stackable System
// ═══════════════════════════════════════════════════════════════════════

export function SalesCalculator() {
    const store = useAppStore();
    const {
        categories,
        inputDefinitions,
        getCategoryChildren,
        getCategoryBreadcrumb,
        getCalculatorsForCategory,
        calculateResult,
    } = store;

    const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
    // Multi-charge: track which calculators are active (first always active)
    const [activeCalcIds, setActiveCalcIds] = useState<string[]>([]);
    // Per-calculator input states
    const [inputsByCalc, setInputsByCalc] = useState<Record<string, Record<string, string>>>({});
    const [dropdownsByCalc, setDropdownsByCalc] = useState<Record<string, Record<string, string>>>({});
    // Per-calculator collapse state
    const [collapsedCalcs, setCollapsedCalcs] = useState<Record<string, boolean>>({});
    // Reference sidebar
    const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
    const [focusedCalcId, setFocusedCalcId] = useState<string | null>(null);
    const [refTreePath, setRefTreePath] = useState<string[]>([]);
    const [showAddCharge, setShowAddCharge] = useState(false);

    // Navigation
    const children = getCategoryChildren(currentCategoryId);
    const breadcrumb = currentCategoryId ? getCategoryBreadcrumb(currentCategoryId) : [];

    // All calculators in this category
    const categoryCalcs = currentCategoryId ? getCalculatorsForCategory(currentCategoryId) : [];
    const activeCalcs = activeCalcIds
        .map((id) => categoryCalcs.find((c) => c.id === id))
        .filter(Boolean) as CalcType[];
    const availableToAdd = categoryCalcs.filter((c) => !activeCalcIds.includes(c.id));

    const navigateTo = useCallback((id: string | null) => {
        setCurrentCategoryId(id);
        setActiveCalcIds([]);
        setInputsByCalc({});
        setDropdownsByCalc({});
        setCollapsedCalcs({});
        setFocusedInputId(null);
        setFocusedCalcId(null);
        setRefTreePath([]);
        setShowAddCharge(false);

        // Auto-activate first calculator
        if (id) {
            const calcs = getCalculatorsForCategory(id);
            if (calcs.length > 0) {
                setActiveCalcIds([calcs[0].id]);
            }
        }
    }, [getCalculatorsForCategory]);

    const addCharge = useCallback((calcId: string) => {
        setActiveCalcIds((prev) => [...prev, calcId]);
        setShowAddCharge(false);
    }, []);

    const removeCharge = useCallback((calcId: string) => {
        setActiveCalcIds((prev) => prev.filter((id) => id !== calcId));
        setInputsByCalc((prev) => { const next = { ...prev }; delete next[calcId]; return next; });
        setDropdownsByCalc((prev) => { const next = { ...prev }; delete next[calcId]; return next; });
        setCollapsedCalcs((prev) => { const next = { ...prev }; delete next[calcId]; return next; });
    }, []);

    const toggleCollapse = useCallback((calcId: string) => {
        setCollapsedCalcs((prev) => ({ ...prev, [calcId]: !prev[calcId] }));
    }, []);

    const setCalcInput = useCallback((calcId: string, key: string, value: string) => {
        setInputsByCalc((prev) => ({
            ...prev,
            [calcId]: { ...(prev[calcId] || {}), [key]: value },
        }));
    }, []);

    const setCalcDropdown = useCallback((calcId: string, key: string, value: string) => {
        setDropdownsByCalc((prev) => ({
            ...prev,
            [calcId]: { ...(prev[calcId] || {}), [key]: value },
        }));
    }, []);

    // Compute result for each active calculator
    const calcResults = useMemo(() => {
        const results: Record<string, { formulaResults: Record<string, string>; total: string; subtotal: number; profitAmount: number; afterProfit: number; gstAmount: number; finalAmount: number }> = {};
        for (const calc of activeCalcs) {
            const inputs = inputsByCalc[calc.id] || {};
            const dropdowns = dropdownsByCalc[calc.id] || {};
            const result = calculateResult(calc, inputs, dropdowns, []);

            // Calculate subtotal, profit, GST flow
            const grandTotalFormula = calc.formulas.find((f) => f.isTotal);
            const subtotal = grandTotalFormula
                ? parseFloat(result.formulaResults[grandTotalFormula.key] || '0')
                : parseFloat(result.total || '0');

            const profitPct = parseFloat(calc.profitPercent || '0') || 0;
            const profitAmount = subtotal * (profitPct / 100);
            const afterProfit = subtotal + profitAmount;

            const gstPct = parseFloat(calc.gstPercent || '0') || 0;
            const gstAmount = afterProfit * (gstPct / 100);
            const finalAmount = afterProfit + gstAmount;

            results[calc.id] = {
                ...result,
                subtotal,
                profitAmount,
                afterProfit,
                gstAmount,
                finalAmount,
            };
        }
        return results;
    }, [activeCalcs, inputsByCalc, dropdownsByCalc, calculateResult]);

    // Grand total = sum of all calculator final amounts
    const grandTotal = useMemo(() => {
        return Object.values(calcResults).reduce((sum, r) => sum + r.finalAmount, 0);
    }, [calcResults]);

    // Reference sidebar
    const focusedInputDef = focusedInputId
        ? inputDefinitions.find((i) => i.id === focusedInputId)
        : null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-black flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-black" />
                    Pricing Calculator
                </h1>
                <p className="mt-1 text-base text-black/50">
                    Select a product category and fill the form to calculate pricing.
                </p>
            </div>

            {/* Breadcrumb */}
            {breadcrumb.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        onClick={() => navigateTo(null)}
                        className="text-sm text-black/50 hover:text-black transition-colors"
                    >
                        Home
                    </button>
                    {breadcrumb.map((cat, i) => (
                        <span key={cat.id} className="flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 text-black/30" />
                            <button
                                onClick={() => navigateTo(cat.id)}
                                className={`text-sm transition-colors ${i === breadcrumb.length - 1
                                    ? 'text-black font-semibold'
                                    : 'text-black/50 hover:text-black'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-6">
                {/* Main content */}
                <div className="flex-1 space-y-4">
                    {/* Category browser */}
                    {activeCalcs.length === 0 && (
                        <>
                            {currentCategoryId && (
                                <button
                                    onClick={() => {
                                        const current = categories.find((c) => c.id === currentCategoryId);
                                        navigateTo(current?.parentId || null);
                                    }}
                                    className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black transition-colors"
                                >
                                    <ArrowLeft className="w-3 h-3" />
                                    Back
                                </button>
                            )}

                            {children.length === 0 && !currentCategoryId && categories.length === 0 && (
                                <div className="glass rounded-2xl p-10 text-center">
                                    <Calculator className="w-12 h-12 text-black/20 mx-auto mb-3" />
                                    <p className="text-black/40 text-base">
                                        No categories yet. Ask your admin to create product categories.
                                    </p>
                                </div>
                            )}

                            {children.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {children.map((cat) => {
                                        const calcs = getCalculatorsForCategory(cat.id);
                                        const hasCalc = calcs.length > 0;
                                        const subChildren = getCategoryChildren(cat.id);

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => navigateTo(cat.id)}
                                                className="glass rounded-2xl p-4 text-left hover:border-black/15 border border-transparent transition-all duration-200 group"
                                            >
                                                {hasCalc ? (
                                                    <Calculator className="w-6 h-6 text-black mb-2 group-hover:scale-110 transition-transform" />
                                                ) : (
                                                    <FolderOpen className="w-6 h-6 text-black/50 mb-2 group-hover:scale-110 transition-transform" />
                                                )}
                                                <span className="text-base font-semibold text-black block">{cat.name}</span>
                                                <span className="text-[11px] text-black/40 mt-0.5 block">
                                                    {hasCalc
                                                        ? `${calcs.length} calculator${calcs.length > 1 ? 's' : ''}`
                                                        : `${subChildren.length} sub-categories`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Calculator sections */}
                    {activeCalcs.length > 0 && (
                        <div className="space-y-4">
                            <button
                                onClick={() => {
                                    const current = categories.find((c) => c.id === currentCategoryId);
                                    navigateTo(current?.parentId || null);
                                }}
                                className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black transition-colors"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                Back to categories
                            </button>

                            {/* Render each active calculator as a section */}
                            {activeCalcs.map((calc, idx) => (
                                <CalculatorSection
                                    key={calc.id}
                                    calc={calc}
                                    isFirst={idx === 0}
                                    isCollapsed={collapsedCalcs[calc.id] || false}
                                    inputs={inputsByCalc[calc.id] || {}}
                                    dropdowns={dropdownsByCalc[calc.id] || {}}
                                    result={calcResults[calc.id]}
                                    inputDefinitions={inputDefinitions}
                                    onSetInput={(key, val) => setCalcInput(calc.id, key, val)}
                                    onSetDropdown={(key, val) => setCalcDropdown(calc.id, key, val)}
                                    onToggleCollapse={() => toggleCollapse(calc.id)}
                                    onRemove={idx > 0 ? () => removeCharge(calc.id) : undefined}
                                    onFocusInput={(inputId) => {
                                        setFocusedInputId(inputId);
                                        setFocusedCalcId(calc.id);
                                        setRefTreePath([]);
                                    }}
                                    focusedInputId={focusedCalcId === calc.id ? focusedInputId : null}
                                />
                            ))}

                            {/* Add Charge button */}
                            {availableToAdd.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowAddCharge(!showAddCharge)}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-black/10 text-sm text-black/40 hover:text-black hover:border-black/20 font-semibold transition-all hover:bg-black/[0.02]"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Charge
                                    </button>

                                    {showAddCharge && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowAddCharge(false)} />
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 bg-white rounded-2xl shadow-xl shadow-black/10 border border-black/8 p-2 min-w-[240px] animate-slide-up">
                                                <p className="text-[10px] text-black/30 font-semibold uppercase tracking-wider px-3 py-1.5">
                                                    Available Calculators
                                                </p>
                                                {availableToAdd.map((calc) => (
                                                    <button
                                                        key={calc.id}
                                                        onClick={() => addCharge(calc.id)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/[0.03] transition-colors text-left group"
                                                    >
                                                        <div className="p-1.5 rounded-lg border bg-blue-50 text-blue-600 border-blue-200">
                                                            <Calculator className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-semibold text-black block">
                                                                {calc.name}
                                                            </span>
                                                            <span className="text-[11px] text-black/40">
                                                                {calc.formulas.length} formula{calc.formulas.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ═══ GRAND TOTAL ═══ */}
                            {activeCalcs.length > 0 && (
                                <div className="rounded-2xl overflow-hidden border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/30">
                                    {/* Per-calculator subtotals summary */}
                                    {activeCalcs.length > 1 && (
                                        <div className="px-5 pt-4 pb-2 space-y-1">
                                            {activeCalcs.map((calc) => {
                                                const r = calcResults[calc.id];
                                                return (
                                                    <div key={calc.id} className="flex items-center justify-between text-sm">
                                                        <span className="text-emerald-700/70">{calc.name}</span>
                                                        <span className="font-mono font-semibold text-emerald-600">
                                                            ₹{r ? r.finalAmount.toFixed(2) : '0.00'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            <div className="border-t border-emerald-200/60 my-1" />
                                        </div>
                                    )}

                                    {/* Grand Total */}
                                    <div className={`px-5 ${activeCalcs.length > 1 ? 'pt-1 pb-4' : 'py-4'} flex items-center justify-between`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-500 text-lg">🏆</span>
                                            <span className="text-lg font-bold text-emerald-800">
                                                Grand Total
                                            </span>
                                        </div>
                                        <span className="text-xl font-mono font-bold text-emerald-700">
                                            ₹{grandTotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Reference sidebar */}
                {focusedInputDef && focusedCalcId && (() => {
                    const refItems = focusedInputDef.referenceItems || [];
                    const refTree = focusedInputDef.refTree;
                    const hasAnything = refItems.length > 0 || refTree;

                    if (!hasAnything) return null;

                    // Tree navigation
                    let treeCurrentNodes: RefTreeNode[] = [];
                    if (refTree) {
                        let nodes = refTree.nodes;
                        for (let i = 0; i < refTreePath.length; i++) {
                            const found = nodes.find((n) => n.id === refTreePath[i]);
                            if (found) {
                                nodes = found.children || [];
                            } else break;
                        }
                        treeCurrentNodes = nodes;
                    }

                    const treeBreadcrumb: { id: string; name: string }[] = [];
                    if (refTree) {
                        let nodes = refTree.nodes;
                        for (let i = 0; i < refTreePath.length; i++) {
                            const found = nodes.find((n) => n.id === refTreePath[i]);
                            if (found) {
                                treeBreadcrumb.push({ id: found.id, name: found.name || '...' });
                                nodes = found.children || [];
                            } else break;
                        }
                    }

                    return (
                        <div className="w-64 shrink-0">
                            <div className="glass rounded-2xl p-4 space-y-3 sticky top-20">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-black">
                                        {focusedInputDef.name} — Reference
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setFocusedInputId(null);
                                            setFocusedCalcId(null);
                                            setRefTreePath([]);
                                        }}
                                        className="p-1 rounded text-black/30 hover:text-black transition-colors"
                                        title="Close"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Tree navigation */}
                                {refTree && (
                                    <div className="space-y-2">
                                        {treeBreadcrumb.length > 0 && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <button
                                                    onClick={() => setRefTreePath([])}
                                                    className="text-[10px] text-black/40 hover:text-black transition-colors"
                                                >
                                                    All
                                                </button>
                                                {treeBreadcrumb.map((bc, i) => (
                                                    <span key={bc.id} className="flex items-center gap-1">
                                                        <ChevronRight className="w-2.5 h-2.5 text-black/20" />
                                                        <button
                                                            onClick={() => setRefTreePath(refTreePath.slice(0, i + 1))}
                                                            className={`text-[10px] transition-colors ${i === treeBreadcrumb.length - 1
                                                                ? 'text-black font-semibold'
                                                                : 'text-black/40 hover:text-black'
                                                                }`}
                                                        >
                                                            {bc.name}
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            {treeCurrentNodes.map((node) => {
                                                const isLeaf = !node.children || node.children.length === 0;
                                                const hasRate = !!node.rate;

                                                return (
                                                    <button
                                                        key={node.id}
                                                        onClick={() => {
                                                            if (isLeaf && hasRate && focusedCalcId) {
                                                                setCalcInput(focusedCalcId, focusedInputDef.key, node.rate!);
                                                            } else if (!isLeaf) {
                                                                setRefTreePath([...refTreePath, node.id]);
                                                            }
                                                        }}
                                                        disabled={isLeaf && !hasRate}
                                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${isLeaf && hasRate && (inputsByCalc[focusedCalcId || ''] || {})[focusedInputDef.key] === node.rate
                                                            ? 'bg-black/[0.06] ring-1 ring-black/10'
                                                            : isLeaf && !hasRate
                                                                ? 'opacity-40 cursor-not-allowed'
                                                                : 'hover:bg-white'
                                                            }`}
                                                    >
                                                        <span className="text-black font-medium">
                                                            {node.name || <span className="text-black/30 italic">Unnamed</span>}
                                                        </span>
                                                        {isLeaf ? (
                                                            <span className="text-black font-mono font-semibold">
                                                                {hasRate ? `₹${node.rate}` : '—'}
                                                            </span>
                                                        ) : (
                                                            <ChevronRight className="w-3.5 h-3.5 text-black/30" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Flat reference items */}
                                {!refTree && refItems.length > 0 && (
                                    <>
                                        <p className="text-[11px] text-black/40">
                                            Click to fill {focusedInputDef.name}:
                                        </p>
                                        <div className="space-y-1">
                                            {refItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        if (focusedCalcId) {
                                                            setCalcInput(focusedCalcId, focusedInputDef.key, item.value);
                                                        }
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${(inputsByCalc[focusedCalcId || ''] || {})[focusedInputDef.key] === item.value
                                                        ? 'bg-black/[0.06] ring-1 ring-black/10'
                                                        : 'hover:bg-white'
                                                        }`}
                                                >
                                                    <span className="text-black font-medium">
                                                        {item.name || 'Unnamed'}
                                                    </span>
                                                    <span className="text-black/50 font-mono">
                                                        ₹{item.value}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// CALCULATOR SECTION — One charge section with inputs, formulas, breakdown
// ═══════════════════════════════════════════════════════════════════════

function CalculatorSection({
    calc,
    isFirst,
    isCollapsed,
    inputs,
    dropdowns,
    result,
    inputDefinitions,
    onSetInput,
    onSetDropdown,
    onToggleCollapse,
    onRemove,
    onFocusInput,
    focusedInputId,
}: {
    calc: CalcType;
    isFirst: boolean;
    isCollapsed: boolean;
    inputs: Record<string, string>;
    dropdowns: Record<string, string>;
    result?: {
        formulaResults: Record<string, string>;
        total: string;
        subtotal: number;
        profitAmount: number;
        afterProfit: number;
        gstAmount: number;
        finalAmount: number;
    };
    inputDefinitions: InputDefinition[];
    onSetInput: (key: string, val: string) => void;
    onSetDropdown: (key: string, val: string) => void;
    onToggleCollapse: () => void;
    onRemove?: () => void;
    onFocusInput: (id: string) => void;
    focusedInputId: string | null;
}) {
    const usedInputDefs = inputDefinitions
        .filter((i) => calc.usedInputIds.includes(i.id))
        .sort((a, b) => a.order - b.order);

    const sortedFormulas = [...calc.formulas].sort((a, b) => a.order - b.order);
    const grandTotalFormula = sortedFormulas.find((f) => f.isTotal);
    const regularFormulas = sortedFormulas.filter((f) => !f.isTotal);
    const profitPct = parseFloat(calc.profitPercent || '0') || 0;
    const gstPct = parseFloat(calc.gstPercent || '0') || 0;

    return (
        <div className="glass rounded-2xl overflow-hidden">
            {/* Section Header */}
            <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isFirst ? 'bg-black/[0.02]' : 'bg-blue-50/50'
                    }`}
                onClick={onToggleCollapse}
            >
                <div className={`p-1.5 rounded-lg border ${isFirst ? 'bg-black/5 border-black/10 text-black/60' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                    <Calculator className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-base font-semibold text-black flex-1">{calc.name}</h2>

                {/* Subtotal badge */}
                {result && (
                    <span className="text-sm font-mono font-semibold text-black/60">
                        ₹{result.finalAmount.toFixed(2)}
                    </span>
                )}

                {/* Collapse/Remove actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {onRemove && (
                        <button
                            onClick={onRemove}
                            className="p-1.5 rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove charge"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-black/20" />
                ) : (
                    <ChevronUp className="w-4 h-4 text-black/20" />
                )}
            </div>

            {/* Section Content */}
            {!isCollapsed && (
                <div className="animate-slide-up">
                    {/* Input fields */}
                    <div className="divide-y divide-black/5">
                        {usedInputDefs.map((inputDef) => (
                            <div
                                key={inputDef.id}
                                className="px-4 py-3 flex items-center justify-between gap-4"
                            >
                                <label className="text-base text-black shrink-0">
                                    {inputDef.name}
                                    {inputDef.isRequired && (
                                        <span className="text-red-400 ml-0.5">*</span>
                                    )}
                                </label>

                                <div className="w-48 shrink-0">
                                    {inputDef.type === 'number' && (
                                        <input
                                            type="text"
                                            value={inputs[inputDef.key] || ''}
                                            onChange={(e) => onSetInput(inputDef.key, e.target.value)}
                                            placeholder="0"
                                            className={`w-full rounded-md bg-white border px-3 py-1.5 text-base text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 text-right transition-colors ${focusedInputId === inputDef.id
                                                ? 'border-black/30 ring-black/20'
                                                : 'border-black/10 focus:ring-black/10'
                                                }`}
                                            onFocus={() => {
                                                if (inputDef.referenceItems?.length || inputDef.refTree) {
                                                    onFocusInput(inputDef.id);
                                                }
                                            }}
                                        />
                                    )}

                                    {inputDef.type === 'dropdown' && (
                                        <select
                                            value={dropdowns[inputDef.key] || ''}
                                            onChange={(e) => onSetDropdown(inputDef.key, e.target.value)}
                                            className="w-full rounded-md bg-white border border-black/10 px-3 py-1.5 text-base text-black outline-none focus:ring-1 focus:ring-black/10"
                                            title={inputDef.name}
                                        >
                                            <option value="">Select...</option>
                                            {inputDef.dropdownOptions?.map((opt) => (
                                                <option key={opt.id} value={opt.value}>
                                                    {opt.label} — ₹{opt.rate}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {inputDef.type === 'fixed' && (
                                        <span className="text-base text-black font-mono block text-right">
                                            ₹{inputDef.fixedValue || '0'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Formula results */}
                    {result && sortedFormulas.length > 0 && (
                        <>
                            {regularFormulas.length > 0 && (
                                <div className="border-t border-black/5">
                                    <div className="px-4 py-2 text-sm font-semibold text-black/50 bg-black/[0.02] flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-black/30" />
                                        Calculations
                                    </div>
                                    {regularFormulas.map((formula) => (
                                        <div
                                            key={formula.id}
                                            className="px-4 py-2.5 flex items-center justify-between border-t border-black/5"
                                        >
                                            <span className="text-base text-black/70">
                                                {formula.label}
                                            </span>
                                            <span className="text-base font-mono font-semibold text-black">
                                                ₹{result.formulaResults[formula.key] || '0'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Subtotal + Profit + GST breakdown */}
                            {grandTotalFormula && (
                                <div className="border-t border-black/8 bg-gradient-to-r from-black/[0.02] to-transparent">
                                    {/* Subtotal */}
                                    <div className="px-4 py-2 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-black/50">
                                            {grandTotalFormula.label}
                                        </span>
                                        <span className="text-sm font-mono font-semibold text-black/60">
                                            ₹{result.subtotal.toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Profit line */}
                                    {profitPct > 0 && (
                                        <div className="px-4 py-1 flex items-center justify-between text-black/40">
                                            <span className="text-xs">
                                                + Profit ({profitPct}%)
                                            </span>
                                            <span className="text-xs font-mono font-medium">
                                                ₹{result.profitAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}

                                    {/* GST line */}
                                    {gstPct > 0 && (
                                        <div className="px-4 py-1 flex items-center justify-between text-black/40">
                                            <span className="text-xs">
                                                + GST ({gstPct}%)
                                            </span>
                                            <span className="text-xs font-mono font-medium">
                                                ₹{result.gstAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Section total */}
                                    {(profitPct > 0 || gstPct > 0) && (
                                        <div className="px-4 py-2 flex items-center justify-between border-t border-black/5">
                                            <span className="text-sm font-bold text-black/70">
                                                {calc.name} Total
                                            </span>
                                            <span className="text-sm font-mono font-bold text-black">
                                                ₹{result.finalAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
