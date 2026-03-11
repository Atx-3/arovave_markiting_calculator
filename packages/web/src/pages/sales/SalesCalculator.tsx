import { useState, useMemo, useCallback } from 'react';
import {
    Calculator,
    ChevronRight,
    FolderOpen,
    ArrowLeft,
    X,
    ChevronDown,
    ChevronUp,
    Plus,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { RefTreeNode, Calculator as CalcType, InputDefinition } from '../../types/calculator';

// ═══════════════════════════════════════════════════════════════════════
// SALES CALCULATOR — Single-calc-per-category + Additional Charges
// ═══════════════════════════════════════════════════════════════════════

export function SalesCalculator() {
    const store = useAppStore();
    const {
        categories,
        inputDefinitions,
        getCategoryChildren,
        getCategoryBreadcrumb,
        getCalculatorForCategory,
        getChargesForCalculator,
        calculateResult,
    } = store;

    const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
    // Main calculator input state
    const [mainInputs, setMainInputs] = useState<Record<string, string>>({});
    const [mainDropdowns, setMainDropdowns] = useState<Record<string, string>>({});
    // Per-charge input state
    const [chargeInputs, setChargeInputs] = useState<Record<string, Record<string, string>>>({});
    const [chargeDropdowns, setChargeDropdowns] = useState<Record<string, Record<string, string>>>({});
    // Which charges are active (user clicked the + button)
    const [activeChargeIds, setActiveChargeIds] = useState<string[]>([]);
    // Collapse state for charges
    const [collapsedCharges, setCollapsedCharges] = useState<Record<string, boolean>>({});
    // Reference sidebar
    const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
    const [focusedSourceId, setFocusedSourceId] = useState<string | null>(null); // calc or charge id
    const [refTreePath, setRefTreePath] = useState<string[]>([]);

    // Navigation
    const children = getCategoryChildren(currentCategoryId);
    const breadcrumb = currentCategoryId ? getCategoryBreadcrumb(currentCategoryId) : [];
    const rootCategories = categories
        .filter((c) => c.parentId === null)
        .sort((a, b) => a.order - b.order);

    // Current calculator (single per category)
    const currentCalc = currentCategoryId ? getCalculatorForCategory(currentCategoryId) : undefined;
    // Charges linked to this calculator
    const charges = currentCalc ? getChargesForCalculator(currentCalc.id) : [];

    const navigateTo = useCallback((id: string | null) => {
        setCurrentCategoryId(id);
        setMainInputs({});
        setMainDropdowns({});
        setChargeInputs({});
        setChargeDropdowns({});
        setActiveChargeIds([]);
        setCollapsedCharges({});
        setFocusedInputId(null);
        setFocusedSourceId(null);
        setRefTreePath([]);
    }, []);

    const setChargeInput = useCallback((chargeId: string, key: string, value: string) => {
        setChargeInputs((prev) => ({
            ...prev,
            [chargeId]: { ...(prev[chargeId] || {}), [key]: value },
        }));
    }, []);

    const setChargeDropdown = useCallback((chargeId: string, key: string, value: string) => {
        setChargeDropdowns((prev) => ({
            ...prev,
            [chargeId]: { ...(prev[chargeId] || {}), [key]: value },
        }));
    }, []);

    // ── Compute results ──

    // Main calculator result
    const mainResult = useMemo(() => {
        if (!currentCalc) return null;
        const result = calculateResult(currentCalc, mainInputs, mainDropdowns, []);
        const grandTotalFormula = currentCalc.formulas.find((f) => f.isTotal);
        const subtotal = grandTotalFormula
            ? parseFloat(result.formulaResults[grandTotalFormula.key] || '0')
            : parseFloat(result.total || '0');

        const profitPct = parseFloat(currentCalc.profitPercent || '0') || 0;
        const profitAmount = subtotal * (profitPct / 100);
        const afterProfit = subtotal + profitAmount;
        const gstPct = parseFloat(currentCalc.gstPercent || '0') || 0;
        const gstAmount = afterProfit * (gstPct / 100);
        const finalAmount = afterProfit + gstAmount;

        return { ...result, subtotal, profitAmount, afterProfit, gstAmount, finalAmount };
    }, [currentCalc, mainInputs, mainDropdowns, calculateResult]);

    // Active charges (only compute results for activated ones)
    const activeCharges = charges.filter((c) => activeChargeIds.includes(c.id));
    const inactiveCharges = charges.filter((c) => !activeChargeIds.includes(c.id));

    // Per-charge results
    const chargeResults = useMemo(() => {
        const results: Record<string, { formulaResults: Record<string, string>; total: string; subtotal: number; profitAmount: number; afterProfit: number; gstAmount: number; finalAmount: number }> = {};
        for (const charge of activeCharges) {
            const inputs = chargeInputs[charge.id] || {};
            const dropdowns = chargeDropdowns[charge.id] || {};
            const result = calculateResult(charge, inputs, dropdowns, []);

            const grandTotalFormula = charge.formulas.find((f) => f.isTotal);
            const subtotal = grandTotalFormula
                ? parseFloat(result.formulaResults[grandTotalFormula.key] || '0')
                : parseFloat(result.total || '0');

            const profitPct = parseFloat(charge.profitPercent || '0') || 0;
            const profitAmount = subtotal * (profitPct / 100);
            const afterProfit = subtotal + profitAmount;
            const gstPct = parseFloat(charge.gstPercent || '0') || 0;
            const gstAmount = afterProfit * (gstPct / 100);
            const finalAmount = afterProfit + gstAmount;

            results[charge.id] = { ...result, subtotal, profitAmount, afterProfit, gstAmount, finalAmount };
        }
        return results;
    }, [activeCharges, chargeInputs, chargeDropdowns, calculateResult]);

    // Grand total = main + all charges
    const grandTotal = useMemo(() => {
        let total = mainResult?.finalAmount || 0;
        for (const r of Object.values(chargeResults)) {
            total += r.finalAmount;
        }
        return total;
    }, [mainResult, chargeResults]);

    // Reference sidebar
    const focusedInputDef = focusedInputId
        ? inputDefinitions.find((i) => i.id === focusedInputId)
        : null;

    // Which categories to show at current level
    const displayChildren = currentCategoryId ? children : rootCategories;

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
                    {/* Back button */}
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

                    {/* Category browser — show when there are subcategories */}
                    {displayChildren.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {displayChildren.map((cat) => {
                                const calcs = store.getCalculatorsForCategory(cat.id);
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

                    {/* Empty state */}
                    {displayChildren.length === 0 && !currentCalc && (
                        <div className="glass rounded-2xl p-10 text-center">
                            <Calculator className="w-12 h-12 text-black/20 mx-auto mb-3" />
                            <p className="text-black/40 text-base">
                                {currentCategoryId
                                    ? 'No calculator set up for this category yet.'
                                    : 'No categories yet. Ask your admin to create product categories.'}
                            </p>
                        </div>
                    )}

                    {/* ═══ MAIN CALCULATOR ═══ */}
                    {currentCalc && displayChildren.length === 0 && (
                        <div className="space-y-4">
                            {/* Main calculator section */}
                            <CalcSection
                                calc={currentCalc}
                                label={currentCalc.name}
                                isMain={true}
                                isCollapsed={false}
                                inputs={mainInputs}
                                dropdowns={mainDropdowns}
                                result={mainResult}
                                inputDefinitions={inputDefinitions}
                                onSetInput={(key, val) => setMainInputs((prev) => ({ ...prev, [key]: val }))}
                                onSetDropdown={(key, val) => setMainDropdowns((prev) => ({ ...prev, [key]: val }))}
                                onFocusInput={(inputId) => {
                                    setFocusedInputId(inputId);
                                    setFocusedSourceId(currentCalc.id);
                                    setRefTreePath([]);
                                }}
                                focusedInputId={focusedSourceId === currentCalc.id ? focusedInputId : null}
                            />

                            {/* ═══ ACTIVE CHARGES (expanded) ═══ */}
                            {activeCharges.map((charge) => {
                                const isCollapsed = collapsedCharges[charge.id] || false;
                                const result = chargeResults[charge.id];

                                return (
                                    <CalcSection
                                        key={charge.id}
                                        calc={charge}
                                        label={charge.name}
                                        isMain={false}
                                        isCollapsed={isCollapsed}
                                        inputs={chargeInputs[charge.id] || {}}
                                        dropdowns={chargeDropdowns[charge.id] || {}}
                                        result={result}
                                        inputDefinitions={inputDefinitions}
                                        onSetInput={(key, val) => setChargeInput(charge.id, key, val)}
                                        onSetDropdown={(key, val) => setChargeDropdown(charge.id, key, val)}
                                        onToggleCollapse={() => setCollapsedCharges((prev) => ({ ...prev, [charge.id]: !prev[charge.id] }))}
                                        onRemove={() => setActiveChargeIds((prev) => prev.filter((id) => id !== charge.id))}
                                        onFocusInput={(inputId) => {
                                            setFocusedInputId(inputId);
                                            setFocusedSourceId(charge.id);
                                            setRefTreePath([]);
                                        }}
                                        focusedInputId={focusedSourceId === charge.id ? focusedInputId : null}
                                    />
                                );
                            })}

                            {/* ═══ INACTIVE CHARGES (+ buttons) ═══ */}
                            {inactiveCharges.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {inactiveCharges.map((charge) => (
                                        <button
                                            key={charge.id}
                                            onClick={() => setActiveChargeIds((prev) => [...prev, charge.id])}
                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-black/15 hover:border-blue-300 hover:bg-blue-50/40 text-black/40 hover:text-blue-600 transition-all group"
                                        >
                                            <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-semibold">{charge.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* ═══ GRAND TOTAL ═══ */}
                            <div className="rounded-2xl overflow-hidden border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/30">
                                {/* Per-section subtotals when there are active charges */}
                                {activeCharges.length > 0 && (
                                    <div className="px-5 pt-4 pb-2 space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-emerald-700/70">{currentCalc.name}</span>
                                            <span className="font-mono font-semibold text-emerald-600">
                                                ₹{mainResult ? mainResult.finalAmount.toFixed(2) : '0.00'}
                                            </span>
                                        </div>
                                        {activeCharges.map((charge) => (
                                            <div key={charge.id} className="flex items-center justify-between text-sm">
                                                <span className="text-emerald-700/70">{charge.name}</span>
                                                <span className="font-mono font-semibold text-emerald-600">
                                                    ₹{chargeResults[charge.id] ? chargeResults[charge.id].finalAmount.toFixed(2) : '0.00'}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="border-t border-emerald-200/60 my-1" />
                                    </div>
                                )}

                                {/* Grand Total */}
                                <div className={`px-5 ${activeCharges.length > 0 ? 'pt-1 pb-4' : 'py-4'} flex items-center justify-between`}>
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
                        </div>
                    )}
                </div>

                {/* Reference sidebar */}
                {focusedInputDef && focusedSourceId && (() => {
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

                    // Determine which input state to read/write
                    const isMainCalc = focusedSourceId === currentCalc?.id;
                    const currentInputs = isMainCalc ? mainInputs : (chargeInputs[focusedSourceId] || {});
                    const handleSelectValue = (val: string) => {
                        if (isMainCalc) {
                            setMainInputs((prev) => ({ ...prev, [focusedInputDef.key]: val }));
                        } else {
                            setChargeInput(focusedSourceId, focusedInputDef.key, val);
                        }
                    };

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
                                            setFocusedSourceId(null);
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
                                                            if (isLeaf && hasRate) {
                                                                handleSelectValue(node.rate!);
                                                            } else if (!isLeaf) {
                                                                setRefTreePath([...refTreePath, node.id]);
                                                            }
                                                        }}
                                                        disabled={isLeaf && !hasRate}
                                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${isLeaf && hasRate && currentInputs[focusedInputDef.key] === node.rate
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
                                                    onClick={() => handleSelectValue(item.value)}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${currentInputs[focusedInputDef.key] === item.value
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
// CALCULATOR SECTION — Renders inputs + formulas + breakdown for one calc/charge
// ═══════════════════════════════════════════════════════════════════════

function CalcSection({
    calc,
    label,
    isMain,
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
    label: string;
    isMain: boolean;
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
    } | null;
    inputDefinitions: InputDefinition[];
    onSetInput: (key: string, val: string) => void;
    onSetDropdown: (key: string, val: string) => void;
    onToggleCollapse?: () => void;
    onRemove?: () => void;
    onFocusInput: (id: string) => void;
    focusedInputId: string | null;
}) {
    const usedInputDefs = inputDefinitions
        .filter((i) => calc.usedInputIds.includes(i.id))
        .sort((a, b) => a.order - b.order);

    const sortedFormulas = [...calc.formulas].sort((a, b) => a.order - b.order);
    const grandTotalFormula = sortedFormulas.find((f) => f.isTotal);
    const regularFormulas = sortedFormulas.filter((f) => !f.isTotal && !f.hidden);
    const profitPct = parseFloat(calc.profitPercent || '0') || 0;
    const gstPct = parseFloat(calc.gstPercent || '0') || 0;

    // Filter hidden inputs from display (but their values still participate in calculations)
    const visibleInputDefs = usedInputDefs.filter((i) => !i.hidden);

    return (
        <div className="glass rounded-2xl overflow-hidden">
            {/* Section Header */}
            <div
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMain
                    ? 'bg-black/[0.02]'
                    : 'bg-blue-50/50 cursor-pointer'
                    }`}
                onClick={!isMain ? onToggleCollapse : undefined}
            >
                <div className={`p-1.5 rounded-lg border ${isMain
                    ? 'bg-black/5 border-black/10 text-black/60'
                    : 'bg-blue-50 border-blue-200 text-blue-600'
                    }`}>
                    <Calculator className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-base font-semibold text-black flex-1">{label}</h2>

                {/* Subtotal badge for charges */}
                {!isMain && result && (
                    <span className="text-sm font-mono font-semibold text-black/60">
                        ₹{result.finalAmount.toFixed(2)}
                    </span>
                )}

                {!isMain && (
                    <>
                        {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-black/20" />
                        ) : (
                            <ChevronUp className="w-4 h-4 text-black/20" />
                        )}
                        {onRemove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                className="p-1 rounded-lg text-black/20 hover:text-red-500 transition-colors"
                                title="Remove charge"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Section Content */}
            {!isCollapsed && (
                <div className="animate-slide-up">
                    {/* Input fields — only visible ones */}
                    <div className="divide-y divide-black/5">
                        {visibleInputDefs.map((inputDef) => (
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

                                    {/* Section total (only show when profit or GST is set) */}
                                    {(profitPct > 0 || gstPct > 0) && (
                                        <div className="px-4 py-2 flex items-center justify-between border-t border-black/5">
                                            <span className="text-sm font-bold text-black/70">
                                                {label} Total
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
