import { useState, useMemo, useCallback } from 'react';
import {
    Calculator,
    ChevronRight,
    FolderOpen,
    ArrowLeft,
    Plus,
    Trash2,
    ListChecks,
    List,
    X,
    FolderTree,
    ChevronLeft,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { UserTempItem, RefTreeNode } from '../../types/calculator';

export function SalesCalculator() {
    const {
        categories,
        getCategoryChildren,
        getCategoryBreadcrumb,
        getCalculatorForCategory,
        calculateResult,
    } = useAppStore();

    const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [selectedDropdowns, setSelectedDropdowns] = useState<Record<string, string>>({});
    const [userTempItems, setUserTempItems] = useState<UserTempItem[]>([]);
    const [showTempList, setShowTempList] = useState(false);
    const [openRefList, setOpenRefList] = useState<string | null>(null);
    const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
    const [refTreePath, setRefTreePath] = useState<string[]>([]); // array of selected node IDs for tree drill-down

    // Navigation
    const children = getCategoryChildren(currentCategoryId);
    const breadcrumb = currentCategoryId ? getCategoryBreadcrumb(currentCategoryId) : [];
    const currentCalc = currentCategoryId ? getCalculatorForCategory(currentCategoryId) : undefined;

    // Per-calculator temp items (from admin)
    const adminTempItems = currentCalc?.tempItems || [];

    // Calculation
    const result = useMemo(() => {
        if (!currentCalc) return null;
        return calculateResult(currentCalc, inputs, selectedDropdowns, userTempItems);
    }, [currentCalc, inputs, selectedDropdowns, userTempItems, calculateResult]);

    const navigateTo = useCallback((id: string | null) => {
        setCurrentCategoryId(id);
        setInputs({});
        setSelectedDropdowns({});
        setUserTempItems([]);
        setShowTempList(false);
    }, []);

    const addUserTempItem = () => {
        setUserTempItems((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: '', rate: '' },
        ]);
    };

    const addFromReferenceList = (name: string, rate: string) => {
        setUserTempItems((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name, rate },
        ]);
    };

    const removeUserTempItem = (id: string) => {
        setUserTempItems((prev) => prev.filter((t) => t.id !== id));
    };

    const updateUserTempItem = (id: string, updates: Partial<UserTempItem>) => {
        setUserTempItems((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-black flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-black" />
                    Pricing Calculator
                </h1>
                <p className="mt-1 text-base text-black">
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
                            <ChevronRight className="w-3 h-3 text-black" />
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
                    {/* Category browser — show children if no calculator at this level or always show children */}
                    {(!currentCalc || children.length > 0) && (
                        <>
                            {currentCategoryId && !currentCalc && (
                                <button
                                    onClick={() => {
                                        const current = categories.find((c) => c.id === currentCategoryId);
                                        navigateTo(current?.parentId || null);
                                    }}
                                    className="flex items-center gap-1.5 text-sm text-black hover:text-black transition-colors"
                                >
                                    <ArrowLeft className="w-3 h-3" />
                                    Back
                                </button>
                            )}

                            {children.length === 0 && !currentCategoryId && categories.length === 0 && (
                                <div className="glass rounded-2xl p-10 text-center">
                                    <Calculator className="w-12 h-12 text-black mx-auto mb-3" />
                                    <p className="text-black text-base">
                                        No categories yet. Ask your admin to create product categories.
                                    </p>
                                </div>
                            )}

                            {children.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {children.map((cat) => {
                                        const hasCalc = !!getCalculatorForCategory(cat.id);
                                        const subChildren = getCategoryChildren(cat.id);

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setCurrentCategoryId(cat.id);
                                                    setInputs({});
                                                    setSelectedDropdowns({});
                                                    setUserTempItems([]);
                                                    setShowTempList(false);
                                                }}
                                                className="glass rounded-2xl p-4 text-left hover:border-black/15 border border-surface-border transition-all duration-200 group"
                                            >
                                                {hasCalc ? (
                                                    <Calculator className="w-6 h-6 text-black mb-2 group-hover:scale-110 transition-transform" />
                                                ) : (
                                                    <FolderOpen className="w-6 h-6 text-black/50 mb-2 group-hover:scale-110 transition-transform" />
                                                )}
                                                <span className="text-base font-semibold text-black block">{cat.name}</span>
                                                <span className="text-[11px] text-black mt-0.5 block">
                                                    {hasCalc ? 'Calculator' : `${subChildren.length} sub-categories`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Calculator form */}
                    {currentCalc && (
                        <div className="space-y-4">
                            <button
                                onClick={() => {
                                    const current = categories.find((c) => c.id === currentCategoryId);
                                    navigateTo(current?.parentId || null);
                                }}
                                className="flex items-center gap-1.5 text-sm text-black hover:text-black transition-colors"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                Back to categories
                            </button>

                            {/* Form rows */}
                            <div className="glass rounded-2xl overflow-hidden">
                                <div className="border-b border-surface-border px-4 py-3 bg-black/[0.02]">
                                    <h2 className="text-base font-semibold text-black">{currentCalc.name}</h2>
                                </div>

                                <div className="divide-y divide-surface-border">
                                    {currentCalc.rows.map((row) => {
                                        if (!row.key || !row.label) return null;
                                        const computedValue = result?.rowResults[row.key];

                                        return (
                                            <div
                                                key={row.id}
                                                className={`px-4 py-3 flex items-center justify-between gap-4 ${row.isTotal ? 'bg-accent-emerald/5' : ''
                                                    }`}
                                            >
                                                <label className={`text-base shrink-0 ${row.isTotal ? 'font-bold text-black' : 'text-black'}`}>
                                                    {row.label}
                                                </label>

                                                <div className="w-48 shrink-0">
                                                    {row.type === 'input' && (
                                                        <input
                                                            type="text"
                                                            value={inputs[row.key] || ''}
                                                            onChange={(e) =>
                                                                setInputs((prev) => ({ ...prev, [row.key]: e.target.value }))
                                                            }
                                                            placeholder="0"
                                                            className={`w-full rounded-md bg-white border px-3 py-1.5 text-base text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 text-right transition-colors ${focusedRowId === row.id
                                                                ? 'border-black/30 ring-black/20'
                                                                : 'border-black/10 focus:ring-black/10'
                                                                }`}
                                                            onFocus={() => {
                                                                setFocusedRowId(row.id);
                                                                setRefTreePath([]);
                                                                setShowTempList(true);
                                                            }}
                                                        />
                                                    )}

                                                    {row.type === 'dropdown' && (
                                                        <select
                                                            value={selectedDropdowns[row.key] || ''}
                                                            onChange={(e) =>
                                                                setSelectedDropdowns((prev) => ({
                                                                    ...prev,
                                                                    [row.key]: e.target.value,
                                                                }))
                                                            }
                                                            className="w-full rounded-md bg-white border border-black/10 px-3 py-1.5 text-base text-black outline-none focus:ring-1 focus:ring-black/10"
                                                            title={row.label}
                                                        >
                                                            <option value="">Select...</option>
                                                            {row.dropdownOptions?.map((opt) => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label} — ₹{opt.rate}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {row.type === 'fixed' && (
                                                        <span className="text-base text-black font-mono block text-right">
                                                            ₹{row.fixedValue || '0'}
                                                        </span>
                                                    )}

                                                    {row.type === 'calculated' && (
                                                        <span
                                                            className={`text-base font-mono block text-right font-semibold ${row.isTotal ? 'text-black text-lg' : 'text-black'
                                                                }`}
                                                        >
                                                            ₹{computedValue || '0'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Cost Block Breakdown */}
                                {result?.blockResults && result.blockResults.length > 0 && (
                                    <div className="border-t border-surface-border">
                                        <div className="px-4 py-2 text-sm font-semibold text-black bg-black/[0.02] flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-black/30" />
                                            Cost Breakdown
                                        </div>
                                        {result.blockResults.map((block) => (
                                            <div
                                                key={block.blockKey}
                                                className="px-4 py-2.5 flex items-center justify-between border-t border-surface-border/50"
                                            >
                                                <span className="text-base text-black">
                                                    {block.label}
                                                </span>
                                                <span className="text-base font-mono font-semibold text-black">
                                                    ₹{block.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* User temp items */}
                                {userTempItems.length > 0 && (
                                    <div className="border-t border-surface-border">
                                        <div className="px-4 py-2 text-sm text-black bg-black/[0.01]">
                                            Additional Items
                                        </div>
                                        {userTempItems.map((item) => (
                                            <div key={item.id} className="px-4 py-2 flex items-center gap-3 border-t border-surface-border/50">
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
                                                    className="p-1 rounded text-black hover:text-black transition-colors"
                                                    title="Remove item"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Total + actions */}
                                <div className="border-t border-surface-border px-4 py-4 bg-black/[0.01] flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={addUserTempItem}
                                            className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black border border-black/10 px-3 py-1.5 rounded-xl hover:bg-black/[0.04] transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Item
                                        </button>
                                        {adminTempItems.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    setFocusedRowId(null);
                                                    setShowTempList(!showTempList);
                                                }}
                                                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition-colors ${showTempList
                                                    ? 'text-black border-accent-cyan/20 bg-accent-cyan/5'
                                                    : 'text-black border-surface-border hover:text-black'
                                                    }`}
                                            >
                                                <ListChecks className="w-3 h-3" />
                                                Reference List ({adminTempItems.length})
                                            </button>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm text-black block">Grand Total</span>
                                        <span className="text-xl font-bold text-black font-mono">
                                            ₹{result?.total || '0'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Reference sidebar — shows focused input's references or all items */}
                {showTempList && currentCalc && (() => {
                    // Find the focused row and its specific references
                    const focusedRow = focusedRowId ? currentCalc.rows.find((r) => r.id === focusedRowId) : null;
                    const focusedLinkedTemp = focusedRowId ? adminTempItems.find((t) => t.autoFromRowId === focusedRowId && t.rate) : null;
                    const focusedRefItems = focusedRow?.referenceItems || [];
                    const hasFocusedRefs = !!focusedLinkedTemp || focusedRefItems.length > 0;
                    const focusedRefTree = focusedRow?.refTree;

                    // Determine if there's anything to show
                    const hasAnything = adminTempItems.length > 0 || focusedRefTree;
                    if (!hasAnything) return null;

                    // Tree navigation: resolve current level nodes
                    let treeCurrentNodes: RefTreeNode[] = [];
                    let treeCurrentLevel = '';
                    let treeBreadcrumb: { id: string; name: string }[] = [];
                    if (focusedRefTree) {
                        let nodes = focusedRefTree.nodes;
                        for (let i = 0; i < refTreePath.length; i++) {
                            const found = nodes.find((n) => n.id === refTreePath[i]);
                            if (found) {
                                treeBreadcrumb.push({ id: found.id, name: found.name || '...' });
                                nodes = found.children || [];
                            } else {
                                break;
                            }
                        }
                        treeCurrentNodes = nodes;
                        treeCurrentLevel = focusedRefTree.levels[refTreePath.length] || 'Rate';
                    }
                    const isTreeLeaf = focusedRefTree && refTreePath.length >= focusedRefTree.levels.length;

                    return (
                        <div className="w-64 shrink-0">
                            <div className="glass rounded-2xl p-4 space-y-3 sticky top-20">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-black">
                                        {focusedRow ? `${focusedRow.label} — Reference` : 'Reference Items'}
                                    </h3>
                                    <button
                                        onClick={() => { setShowTempList(false); setFocusedRowId(null); setRefTreePath([]); }}
                                        className="p-1 rounded text-black hover:text-black transition-colors"
                                        title="Close"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Tree navigation — when focused row has a refTree */}
                                {focusedRow && focusedRefTree && (
                                    <div className="space-y-2">
                                        {/* Breadcrumb */}
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

                                        {/* Back button + level title */}
                                        <div className="flex items-center gap-2">
                                            {refTreePath.length > 0 && (
                                                <button
                                                    onClick={() => setRefTreePath(refTreePath.slice(0, -1))}
                                                    className="p-1 rounded text-black/30 hover:text-black hover:bg-black/5 transition-colors"
                                                    title="Go back"
                                                >
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <FolderTree className="w-3.5 h-3.5 text-black/30" />
                                                <span className="text-xs text-black/50 font-medium">
                                                    {isTreeLeaf ? 'Select rate' : `Choose ${treeCurrentLevel}`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Options at current level */}
                                        <div className="space-y-1">
                                            {treeCurrentNodes.map((node) => {
                                                const isLeaf = !node.children || node.children.length === 0;
                                                const hasRate = !!node.rate;

                                                return (
                                                    <button
                                                        key={node.id}
                                                        onClick={() => {
                                                            if (isLeaf && hasRate) {
                                                                // Leaf: fill input
                                                                setInputs((prev) => ({ ...prev, [focusedRow.key]: node.rate! }));
                                                            } else if (!isLeaf) {
                                                                // Drill deeper
                                                                setRefTreePath([...refTreePath, node.id]);
                                                            }
                                                        }}
                                                        disabled={isLeaf && !hasRate}
                                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors group ${isLeaf && hasRate && inputs[focusedRow.key] === node.rate
                                                            ? 'bg-black/[0.06] ring-1 ring-black/10'
                                                            : isLeaf && !hasRate
                                                                ? 'opacity-40 cursor-not-allowed'
                                                                : 'hover:bg-white'
                                                            }`}
                                                    >
                                                        <span className="text-black font-medium flex items-center gap-1.5">
                                                            {node.name || <span className="text-black/30 italic">Unnamed</span>}
                                                        </span>
                                                        {isLeaf ? (
                                                            <span className="text-black font-mono font-semibold">
                                                                {hasRate ? `₹${node.rate}` : '—'}
                                                            </span>
                                                        ) : (
                                                            <ChevronRight className="w-3.5 h-3.5 text-black/30 group-hover:text-black transition-colors" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                            {treeCurrentNodes.length === 0 && (
                                                <p className="text-xs text-black/30 text-center py-3 italic">
                                                    No items at this level
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Flat reference items (when no tree, or tree + flat refs) */}
                                {focusedRow && !focusedRefTree && hasFocusedRefs && (
                                    <>
                                        <p className="text-[11px] text-black">
                                            Click to fill {focusedRow.label}:
                                        </p>
                                        <div className="space-y-1">
                                            {focusedLinkedTemp && (
                                                <button
                                                    onClick={() => {
                                                        setInputs((prev) => ({ ...prev, [focusedRow.key]: focusedLinkedTemp.rate }));
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors group ${inputs[focusedRow.key] === focusedLinkedTemp.rate
                                                        ? 'bg-black/[0.06] ring-1 ring-black/10'
                                                        : 'hover:bg-white'
                                                        }`}
                                                >
                                                    <span className="text-black font-medium">{focusedLinkedTemp.name || focusedRow.label}</span>
                                                    <span className="text-black font-mono font-semibold">₹{focusedLinkedTemp.rate}</span>
                                                </button>
                                            )}
                                            {focusedRefItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        setInputs((prev) => ({ ...prev, [focusedRow.key]: item.value }));
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors group ${inputs[focusedRow.key] === item.value
                                                        ? 'bg-black/[0.06] ring-1 ring-black/10'
                                                        : 'hover:bg-white'
                                                        }`}
                                                >
                                                    <span className="text-black font-medium">{item.name || 'Unnamed'}</span>
                                                    <span className="text-black/50 font-mono">{item.value}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* All items view (no focused row) */}
                                {!focusedRow && adminTempItems.length > 0 && (
                                    <>
                                        <p className="text-[11px] text-black">
                                            Click to fill input fields:
                                        </p>
                                        <div className="space-y-1 max-h-80 overflow-auto">
                                            {adminTempItems.map((item) => {
                                                const linkedRow = item.autoFromRowId
                                                    ? currentCalc?.rows.find((r) => r.id === item.autoFromRowId)
                                                    : null;
                                                const isFilled = linkedRow && inputs[linkedRow.key] === item.rate && item.rate !== '';

                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                            if (linkedRow && item.rate) {
                                                                setInputs((prev) => ({ ...prev, [linkedRow.key]: item.rate }));
                                                            } else if (!linkedRow) {
                                                                addFromReferenceList(item.name, item.rate);
                                                            }
                                                        }}
                                                        disabled={!item.rate}
                                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors group ${isFilled
                                                            ? 'bg-black/[0.04] ring-1 ring-black/10'
                                                            : item.rate
                                                                ? 'hover:bg-white'
                                                                : 'opacity-40 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <span className="text-black group-hover:text-black flex items-center gap-1.5">
                                                            {item.name || <span className="text-black/30 italic">Unnamed</span>}
                                                            {linkedRow && (
                                                                <span className="text-[9px] text-black/30">→ fill</span>
                                                            )}
                                                        </span>
                                                        <span className="text-black font-mono">
                                                            {item.rate ? `₹${item.rate}` : '—'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
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
