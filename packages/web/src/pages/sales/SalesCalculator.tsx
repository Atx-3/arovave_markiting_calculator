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
            const gstPct = parseFloat(charge.gstPercent || '0') || 0;
            const gstAmount = afterProfit * (gstPct / 100);
            const finalAmount = afterProfit + gstAmount;

            results[charge.id] = { ...result, subtotal, profitAmount, afterProfit, gstAmount, finalAmount };

            // Add this charge's formula results to externalValues for subsequent charges
            for (const f of charge.formulas) {
                externalValues[f.id] = result.formulaResults[f.key] || '0';
            }
        }
        return results;
    }, [activeCharges, chargeInputs, chargeDropdowns, calculateResult, currentCalc, mainResult]);

    // Extra charges total
    const extraChargesTotal = useMemo(() => {
        return extraCharges.reduce((sum, ec) => sum + (parseFloat(ec.amount) || 0), 0);
    }, [extraCharges]);

    // Helper: apply discount to a finalAmount for a given calc id
    const getDiscountedAmount = useCallback((calcId: string, finalAmount: number, calc: CalcType) => {
        const discountInput = discountInputs[calcId] || '';
        const discountMax = parseFloat(calc.discountMaxPercent || '0') || 0;
        const discountMin = parseFloat(calc.discountMinPercent || '0') || 0;
        const discountEnabled = calc.enableDiscount && discountMax > 0;
        const discountVal = parseFloat(discountInput || '0') || 0;
        const discountInRange = discountVal >= discountMin && discountVal <= discountMax;
        const discountValid = discountEnabled && discountInput !== '' && discountInRange;
        if (discountValid) {
            return finalAmount * (1 - discountVal / 100);
        }
        return finalAmount;
    }, [discountInputs]);

    // Pre-discount grand total (sum of all finalAmounts without discount)
    const preDiscountGrandTotal = useMemo(() => {
        let total = mainResult?.finalAmount || 0;
        for (const r of Object.values(chargeResults)) {
            total += r.finalAmount;
        }
        total += extraChargesTotal;
        return total;
    }, [mainResult, chargeResults, extraChargesTotal]);

    // Total discount amount across all sections
    const totalDiscountAmount = useMemo(() => {
        let discount = 0;
        if (mainResult && currentCalc) {
            discount += mainResult.finalAmount - getDiscountedAmount(currentCalc.id, mainResult.finalAmount, currentCalc);
        }
        for (const charge of activeCharges) {
            const r = chargeResults[charge.id];
            if (r) {
                discount += r.finalAmount - getDiscountedAmount(charge.id, r.finalAmount, charge);
            }
        }
        return discount;
    }, [mainResult, currentCalc, activeCharges, chargeResults, getDiscountedAmount]);

    // After per-section discounts
    const afterSectionDiscounts = preDiscountGrandTotal - totalDiscountAmount;

    // Grand total discount (applied on top of everything)
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

    // Grand total = after section discounts - grand discount
    const grandTotal = afterSectionDiscounts - grandDiscountAmount;

    // Reference sidebar
    const focusedInputDef = focusedInputId
        ? inputDefinitions.find((i) => i.id === focusedInputId)
        : null;

    // Which categories to show at current level
    const displayChildren = currentCategoryId ? children : rootCategories;

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
                                            discountInput={discountInputs[charge.id] || ''}
                                            onDiscountChange={(val) => setDiscountInputs((prev) => ({ ...prev, [charge.id]: val }))}
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
                                            {/* Per-section discount deduction line */}
                                            {totalDiscountAmount > 0 && (
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-violet-600 font-medium flex items-center gap-1.5">
                                                        <Percent className="w-3 h-3" />
                                                        Discount
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

                                    {/* Grand Total */}
                                    <div className={`px-5 ${(activeCharges.length > 0 || extraCharges.some((ec) => parseFloat(ec.amount) > 0) || totalDiscountAmount > 0 || grandDiscountAmount > 0) ? 'pt-1 pb-4' : 'py-4'} flex items-center justify-between`}>
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

            {/* ═══ QUOTATION MODAL ═══ */}
            {
                showQuotationModal && currentCalc && mainResult && (() => {
                    // Build quotation line items — profit is merged into amounts
                    const items: QuotationLineItem[] = [];

                    // Main calculator
                    items.push({
                        label: currentCalc.name,
                        amount: mainResult.afterProfit,       // profit merged
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
                                amount: r.afterProfit,            // profit merged
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
    discountInput: string;
    onDiscountChange: (val: string) => void;
    onToggleCollapse?: () => void;
    onRemove?: () => void;
    onFocusInput: (id: string) => void;
    focusedInputId: string | null;
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

                                    {/* GST line */}
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

                                    {/* Discount input */}
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
                                                        −₹{(result.finalAmount * (discountVal / 100)).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Section total (only show when profit or GST is set or discount applied) */}
                                    {(profitPct > 0 || gstPct > 0 || discountValid) && (
                                        <div className="px-4 py-2 flex items-center justify-between border-t border-black/5">
                                            <span className="text-sm font-bold text-black/70">
                                                {label} Total
                                            </span>
                                            <span className="text-sm font-mono font-bold text-black">
                                                ₹{(discountValid && result
                                                    ? result.finalAmount * (1 - discountVal / 100)
                                                    : (result?.finalAmount || 0)
                                                ).toFixed(2)}
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
