import { useState, useMemo, useCallback } from 'react';
import {
    Calculator,
    ChevronRight,
    FolderOpen,
    ArrowLeft,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { UserTempItem, RefTreeNode } from '../../types/calculator';

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
    const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [selectedDropdowns, setSelectedDropdowns] = useState<Record<string, string>>({});
    const [userTempItems, setUserTempItems] = useState<UserTempItem[]>([]);
    const [showTempList, setShowTempList] = useState(false);
    const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
    const [refTreePath, setRefTreePath] = useState<string[]>([]);

    // Navigation
    const children = getCategoryChildren(currentCategoryId);
    const breadcrumb = currentCategoryId ? getCategoryBreadcrumb(currentCategoryId) : [];

    // Get ALL calculators for this category (not just first)
    const categoryCalcs = currentCategoryId ? getCalculatorsForCategory(currentCategoryId) : [];
    const currentCalc = selectedCalcId
        ? categoryCalcs.find((c) => c.id === selectedCalcId)
        : categoryCalcs.length > 0
            ? categoryCalcs[0]
            : undefined;

    // Get inputs used by this calculator
    const usedInputDefs = useMemo(() => {
        if (!currentCalc) return [];
        return inputDefinitions
            .filter((i) => currentCalc.usedInputIds.includes(i.id))
            .sort((a, b) => a.order - b.order);
    }, [currentCalc, inputDefinitions]);

    // Calculation
    const result = useMemo(() => {
        if (!currentCalc) return null;
        return calculateResult(currentCalc, inputs, selectedDropdowns, userTempItems);
    }, [currentCalc, inputs, selectedDropdowns, userTempItems, calculateResult]);

    const navigateTo = useCallback((id: string | null) => {
        setCurrentCategoryId(id);
        setSelectedCalcId(null);
        setInputs({});
        setSelectedDropdowns({});
        setUserTempItems([]);
        setShowTempList(false);
        setFocusedInputId(null);
        setRefTreePath([]);
    }, []);

    const switchCalculator = useCallback((calcId: string) => {
        setSelectedCalcId(calcId);
        setInputs({});
        setSelectedDropdowns({});
        setUserTempItems([]);
        setShowTempList(false);
        setFocusedInputId(null);
        setRefTreePath([]);
    }, []);

    const addUserTempItem = () => {
        setUserTempItems((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: '', rate: '' },
        ]);
    };

    const removeUserTempItem = (id: string) => {
        setUserTempItems((prev) => prev.filter((t) => t.id !== id));
    };

    const updateUserTempItem = (id: string, updates: Partial<UserTempItem>) => {
        setUserTempItems((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        );
    };

    // Get focused input definition for reference sidebar
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
                    {(!currentCalc || children.length > 0) && (
                        <>
                            {currentCategoryId && !currentCalc && (
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

                    {/* Calculator form */}
                    {categoryCalcs.length > 0 && (
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

                            {/* Calculator Tabs — shown when multiple calculators exist */}
                            {categoryCalcs.length > 1 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {categoryCalcs.map((calc) => {
                                        const isActive = currentCalc?.id === calc.id;
                                        return (
                                            <button
                                                key={calc.id}
                                                onClick={() => switchCalculator(calc.id)}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 border ${isActive
                                                    ? 'bg-black text-white border-black shadow-lg shadow-black/15'
                                                    : 'bg-white/80 text-black/60 border-black/8 hover:border-black/15 hover:text-black hover:shadow-sm'
                                                    }`}
                                            >
                                                <Calculator className="w-3.5 h-3.5" />
                                                {calc.name}
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive
                                                    ? 'bg-white/20 text-white/80'
                                                    : 'bg-black/5 text-black/30'
                                                    }`}>
                                                    {calc.formulas.length}f
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Selected calculator's form */}
                            {currentCalc && (
                                <div className="glass rounded-2xl overflow-hidden">
                                    <div className="border-b border-black/5 px-4 py-3 bg-black/[0.02]">
                                        <h2 className="text-base font-semibold text-black">{currentCalc.name}</h2>
                                    </div>

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
                                                            onChange={(e) =>
                                                                setInputs((prev) => ({
                                                                    ...prev,
                                                                    [inputDef.key]: e.target.value,
                                                                }))
                                                            }
                                                            placeholder="0"
                                                            className={`w-full rounded-md bg-white border px-3 py-1.5 text-base text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 text-right transition-colors ${focusedInputId === inputDef.id
                                                                ? 'border-black/30 ring-black/20'
                                                                : 'border-black/10 focus:ring-black/10'
                                                                }`}
                                                            onFocus={() => {
                                                                setFocusedInputId(inputDef.id);
                                                                setRefTreePath([]);
                                                                if (
                                                                    inputDef.referenceItems?.length ||
                                                                    inputDef.refTree
                                                                ) {
                                                                    setShowTempList(true);
                                                                }
                                                            }}
                                                        />
                                                    )}

                                                    {inputDef.type === 'dropdown' && (
                                                        <select
                                                            value={selectedDropdowns[inputDef.key] || ''}
                                                            onChange={(e) =>
                                                                setSelectedDropdowns((prev) => ({
                                                                    ...prev,
                                                                    [inputDef.key]: e.target.value,
                                                                }))
                                                            }
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

                                    {result && currentCalc.formulas.length > 0 && (() => {
                                        const sortedFormulas = [...currentCalc.formulas].sort((a, b) => a.order - b.order);
                                        const grandTotal = sortedFormulas.find((f) => f.isTotal);
                                        const regularFormulas = sortedFormulas.filter((f) => !f.isTotal);

                                        return (
                                            <>
                                                {/* Regular formula results */}
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

                                                {/* Grand Total — prominent section with profit */}
                                                {grandTotal && (() => {
                                                    const baseValue = parseFloat(result.formulaResults[grandTotal.key] || '0');
                                                    const profitPct = parseFloat(currentCalc.profitPercent || '0') || 0;
                                                    const profitAmount = baseValue * (profitPct / 100);
                                                    const finalTotal = baseValue + profitAmount;

                                                    return (
                                                        <div className="border-t-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/30">
                                                            {/* Base total */}
                                                            <div className="px-5 pt-3 pb-1 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-emerald-500 text-lg">🏆</span>
                                                                    <span className="text-sm font-semibold text-emerald-700">
                                                                        {grandTotal.label}
                                                                    </span>
                                                                </div>
                                                                <span className="text-sm font-mono font-semibold text-emerald-600">
                                                                    ₹{baseValue.toFixed(2)}
                                                                </span>
                                                            </div>

                                                            {/* Profit line */}
                                                            {profitPct > 0 && (
                                                                <div className="px-5 py-1 flex items-center justify-between text-emerald-500">
                                                                    <span className="text-xs">
                                                                        + Profit ({profitPct}%)
                                                                    </span>
                                                                    <span className="text-xs font-mono font-medium">
                                                                        ₹{profitAmount.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Final total */}
                                                            <div className="px-5 pt-1 pb-3 flex items-center justify-between border-t border-emerald-200/50 mt-1">
                                                                <span className="text-lg font-bold text-emerald-800">
                                                                    Grand Total
                                                                </span>
                                                                <span className="text-xl font-mono font-bold text-emerald-700">
                                                                    ₹{finalTotal.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        );
                                    })()}

                                    {/* User temp items */}
                                    {userTempItems.length > 0 && (
                                        <div className="border-t border-black/5">
                                            <div className="px-4 py-2 text-sm text-black/50 bg-black/[0.01]">
                                                Additional Items
                                            </div>
                                            {userTempItems.map((item) => (
                                                <div key={item.id} className="px-4 py-2 flex items-center gap-3 border-t border-black/5">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateUserTempItem(item.id, { name: e.target.value })}
                                                        placeholder="Item name..."
                                                        className="flex-1 rounded bg-white border border-black/10 px-2 py-1 text-sm text-black placeholder:text-black/30 outline-none"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.rate}
                                                        onChange={(e) => updateUserTempItem(item.id, { rate: e.target.value })}
                                                        placeholder="₹ Rate"
                                                        className="w-24 rounded bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none text-right"
                                                    />
                                                    <button
                                                        onClick={() => removeUserTempItem(item.id)}
                                                        className="p-1 rounded text-black/20 hover:text-red-500 transition-colors"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Total + actions */}
                                    <div className="border-t border-black/5 px-4 py-4 bg-black/[0.01] flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={addUserTempItem}
                                                className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black border border-black/10 px-3 py-1.5 rounded-xl hover:bg-black/[0.04] transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add Item
                                            </button>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-sm text-black/50 block">Grand Total</span>
                                            <span className="text-xl font-bold text-black font-mono">
                                                ₹{(() => {
                                                    const grandTotalFormula = currentCalc.formulas.find((f) => f.isTotal);
                                                    if (grandTotalFormula && result) {
                                                        const base = parseFloat(result.formulaResults[grandTotalFormula.key] || '0');
                                                        const pct = parseFloat(currentCalc.profitPercent || '0') || 0;
                                                        return (base + base * (pct / 100)).toFixed(2);
                                                    }
                                                    return result?.total || '0';
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Reference sidebar */}
                {showTempList && focusedInputDef && (() => {
                    const refItems = focusedInputDef.referenceItems || [];
                    const refTree = focusedInputDef.refTree;
                    const hasAnything = refItems.length > 0 || refTree;

                    if (!hasAnything) return null;

                    // Tree navigation
                    let treeCurrentNodes: RefTreeNode[] = [];
                    let treeCurrentLevel = '';
                    let treeBreadcrumb: { id: string; name: string }[] = [];
                    if (refTree) {
                        let nodes = refTree.nodes;
                        for (let i = 0; i < refTreePath.length; i++) {
                            const found = nodes.find((n) => n.id === refTreePath[i]);
                            if (found) {
                                treeBreadcrumb.push({ id: found.id, name: found.name || '...' });
                                nodes = found.children || [];
                            } else break;
                        }
                        treeCurrentNodes = nodes;
                        treeCurrentLevel = refTree.levels[refTreePath.length] || 'Rate';
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
                                            setShowTempList(false);
                                            setFocusedInputId(null);
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
                                                                setInputs((prev) => ({
                                                                    ...prev,
                                                                    [focusedInputDef.key]: node.rate!,
                                                                }));
                                                            } else if (!isLeaf) {
                                                                setRefTreePath([...refTreePath, node.id]);
                                                            }
                                                        }}
                                                        disabled={isLeaf && !hasRate}
                                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${isLeaf && hasRate && inputs[focusedInputDef.key] === node.rate
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
                                                        setInputs((prev) => ({
                                                            ...prev,
                                                            [focusedInputDef.key]: item.value,
                                                        }));
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${inputs[focusedInputDef.key] === item.value
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
