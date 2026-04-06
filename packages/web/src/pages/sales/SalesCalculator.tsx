import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Calculator,
    ChevronRight,
    FolderOpen,
    ArrowLeft,
    X,
    ChevronDown,
    ChevronUp,
    Plus,
    FileText,
    MessageCircle,
    AlertTriangle,
    Percent,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { RefTreeNode, Calculator as CalcType, InputDefinition } from '../../types/calculator';
import { QuotationModal } from '../../components/QuotationModal';
import type { QuotationData, QuotationLineItem } from '../../components/QuotationModal';

// ═══════════════════════════════════════════════════════════════════════
// SALES CALCULATOR — Single-calc-per-category + Additional Charges
// ═══════════════════════════════════════════════════════════════════════

export function SalesCalculator() {
    const store = useAppStore();
    const {
        categories,
        inputDefinitions,
        syncReady,
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
    // Temporary extra charges added by sales user (label + amount)
    const [extraCharges, setExtraCharges] = useState<{ id: string; label: string; amount: string }[]>([]);
    // Discount state per calculator (keyed by calc id)
    const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({});
    // Grand total discount state
    const [grandDiscountInput, setGrandDiscountInput] = useState('');
    // Collapse state for charges
    const [collapsedCharges, setCollapsedCharges] = useState<Record<string, boolean>>({});
    // Reference sidebar
    const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
    const [focusedSourceId, setFocusedSourceId] = useState<string | null>(null); // calc or charge id
    const [refTreePath, setRefTreePath] = useState<string[]>([]);
    const [refHighlightIndex, setRefHighlightIndex] = useState(-1);
    // GST toggle
    const [includeGst, setIncludeGst] = useState(true);
    // Total quantity for cost per piece
    const [totalQuantity, setTotalQuantity] = useState('');
    // Quotation modal
    const [showQuotationModal, setShowQuotationModal] = useState(false);

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
        setDiscountInputs({});
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

        // Apply per-section discount on afterProfit (excluding GST)
        const discInput = discountInputs[currentCalc.id] || '';
        const dMax = parseFloat(currentCalc.discountMaxPercent || '0') || 0;
        const dMin = parseFloat(currentCalc.discountMinPercent || '0') || 0;
        const dEnabled = currentCalc.enableDiscount && dMax > 0;
        const dVal = parseFloat(discInput || '0') || 0;
        const dValid = dEnabled && discInput !== '' && dVal >= dMin && dVal <= dMax;
        const discountAmount = dValid ? afterProfit * (dVal / 100) : 0;
        const afterDiscount = afterProfit - discountAmount;

        // GST on discounted amount (after discount, not before)
        const gstPct = parseFloat(currentCalc.gstPercent || '0') || 0;
        const gstAmount = afterDiscount * (gstPct / 100);
        const finalAmount = afterDiscount + gstAmount;

        return { ...result, subtotal, profitAmount, afterProfit, discountAmount, afterDiscount, gstAmount, finalAmount };
    }, [currentCalc, mainInputs, mainDropdowns, calculateResult, discountInputs]);

    // Active charges (only compute results for activated ones)
    const activeCharges = charges.filter((c) => activeChargeIds.includes(c.id));
    const inactiveCharges = charges.filter((c) => !activeChargeIds.includes(c.id));

    // Per-charge results
    const chargeResults = useMemo(() => {
        const results: Record<string, { formulaResults: Record<string, string>; total: string; subtotal: number; profitAmount: number; afterProfit: number; discountAmount: number; afterDiscount: number; gstAmount: number; finalAmount: number }> = {};

        // Build external formula values from main calculator (keyed by formula ID)
        const externalValues: Record<string, string> = {};
        if (currentCalc && mainResult) {
            for (const f of currentCalc.formulas) {
                externalValues[f.id] = mainResult.formulaResults[f.key] || '0';
            }
        }

        // Compute charges sequentially — each charge gets parent + all previous sibling formula values
        for (const charge of activeCharges) {
            const inputs = chargeInputs[charge.id] || {};
            const dropdowns = chargeDropdowns[charge.id] || {};
            const result = calculateResult(charge, inputs, dropdowns, [], { ...externalValues });

            const grandTotalFormula = charge.formulas.find((f) => f.isTotal);
            const subtotal = grandTotalFormula
                ? parseFloat(result.formulaResults[grandTotalFormula.key] || '0')
                : parseFloat(result.total || '0');

            const profitPct = parseFloat(charge.profitPercent || '0') || 0;
            const profitAmount = subtotal * (profitPct / 100);
            const afterProfit = subtotal + profitAmount;

            // Apply per-section discount on afterProfit (excluding GST)
            const discInput = discountInputs[charge.id] || '';
            const dMax = parseFloat(charge.discountMaxPercent || '0') || 0;
            const dMin = parseFloat(charge.discountMinPercent || '0') || 0;
            const dEnabled = charge.enableDiscount && dMax > 0;
            const dVal = parseFloat(discInput || '0') || 0;
            const dValid = dEnabled && discInput !== '' && dVal >= dMin && dVal <= dMax;
            const discountAmount = dValid ? afterProfit * (dVal / 100) : 0;
            const afterDiscount = afterProfit - discountAmount;

            const gstPct = parseFloat(charge.gstPercent || '0') || 0;
            const gstAmount = afterDiscount * (gstPct / 100);
            const finalAmount = afterDiscount + gstAmount;

            results[charge.id] = { ...result, subtotal, profitAmount, afterProfit, discountAmount, afterDiscount, gstAmount, finalAmount };

            // Add this charge's formula results to externalValues for subsequent charges
            for (const f of charge.formulas) {
                externalValues[f.id] = result.formulaResults[f.key] || '0';
            }
        }
        return results;
    }, [activeCharges, chargeInputs, chargeDropdowns, calculateResult, currentCalc, mainResult, discountInputs]);

    // Extra charges total
    const extraChargesTotal = useMemo(() => {
        return extraCharges.reduce((sum, ec) => sum + (parseFloat(ec.amount) || 0), 0);
    }, [extraCharges]);

    // Total per-section discount amount (for display — already applied in section finals)
    const totalDiscountAmount = useMemo(() => {
        let discount = 0;
        if (mainResult) discount += mainResult.discountAmount;
        for (const charge of activeCharges) {
            const r = chargeResults[charge.id];
            if (r) discount += r.discountAmount;
        }
        return discount;
    }, [mainResult, activeCharges, chargeResults]);

    // Sum of all finalAmounts (per-section discounts already applied before GST)
    const afterSectionDiscounts = useMemo(() => {
        let total = mainResult?.finalAmount || 0;
        for (const r of Object.values(chargeResults)) {
            total += r.finalAmount;
        }
        total += extraChargesTotal;
        return total;
    }, [mainResult, chargeResults, extraChargesTotal]);

    // Sum excluding GST (afterDiscount values, no GST added)
    const afterSectionDiscountsExGst = useMemo(() => {
        let total = mainResult?.afterDiscount || 0;
        for (const r of Object.values(chargeResults)) {
            total += r.afterDiscount;
        }
        total += extraChargesTotal;
        return total;
    }, [mainResult, chargeResults, extraChargesTotal]);

    // Total GST amount across all sections
    const totalGstAmount = useMemo(() => {
        let gst = mainResult?.gstAmount || 0;
        for (const r of Object.values(chargeResults)) {
            gst += r.gstAmount;
        }
        return gst;
    }, [mainResult, chargeResults]);

    // Grand total discount (applied on sum — mathematically equivalent to pre-GST)
    const grandDiscountAmount = useMemo(() => {
        if (!currentCalc?.enableGrandDiscount) return 0;
        const max = parseFloat(currentCalc.grandDiscountMaxPercent || '0') || 0;
        const min = parseFloat(currentCalc.grandDiscountMinPercent || '0') || 0;
        if (max <= 0) return 0;
        const val = parseFloat(grandDiscountInput || '0') || 0;
        if (val >= min && val <= max && grandDiscountInput !== '') {
            return afterSectionDiscounts * (val / 100);
        }
        return 0;
    }, [currentCalc, grandDiscountInput, afterSectionDiscounts]);

    // Grand discount excluding GST
    const grandDiscountAmountExGst = useMemo(() => {
        if (!currentCalc?.enableGrandDiscount) return 0;
        const max = parseFloat(currentCalc.grandDiscountMaxPercent || '0') || 0;
        const min = parseFloat(currentCalc.grandDiscountMinPercent || '0') || 0;
        if (max <= 0) return 0;
        const val = parseFloat(grandDiscountInput || '0') || 0;
        if (val >= min && val <= max && grandDiscountInput !== '') {
            return afterSectionDiscountsExGst * (val / 100);
        }
        return 0;
    }, [currentCalc, grandDiscountInput, afterSectionDiscountsExGst]);

    // Grand total = after section discounts - grand discount
    const grandTotal = afterSectionDiscounts - grandDiscountAmount;
    const grandTotalExGst = afterSectionDiscountsExGst - grandDiscountAmountExGst;

    // Display grand total based on GST toggle
    const displayGrandTotal = includeGst ? grandTotal : grandTotalExGst;

    // Reference sidebar
    const focusedInputDef = focusedInputId
        ? inputDefinitions.find((i) => i.id === focusedInputId)
        : null;

    // Compute current tree nodes for keyboard navigation
    const refTreeCurrentNodes = useMemo(() => {
        if (!focusedInputDef?.refTree?.nodes) return [];
        let nodes = focusedInputDef.refTree.nodes;
        for (const pathId of refTreePath) {
            const found = nodes.find((n) => n.id === pathId);
            if (found && found.children) nodes = found.children;
            else break;
        }
        return nodes;
    }, [focusedInputDef, refTreePath]);

    // Reset highlight when sidebar content changes
    useEffect(() => {
        setRefHighlightIndex(-1);
    }, [focusedInputId, refTreePath]);

    // Keyboard handler for reference navigation
    const handleRefKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!focusedInputDef || !focusedSourceId) return;

        const refItems = focusedInputDef.referenceItems || [];
        const hasTree = focusedInputDef.refTree?.nodes && focusedInputDef.refTree.nodes.length > 0;
        const hasFlat = !hasTree && refItems.length > 0;
        const itemCount = hasTree ? refTreeCurrentNodes.length : hasFlat ? refItems.length : 0;
        if (itemCount === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setRefHighlightIndex((prev) => Math.min(prev + 1, itemCount - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setRefHighlightIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && refHighlightIndex >= 0 && refHighlightIndex < itemCount) {
            e.preventDefault();
            const isMainCalc = focusedSourceId === currentCalc?.id;

            if (hasTree) {
                const node = refTreeCurrentNodes[refHighlightIndex];
                const isLeaf = !node.children || node.children.length === 0;
                if (isLeaf && node.rate) {
                    if (isMainCalc) {
                        setMainInputs((prev) => ({ ...prev, [focusedInputDef.key]: node.rate! }));
                    } else {
                        setChargeInput(focusedSourceId, focusedInputDef.key, node.rate!);
                    }
                    setFocusedInputId(null);
                    setFocusedSourceId(null);
                    setRefTreePath([]);
                } else if (!isLeaf) {
                    setRefTreePath((prev) => [...prev, node.id]);
                }
            } else if (hasFlat) {
                const item = refItems[refHighlightIndex];
                if (isMainCalc) {
                    setMainInputs((prev) => ({ ...prev, [focusedInputDef.key]: item.value }));
                } else {
                    setChargeInput(focusedSourceId, focusedInputDef.key, item.value);
                }
                setFocusedInputId(null);
                setFocusedSourceId(null);
                setRefTreePath([]);
            }
        } else if (e.key === 'ArrowRight' && hasTree && refHighlightIndex >= 0) {
            const node = refTreeCurrentNodes[refHighlightIndex];
            if (node.children && node.children.length > 0) {
                e.preventDefault();
                setRefTreePath((prev) => [...prev, node.id]);
            }
        } else if (e.key === 'ArrowLeft' && hasTree && refTreePath.length > 0) {
            e.preventDefault();
            setRefTreePath((prev) => prev.slice(0, -1));
        }
    }, [focusedInputDef, focusedSourceId, refTreeCurrentNodes, refHighlightIndex, refTreePath, currentCalc, setChargeInput]);

    // Which categories to show at current level
    const displayChildren = currentCategoryId ? children : rootCategories;

    // ── Loading guard (AFTER all hooks to comply with React rules) ──
    if (!syncReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100/80">
                <div className="text-center space-y-4">
                    <div className="w-10 h-10 border-3 border-black/10 border-t-black/60 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-black/40 font-medium">Loading calculator data...</p>
                </div>
            </div>
        );
    }

    return (
        <>
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
                                    // Check if this is a leaf category (no subcategories) with no calculator
                                    const isLeafWithoutCalc = !hasCalc && subChildren.length === 0;

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => navigateTo(cat.id)}
                                            className={`glass rounded-2xl p-4 text-left border transition-all duration-200 group ${
                                                isLeafWithoutCalc
                                                    ? 'border-amber-200/60 bg-amber-50/30 hover:border-amber-300/80'
                                                    : 'border-transparent hover:border-black/15'
                                            }`}
                                        >
                                            {hasCalc ? (
                                                <Calculator className="w-6 h-6 text-black mb-2 group-hover:scale-110 transition-transform" />
                                            ) : isLeafWithoutCalc ? (
                                                <AlertTriangle className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <FolderOpen className="w-6 h-6 text-black/50 mb-2 group-hover:scale-110 transition-transform" />
                                            )}
                                            <span className="text-base font-semibold text-black block">{cat.name}</span>
                                            <span className={`text-[11px] mt-0.5 block ${
                                                isLeafWithoutCalc ? 'text-amber-500' : 'text-black/40'
                                            }`}>
                                                {hasCalc
                                                    ? `${calcs.length} calculator${calcs.length > 1 ? 's' : ''}`
                                                    : isLeafWithoutCalc
                                                        ? 'No calculator'
                                                        : `${subChildren.length} sub-categories`}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Empty state — Calculator not found */}
                        {displayChildren.length === 0 && !currentCalc && (
                            <div className="rounded-2xl border-2 border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-10 text-center">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-4">
                                    <AlertTriangle className="w-7 h-7 text-amber-500" />
                                </div>
                                <h3 className="text-lg font-bold text-amber-800 mb-1">
                                    {currentCategoryId
                                        ? 'Calculator Not Found'
                                        : 'No Categories Yet'}
                                </h3>
                                <p className="text-sm text-amber-700/70 max-w-sm mx-auto">
                                    {currentCategoryId
                                        ? 'This calculator hasn\'t been configured yet. Please ask your admin to create a calculator for this category.'
                                        : 'No product categories have been created. Please ask your admin to set up categories and calculators.'}
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
                                    discountInput={discountInputs[currentCalc.id] || ''}
                                    onDiscountChange={(val) => setDiscountInputs((prev) => ({ ...prev, [currentCalc.id]: val }))}
                                    onFocusInput={(inputId) => {
                                        setFocusedInputId(inputId);
                                        setFocusedSourceId(currentCalc.id);
                                        setRefTreePath([]);
                                    }}
                                    onBlurInput={() => {
                                        setFocusedInputId(null);
                                        setFocusedSourceId(null);
                                        setRefTreePath([]);
                                    }}
                                    focusedInputId={focusedSourceId === currentCalc.id ? focusedInputId : null}
                                    onInputKeyDown={handleRefKeyDown}
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
                                            discountInput={discountInputs[charge.id] || ''}
                                            onDiscountChange={(val) => setDiscountInputs((prev) => ({ ...prev, [charge.id]: val }))}
                                            onToggleCollapse={() => setCollapsedCharges((prev) => ({ ...prev, [charge.id]: !prev[charge.id] }))}
                                            onRemove={() => setActiveChargeIds((prev) => prev.filter((id) => id !== charge.id))}
                                            onFocusInput={(inputId) => {
                                                setFocusedInputId(inputId);
                                                setFocusedSourceId(charge.id);
                                                setRefTreePath([]);
                                            }}
                                            onBlurInput={() => {
                                                setFocusedInputId(null);
                                                setFocusedSourceId(null);
                                                setRefTreePath([]);
                                            }}
                                            focusedInputId={focusedSourceId === charge.id ? focusedInputId : null}
                                            onInputKeyDown={handleRefKeyDown}
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

                                {/* ═══ EXTRA CHARGES (user-added) ═══ */}
                                <div className="space-y-2">
                                    {extraCharges.map((ec) => (
                                        <div key={ec.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/8 bg-white/80">
                                            <input
                                                type="text"
                                                value={ec.label}
                                                onChange={(e) => setExtraCharges((prev) => prev.map((item) => item.id === ec.id ? { ...item, label: e.target.value } : item))}
                                                placeholder="Charge name..."
                                                className="flex-1 text-sm font-medium text-black bg-transparent outline-none placeholder:text-black/25"
                                            />
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm text-black/40">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={ec.amount}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                                        setExtraCharges((prev) => prev.map((item) => item.id === ec.id ? { ...item, amount: v } : item));
                                                    }}
                                                    placeholder="0"
                                                    className="w-24 text-right text-sm font-mono font-semibold text-black bg-black/[0.03] border border-black/8 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-black/10"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setExtraCharges((prev) => prev.filter((item) => item.id !== ec.id))}
                                                className="p-1 rounded-lg text-black/20 hover:text-red-500 transition-colors"
                                                title="Remove"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setExtraCharges((prev) => [...prev, { id: Date.now().toString(), label: '', amount: '' }])}
                                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-black/15 hover:border-blue-300 hover:bg-blue-50/40 text-black/40 hover:text-blue-600 transition-all group"
                                    >
                                        <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-semibold">Extra Charges</span>
                                    </button>
                                </div>

                                {/* ═══ GRAND TOTAL ═══ */}
                                <div className="rounded-2xl overflow-hidden border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/30">
                                    {/* Per-section subtotals when there are active charges or extra charges or discount */}
                                    {(activeCharges.length > 0 || extraCharges.some((ec) => parseFloat(ec.amount) > 0) || totalDiscountAmount > 0 || grandDiscountAmount > 0) && (
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
                                            {extraCharges.filter((ec) => parseFloat(ec.amount) > 0).map((ec) => (
                                                <div key={ec.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-emerald-700/70">{ec.label || 'Extra Charge'}</span>
                                                    <span className="font-mono font-semibold text-emerald-600">
                                                        ₹{parseFloat(ec.amount).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                            {/* Per-section discount info (already reflected in section totals above) */}
                                            {totalDiscountAmount > 0 && (
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-violet-600 font-medium flex items-center gap-1.5">
                                                        <Percent className="w-3 h-3" />
                                                        Discount (included above)
                                                    </span>
                                                    <span className="font-mono font-semibold text-violet-600">
                                                        −₹{totalDiscountAmount.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Grand total discount deduction line */}
                                            {grandDiscountAmount > 0 && (
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-teal-600 font-medium flex items-center gap-1.5">
                                                        <Percent className="w-3 h-3" />
                                                        Grand Discount ({grandDiscountInput}%)
                                                    </span>
                                                    <span className="font-mono font-semibold text-teal-600">
                                                        −₹{grandDiscountAmount.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="border-t border-emerald-200/60 my-1" />
                                        </div>
                                    )}

                                    {/* Grand Total Discount Input */}
                                    {currentCalc.enableGrandDiscount && parseFloat(currentCalc.grandDiscountMaxPercent || '0') > 0 && (() => {
                                        const gdMin = parseFloat(currentCalc.grandDiscountMinPercent || '0') || 0;
                                        const gdMax = parseFloat(currentCalc.grandDiscountMaxPercent || '0') || 0;
                                        const gdVal = parseFloat(grandDiscountInput || '0') || 0;
                                        const gdOutOfRange = grandDiscountInput !== '' && (gdVal < gdMin || gdVal > gdMax);

                                        return (
                                            <div className={`px-5 py-3 border-t ${gdOutOfRange ? 'border-red-200 bg-red-50/50' : 'border-emerald-200/40'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-semibold text-teal-600 flex items-center gap-1.5">
                                                        <Percent className="w-3 h-3" />
                                                        Grand Discount
                                                    </span>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={grandDiscountInput}
                                                            onChange={(e) => {
                                                                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./, '$1');
                                                                setGrandDiscountInput(v);
                                                            }}
                                                            placeholder={`${currentCalc.grandDiscountMinPercent || '0'}–${currentCalc.grandDiscountMaxPercent || '0'}`}
                                                            className={`w-20 text-sm font-mono font-semibold bg-teal-50/50 rounded-lg px-2.5 py-1.5 pr-6 outline-none border transition-colors ${
                                                                gdOutOfRange
                                                                    ? 'border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                                                                    : 'border-teal-200 text-teal-700 focus:ring-2 focus:ring-teal-200'
                                                            }`}
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-teal-400 font-bold">%</span>
                                                    </div>
                                                    <span className="text-[10px] text-black/30">
                                                        Range: {currentCalc.grandDiscountMinPercent || '0'}% – {currentCalc.grandDiscountMaxPercent || '0'}%
                                                    </span>
                                                </div>
                                                {gdOutOfRange && (
                                                    <div className="mt-1.5 flex items-center gap-1.5 text-red-500">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        <span className="text-[10px] font-semibold">
                                                            Discount must be between {gdMin}% and {gdMax}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* GST Toggle + Grand Total */}
                                    <div className={`px-5 ${(activeCharges.length > 0 || extraCharges.some((ec) => parseFloat(ec.amount) > 0) || totalDiscountAmount > 0 || grandDiscountAmount > 0) ? 'pt-1' : 'pt-4'} pb-2`}>
                                        {/* GST Toggle Button */}
                                        {totalGstAmount > 0 && (
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-semibold text-emerald-600">GST</span>
                                                <button
                                                    onClick={() => setIncludeGst((prev) => !prev)}
                                                    className={`relative inline-flex h-7 w-[120px] items-center rounded-full transition-colors duration-200 ${
                                                        includeGst ? 'bg-emerald-500' : 'bg-black/15'
                                                    }`}
                                                >
                                                    <span
                                                        className={`absolute left-1.5 text-[10px] font-bold transition-opacity duration-200 ${
                                                            includeGst ? 'text-white/80 opacity-100' : 'opacity-0'
                                                        }`}
                                                    >
                                                        INCLUDED
                                                    </span>
                                                    <span
                                                        className={`absolute right-1.5 text-[10px] font-bold transition-opacity duration-200 ${
                                                            !includeGst ? 'text-black/40 opacity-100' : 'opacity-0'
                                                        }`}
                                                    >
                                                        EXCLUDED
                                                    </span>
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                            includeGst ? 'translate-x-[93px]' : 'translate-x-[3px]'
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                        )}

                                        {/* GST amount row when included */}
                                        {includeGst && totalGstAmount > 0 && (
                                            <div className="flex items-center justify-between text-sm mb-2">
                                                <span className="text-emerald-600/70 font-medium">GST Amount</span>
                                                <span className="font-mono font-semibold text-emerald-600">
                                                    ₹{totalGstAmount.toFixed(2)}
                                                </span>
                                            </div>
                                        )}

                                        {/* Grand Total */}
                                        <div className="flex items-center justify-between pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-emerald-500 text-lg">🏆</span>
                                                <div>
                                                    <span className="text-lg font-bold text-emerald-800">
                                                        Grand Total
                                                    </span>
                                                    {totalGstAmount > 0 && (
                                                        <span className="block text-[10px] text-emerald-600/50 font-medium -mt-0.5">
                                                            {includeGst ? 'incl. GST' : 'excl. GST'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xl font-mono font-bold text-emerald-700">
                                                ₹{displayGrandTotal.toFixed(2)}
                                            </span>
                                        </div>

                                        {/* Cost per piece */}
                                        <div className="border-t border-emerald-200/60 pt-3 mt-1">
                                            <div className="flex items-center justify-between gap-3">
                                                <label className="text-xs font-semibold text-emerald-700/70 whitespace-nowrap">Total Quantity</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={totalQuantity}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                                        setTotalQuantity(v);
                                                    }}
                                                    placeholder="Qty"
                                                    className="w-24 text-right text-sm font-mono font-semibold text-emerald-800 bg-emerald-100/50 border border-emerald-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-300 placeholder:text-emerald-400/50"
                                                />
                                            </div>
                                            {totalQuantity && parseFloat(totalQuantity) > 0 && (
                                                <div className="flex items-center justify-between mt-2 px-1">
                                                    <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                                                        💰 Cost per Piece
                                                    </span>
                                                    <span className="text-lg font-mono font-bold text-emerald-800">
                                                        ₹{(displayGrandTotal / parseFloat(totalQuantity)).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quotation Actions */}
                                    <div className="px-5 pb-4 flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowQuotationModal(true); }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-black/80 transition-all"
                                        >
                                            <FileText className="w-4 h-4" />
                                            Download PDF
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowQuotationModal(true); }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition-all"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            WhatsApp
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reference sidebar */}
                    {focusedInputDef && focusedSourceId && (() => {
                        const refItems = focusedInputDef.referenceItems || [];
                        const refTree = focusedInputDef.refTree;
                        const hasAnything = refItems.length > 0 || (refTree && refTree.nodes && refTree.nodes.length > 0);

                        if (!hasAnything) return null;

                        // Tree navigation — use pre-computed nodes
                        const treeCurrentNodes = refTreeCurrentNodes;

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
                            <div className="w-64 shrink-0" onMouseDown={(e) => e.preventDefault()}>
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
                                                {treeCurrentNodes.map((node, idx) => {
                                                    const isLeaf = !node.children || node.children.length === 0;
                                                    const hasRate = !!node.rate;
                                                    const isHighlighted = idx === refHighlightIndex;

                                                    return (
                                                        <button
                                                            key={node.id}
                                                            onClick={() => {
                                                                if (isLeaf && hasRate) {
                                                                    handleSelectValue(node.rate!);
                                                                    setFocusedInputId(null);
                                                                    setFocusedSourceId(null);
                                                                    setRefTreePath([]);
                                                                } else if (!isLeaf) {
                                                                    setRefTreePath([...refTreePath, node.id]);
                                                                }
                                                            }}
                                                            disabled={isLeaf && !hasRate}
                                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${isHighlighted
                                                                ? 'bg-blue-50 ring-1 ring-blue-200'
                                                                : isLeaf && hasRate && currentInputs[focusedInputDef.key] === node.rate
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
                                                {refItems.map((item, idx) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                        handleSelectValue(item.value);
                                                        setFocusedInputId(null);
                                                        setFocusedSourceId(null);
                                                        setRefTreePath([]);
                                                    }}
                                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${idx === refHighlightIndex
                                                            ? 'bg-blue-50 ring-1 ring-blue-200'
                                                            : currentInputs[focusedInputDef.key] === item.value
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

            {/* ═══ QUOTATION MODAL ═══ */}
            {
                showQuotationModal && currentCalc && mainResult && (() => {
                    // Helper: build description for a calculator/charge from its inputs
                    const buildItemDescription = (
                        calc: typeof currentCalc,
                        inputs: Record<string, string>,
                        dropdowns: Record<string, string>,
                    ): string => {
                        const tokenInputIds = new Set(
                            calc.formulas.flatMap((f) => f.tokens.filter((t) => t.type === 'input').map((t) => t.value))
                        );
                        const usedDefs = inputDefinitions
                            .filter((i) => tokenInputIds.has(i.id))
                            .sort((a, b) => calc.usedInputIds.indexOf(a.id) - calc.usedInputIds.indexOf(b.id));

                        const parts: string[] = [];
                        for (const def of usedDefs) {
                            if (def.hidden) continue;
                            let value = '';
                            if (def.type === 'number') {
                                value = inputs[def.key] || '';
                            } else if (def.type === 'dropdown') {
                                const selVal = dropdowns[def.key] || '';
                                const opt = def.dropdownOptions?.find((o) => o.value === selVal);
                                value = opt ? opt.label : selVal;
                            } else if (def.type === 'fixed') {
                                value = def.fixedValue || '0';
                            } else if (def.type === 'reference_list') {
                                const pathJson = dropdowns[def.key] || '';
                                if (pathJson) {
                                    try {
                                        const parsed = JSON.parse(pathJson);
                                        value = parsed.label || parsed.value || pathJson;
                                    } catch {
                                        value = pathJson;
                                    }
                                }
                            }
                            if (value) {
                                parts.push(`${def.name}: ${value}`);
                            }
                        }
                        return parts.join(' | ');
                    };

                    // Build quotation line items with descriptions
                    const items: QuotationLineItem[] = [];

                    // Main calculator
                    items.push({
                        label: currentCalc.name,
                        description: buildItemDescription(currentCalc, mainInputs, mainDropdowns),
                        amount: mainResult.afterDiscount,
                        gstPercent: parseFloat(currentCalc.gstPercent || '0') || 0,
                        gstAmount: mainResult.gstAmount,
                        finalAmount: mainResult.finalAmount,
                    });

                    // Active charges
                    for (const charge of activeCharges) {
                        const r = chargeResults[charge.id];
                        if (r) {
                            items.push({
                                label: charge.name,
                                description: buildItemDescription(charge, chargeInputs[charge.id] || {}, chargeDropdowns[charge.id] || {}),
                                amount: r.afterDiscount,
                                gstPercent: parseFloat(charge.gstPercent || '0') || 0,
                                gstAmount: r.gstAmount,
                                finalAmount: r.finalAmount,
                            });
                        }
                    }

                    // Extra charges (no GST on these)
                    for (const ec of extraCharges) {
                        const amt = parseFloat(ec.amount) || 0;
                        if (amt > 0) {
                            items.push({
                                label: ec.label || 'Extra Charge',
                                amount: amt,
                                gstPercent: 0,
                                gstAmount: 0,
                                finalAmount: amt,
                            });
                        }
                    }

                    const qData: QuotationData = { items, grandTotal };

                    return (
                        <QuotationModal
                            data={qData}
                            onClose={() => setShowQuotationModal(false)}
                        />
                    );
                })()
            }
        </>
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
    discountInput,
    onDiscountChange,
    onToggleCollapse,
    onRemove,
    onFocusInput,
    onBlurInput,
    focusedInputId,
    onInputKeyDown,
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
        discountAmount: number;
        afterDiscount: number;
        gstAmount: number;
        finalAmount: number;
    } | null;
    inputDefinitions: InputDefinition[];
    onSetInput: (key: string, val: string) => void;
    onSetDropdown: (key: string, val: string) => void;
    discountInput: string;
    onDiscountChange: (val: string) => void;
    onToggleCollapse?: () => void;
    onRemove?: () => void;
    onFocusInput: (id: string) => void;
    onBlurInput: () => void;
    focusedInputId: string | null;
    onInputKeyDown?: (e: React.KeyboardEvent) => void;
}) {
    // Derive actually-used input IDs from formula tokens (not stale usedInputIds)
    const tokenInputIds = new Set(
        calc.formulas.flatMap((f) => f.tokens.filter((t) => t.type === 'input').map((t) => t.value))
    );
    const usedInputDefs = inputDefinitions
        .filter((i) => tokenInputIds.has(i.id))
        .sort((a, b) => calc.usedInputIds.indexOf(a.id) - calc.usedInputIds.indexOf(b.id));

    const sortedFormulas = [...calc.formulas].sort((a, b) => a.order - b.order);
    const grandTotalFormula = sortedFormulas.find((f) => f.isTotal);
    const regularFormulas = sortedFormulas.filter((f) => !f.isTotal && !f.hidden);
    const profitPct = parseFloat(calc.profitPercent || '0') || 0;
    const gstPct = parseFloat(calc.gstPercent || '0') || 0;

    // ── Discount logic (state is lifted to parent) ──
    const discountMin = parseFloat(calc.discountMinPercent || '0') || 0;
    const discountMax = parseFloat(calc.discountMaxPercent || '0') || 0;
    const discountEnabled = calc.enableDiscount && discountMax > 0;
    const discountVal = parseFloat(discountInput || '0') || 0;
    const discountInRange = discountVal >= discountMin && discountVal <= discountMax;
    const discountValid = discountEnabled && discountInput !== '' && discountInRange;
    const discountOutOfRange = discountEnabled && discountInput !== '' && !discountInRange;

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
                                                const hasRefItems = inputDef.referenceItems && inputDef.referenceItems.length > 0;
                                                const hasRefTree = inputDef.refTree && inputDef.refTree.nodes && inputDef.refTree.nodes.length > 0;
                                                if (hasRefItems || hasRefTree) {
                                                    onFocusInput(inputDef.id);
                                                }
                                            }}
                                            onBlur={() => onBlurInput()}
                                            onKeyDown={(e) => onInputKeyDown?.(e)}
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

                                    {inputDef.type === 'reference_list' && inputDef.refTree && (
                                        <ReferenceListDropdowns
                                            inputDef={inputDef}
                                            selectedPath={dropdowns[inputDef.key] || ''}
                                            onSelect={(pathJson) => onSetDropdown(inputDef.key, pathJson)}
                                        />
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

                            {/* Subtotal + Profit + Discount + GST breakdown */}
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
                                    {profitPct > 0 && !calc.hideProfit && (
                                        <div className="px-4 py-1 flex items-center justify-between text-black/40">
                                            <span className="text-xs">
                                                + Profit ({profitPct}%)
                                            </span>
                                            <span className="text-xs font-mono font-medium">
                                                ₹{result.profitAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Discount input — now BEFORE GST */}
                                    {discountEnabled && (
                                        <div className={`px-4 py-2 border-t ${discountOutOfRange ? 'border-red-200 bg-red-50/50' : 'border-black/5'}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Percent className="w-3.5 h-3.5 text-violet-400" />
                                                    <span className="text-xs font-semibold text-black/50">Discount</span>
                                                    <span className="text-[9px] text-black/30 font-medium">
                                                        ({discountMin}% – {discountMax}%)
                                                    </span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={discountInput}
                                                        onChange={(e) => {
                                                            const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./,  '$1');
                                                            onDiscountChange(v);
                                                        }}
                                                        placeholder="0"
                                                        className={`w-20 text-sm font-mono font-semibold text-right bg-white rounded-lg px-2.5 py-1 pr-6 outline-none border transition-colors ${
                                                            discountOutOfRange
                                                                ? 'border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                                                                : 'border-black/10 text-black focus:ring-2 focus:ring-violet-200'
                                                        }`}
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-black/30 font-bold">%</span>
                                                </div>
                                            </div>
                                            {discountOutOfRange && (
                                                <div className="mt-1.5 flex items-center gap-1.5 text-red-500">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    <span className="text-[10px] font-semibold">
                                                        Discount must be between {discountMin}% and {discountMax}%
                                                    </span>
                                                </div>
                                            )}
                                            {discountValid && result && (
                                                <div className="mt-1 flex items-center justify-between text-violet-600">
                                                    <span className="text-xs font-medium">− Discount ({discountVal}%)</span>
                                                    <span className="text-xs font-mono font-semibold">
                                                        −₹{result.discountAmount.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* GST line — now computed on discounted amount */}
                                    {gstPct > 0 && !calc.hideGst && (
                                        <div className="px-4 py-1 flex items-center justify-between text-black/40">
                                            <span className="text-xs">
                                                + GST ({gstPct}%)
                                            </span>
                                            <span className="text-xs font-mono font-medium">
                                                ₹{result.gstAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Section total (only show when profit or GST is set or discount applied) */}
                                    {(profitPct > 0 || gstPct > 0 || discountValid) && (
                                        <div className="px-4 py-2 flex items-center justify-between border-t border-black/5">
                                            <span className="text-sm font-bold text-black/70">
                                                {label} Total
                                            </span>
                                            <span className="text-sm font-mono font-bold text-black">
                                                ₹{(result?.finalAmount || 0).toFixed(2)}
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

// ═══════════════════════════════════════════════════════════════════════
// REFERENCE LIST DROPDOWNS — Cascading dropdowns for multilevel ref tree
// ═══════════════════════════════════════════════════════════════════════

function ReferenceListDropdowns({
    inputDef,
    selectedPath,
    onSelect,
}: {
    inputDef: InputDefinition;
    selectedPath: string;
    onSelect: (pathJson: string) => void;
}) {
    const refTree = inputDef.refTree;
    if (!refTree) return null;

    // Parse the stored path (JSON array of node IDs)
    let pathIds: string[] = [];
    try {
        if (selectedPath) pathIds = JSON.parse(selectedPath);
    } catch { /* ignore */ }

    // Build the cascading dropdowns data
    const dropdownData: { levelName: string; nodes: RefTreeNode[]; selectedId: string }[] = [];

    let currentNodes = refTree.nodes;
    for (let levelIdx = 0; levelIdx < refTree.levels.length; levelIdx++) {
        const selectedId = pathIds[levelIdx] || '';
        dropdownData.push({
            levelName: refTree.levels[levelIdx],
            nodes: currentNodes,
            selectedId,
        });

        if (selectedId) {
            const selected = currentNodes.find((n) => n.id === selectedId);
            if (selected && selected.children && selected.children.length > 0) {
                currentNodes = selected.children;
            } else {
                break; // leaf reached or no children
            }
        } else {
            break; // no selection at this level, don't show further
        }
    }

    const handleChange = (levelIdx: number, nodeId: string) => {
        // Truncate path to this level and set the new selection
        const newPath = pathIds.slice(0, levelIdx);
        if (nodeId) newPath.push(nodeId);
        onSelect(JSON.stringify(newPath));
    };

    // Find the rate of the deepest selected node
    let selectedRate = '';
    if (pathIds.length > 0 && refTree.nodes.length > 0) {
        let nodes = refTree.nodes;
        for (const pid of pathIds) {
            const found = nodes.find((n) => n.id === pid);
            if (found) {
                if (found.rate) selectedRate = found.rate;
                nodes = found.children || [];
            } else break;
        }
    }

    return (
        <div className="space-y-2 w-full">
            {dropdownData.map((dd, idx) => (
                <div key={idx}>
                    {idx > 0 && (
                        <label className="text-[10px] text-black/40 font-semibold block mb-0.5 mt-1">
                            {dd.levelName}
                        </label>
                    )}
                    <select
                        value={dd.selectedId}
                        onChange={(e) => handleChange(idx, e.target.value)}
                        className="w-full rounded-md bg-white border border-black/10 px-3 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-black/10"
                        title={dd.levelName}
                    >
                        <option value="">Select {dd.levelName}...</option>
                        {dd.nodes.map((node) => (
                            <option key={node.id} value={node.id}>
                                {node.name || 'Unnamed'}
                                {(!node.children || node.children.length === 0) && node.rate ? ` — ₹${node.rate}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            ))}
            {selectedRate && (
                <div className="text-right text-xs text-black/40 font-mono">
                    Rate: ₹{selectedRate}
                </div>
            )}
        </div>
    );
}
