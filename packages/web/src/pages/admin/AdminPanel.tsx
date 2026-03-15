import { useState } from 'react';
import {
    Settings,
    FolderTree,
    Calculator,
    Layers,
    DollarSign,
    Plus,
    ChevronRight,
    Pencil,
    Trash2,
    Check,
    X,
    AlertTriangle,
    Copy,
    ClipboardCheck,
    MoreHorizontal,
    Percent,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import { CategoryTree } from '../../components/admin/CategoryTree';
import { InputHub } from '../../components/admin/InputHub';
import { DragDropCalculatorBuilder } from '../../components/admin/DragDropCalculatorBuilder';
import { RateManager } from '../../components/admin/RateManager';

type Tab = 'inputs' | 'categories' | 'calculator' | 'rates';

export function AdminPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('inputs');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
    const [editingCalcName, setEditingCalcName] = useState(false);
    const [calcNameDraft, setCalcNameDraft] = useState('');
    const [showDeleteCalcModal, setShowDeleteCalcModal] = useState(false);
    const [showCalcActions, setShowCalcActions] = useState<string | null>(null);
    const [copiedCalcId, setCopiedCalcId] = useState<string | null>(null);

    const store = useAppStore();
    const {
        categories,
        calculators,
        createCalculator,
        deleteCalculator,
        duplicateCalculator,
        getCalculatorsForCategory,
        getCategoryBreadcrumb,
    } = store;

    const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
    const categoryCalcs = selectedCategoryId ? getCalculatorsForCategory(selectedCategoryId) : [];
    const selectedCalc = selectedCalcId ? calculators.find((c) => c.id === selectedCalcId) : undefined;
    const copiedCalc = copiedCalcId ? calculators.find((c) => c.id === copiedCalcId) : undefined;

    const handleSelectCategory = (id: string) => {
        setSelectedCategoryId(id);
        const calcs = getCalculatorsForCategory(id);
        if (calcs.length > 0) {
            setSelectedCalcId(calcs[0].id);
            setActiveTab('calculator');
        } else {
            setSelectedCalcId(null);
        }
    };

    const handleCreateCalculator = () => {
        if (!selectedCategoryId || !selectedCategory) return;
        const calcNum = categoryCalcs.length + 1;
        const name = calcNum === 1 ? selectedCategory.name : `${selectedCategory.name} ${calcNum}`;
        const newId = createCalculator(selectedCategoryId, name);
        setSelectedCalcId(newId);
    };

    const handleDuplicateCalc = (calcId: string) => {
        const calc = calculators.find((c) => c.id === calcId);
        if (!calc || !selectedCategoryId) return;
        const newId = createCalculator(selectedCategoryId, `${calc.name} (copy)`);
        // Copy formulas, local rates, used inputs
        const newCalc = calculators.find((c) => c.id === newId);
        if (newCalc) {
            store.updateCalculator(newId, {
                formulas: calc.formulas.map((f) => ({
                    ...f,
                    id: crypto.randomUUID(),
                })),
                localRates: calc.localRates.map((r) => ({
                    ...r,
                    id: crypto.randomUUID(),
                })),
                usedInputIds: [...calc.usedInputIds],
            });
        }
        setSelectedCalcId(newId);
        setShowCalcActions(null);
    };

    const breadcrumb = selectedCategoryId ? getCategoryBreadcrumb(selectedCategoryId) : [];

    // Stats
    const totalInputs = store.inputDefinitions.length;
    const totalCalcs = calculators.filter((c) => !c.isCharge).length;

    const tabs: { key: Tab; label: string; icon: typeof FolderTree; badge?: number }[] = [
        { key: 'inputs', label: 'Input Hub', icon: Layers, badge: totalInputs },
        { key: 'categories', label: 'Categories', icon: FolderTree },
        { key: 'calculator', label: 'Calculator', icon: Calculator, badge: totalCalcs },
        { key: 'rates', label: 'Rates', icon: DollarSign },
    ];

    // Calculator rename
    const startCalcRename = () => {
        if (!selectedCalc) return;
        setCalcNameDraft(selectedCalc.name);
        setEditingCalcName(true);
    };
    const commitCalcRename = () => {
        if (selectedCalc && calcNameDraft.trim()) {
            store.updateCalculator(selectedCalc.id, { name: calcNameDraft.trim() });
        }
        setEditingCalcName(false);
    };

    return (
        <div className="space-y-8 animate-slide-up">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-black flex items-center gap-3 tracking-tight">
                    <Settings className="w-7 h-7 text-black/40" />
                    Admin Panel
                </h1>
                <p className="mt-2 text-base text-black/50">
                    Define inputs centrally, build calculators with drag-and-drop, manage rates from one place.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-black/[0.03] p-1.5 rounded-2xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === tab.key
                                ? 'bg-white text-black shadow-md shadow-black/5'
                                : 'text-black/40 hover:text-black/70'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            {tab.badge && tab.badge > 0 ? (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-black text-white' : 'bg-black/10 text-black/50'
                                    }`}>
                                    {tab.badge}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="liquid-glass rounded-2xl p-6 min-h-[400px]">
                {activeTab === 'inputs' && <InputHub />}

                {activeTab === 'categories' && (
                    <CategoryTree
                        onSelectCategory={handleSelectCategory}
                        selectedCategoryId={selectedCategoryId}
                    />
                )}

                {activeTab === 'calculator' && (
                    <div className="space-y-5">
                        {/* Cascading category selector */}
                        <CascadingCategorySelector
                            selectedCategoryId={selectedCategoryId}
                            onSelect={(id) => {
                                setSelectedCategoryId(id);
                                if (id) {
                                    const calcs = getCalculatorsForCategory(id);
                                    setSelectedCalcId(calcs.length > 0 ? calcs[0].id : null);
                                } else {
                                    setSelectedCalcId(null);
                                }
                            }}
                        />

                        {!selectedCategoryId ? (
                            <div className="text-center py-12">
                                <FolderTree className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                <p className="text-black/40 text-base font-semibold">
                                    Pick a category above to build its calculator.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Calculator List Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-sm font-bold text-black/50 uppercase tracking-wider">
                                            Calculators
                                        </h2>
                                        {categoryCalcs.length > 0 && (
                                            <span className="text-[10px] bg-black/5 px-2 py-0.5 rounded-full font-bold text-black/40">
                                                {categoryCalcs.length}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Clipboard indicator + Paste button */}
                                {copiedCalc && (
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 animate-slide-up">
                                        <div className="flex items-center gap-2 text-xs text-blue-700">
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>
                                                <strong>"{copiedCalc.name}"</strong> copied
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedCategoryId && (
                                                <button
                                                    onClick={() => {
                                                        const newId = duplicateCalculator(copiedCalcId!, selectedCategoryId);
                                                        if (newId) {
                                                            setSelectedCalcId(newId);
                                                            setCopiedCalcId(null);
                                                        }
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                                                >
                                                    <ClipboardCheck className="w-3 h-3" />
                                                    Paste Here
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setCopiedCalcId(null)}
                                                className="p-1 rounded-md text-blue-400 hover:text-blue-700 transition-colors"
                                                title="Cancel copy"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Calculator Tabs (when multiple exist) */}
                                {categoryCalcs.length > 0 && (
                                    <div className="flex items-center gap-2.5 flex-wrap p-1 bg-black/[0.02] rounded-2xl">
                                        {categoryCalcs.map((calc) => (
                                            <div key={calc.id} className="relative group">
                                                <button
                                                    onClick={() => setSelectedCalcId(calc.id)}
                                                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${selectedCalcId === calc.id
                                                        ? 'bg-black text-white shadow-lg shadow-black/15'
                                                        : 'text-black/50 hover:text-black hover:bg-white/80'
                                                        }`}
                                                >
                                                    <Calculator className="w-3.5 h-3.5" />
                                                    {calc.name}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedCalcId === calc.id
                                                        ? 'bg-white/20 text-white/80'
                                                        : 'bg-black/5 text-black/30'
                                                        }`}>
                                                        {calc.formulas.length}f
                                                    </span>
                                                </button>

                                                {/* Quick actions on hover */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowCalcActions(showCalcActions === calc.id ? null : calc.id);
                                                    }}
                                                    className={`absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white border border-black/10 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/5 ${showCalcActions === calc.id ? '!opacity-100' : ''
                                                        }`}
                                                    title="Calculator actions"
                                                >
                                                    <MoreHorizontal className="w-3 h-3 text-black/40" />
                                                </button>

                                                {showCalcActions === calc.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowCalcActions(null)} />
                                                        <div className="absolute top-full right-0 mt-1 z-50 bg-white rounded-xl shadow-xl shadow-black/10 border border-black/8 p-1 min-w-[140px] animate-slide-up">
                                                            <button
                                                                onClick={() => {
                                                                    setCopiedCalcId(calc.id);
                                                                    setShowCalcActions(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-black/60 hover:text-black hover:bg-black/[0.03] transition-colors"
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                                Copy
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedCalcId(calc.id);
                                                                    setShowCalcActions(null);
                                                                    setShowDeleteCalcModal(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Selected Calculator Builder */}
                                {selectedCalc ? (
                                    <div className="space-y-4">
                                        {/* Calculator header with name + actions */}
                                        <div className="flex items-center justify-between bg-gradient-to-r from-black/[0.03] to-transparent rounded-2xl px-5 py-3.5 border border-black/5">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Calculator className="w-5 h-5 text-black/40 shrink-0" />
                                                {editingCalcName ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={calcNameDraft}
                                                            onChange={(e) => setCalcNameDraft(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') commitCalcRename();
                                                                if (e.key === 'Escape') setEditingCalcName(false);
                                                            }}
                                                            autoFocus
                                                            placeholder="Calculator name..."
                                                            title="Calculator name"
                                                            className="text-lg font-bold text-black bg-white border border-black/15 rounded-xl px-3 py-1 outline-none focus:ring-2 focus:ring-black/10 w-64"
                                                        />
                                                        <button
                                                            onClick={commitCalcRename}
                                                            className="p-1.5 rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
                                                            title="Save name"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingCalcName(false)}
                                                            className="p-1.5 rounded-lg text-black/30 hover:text-black transition-colors"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <h2 className="text-lg font-bold text-black truncate">{selectedCalc.name}</h2>
                                                        <button
                                                            onClick={startCalcRename}
                                                            className="p-1 rounded-md text-black/20 hover:text-black hover:bg-black/5 transition-colors"
                                                            title="Rename calculator"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0">
                                                {/* Breadcrumb */}
                                                <div className="flex items-center gap-1 text-xs text-black/40">
                                                    {breadcrumb.map((cat, i) => (
                                                        <span key={cat.id} className="flex items-center gap-1">
                                                            {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-black/20" />}
                                                            <span className={i === breadcrumb.length - 1 ? 'text-black/60 font-semibold' : ''}>
                                                                {cat.name}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Stats */}
                                                <div className="flex items-center gap-3 text-xs text-black/30 border-l border-black/10 pl-3">
                                                    <span>{selectedCalc.formulas.length} formulas</span>
                                                    <span>{selectedCalc.usedInputIds.length} inputs</span>
                                                </div>

                                                {/* Copy */}
                                                <button
                                                    onClick={() => setCopiedCalcId(selectedCalc.id)}
                                                    className="p-1.5 rounded-lg text-black/15 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                    title="Copy calculator"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => setShowDeleteCalcModal(true)}
                                                    className="p-1.5 rounded-lg text-black/15 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Delete calculator"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Duplicate name warning */}
                                        {(() => {
                                            const dupeCalcName = calculators.some((c) => c.id !== selectedCalc.id && !c.isCharge && c.name === selectedCalc.name);
                                            // Find formula labels that exist in other calculators
                                            const otherFormulaLabels = new Set(
                                                calculators
                                                    .filter((c) => c.id !== selectedCalc.id && !c.isCharge)
                                                    .flatMap((c) => c.formulas.map((f) => f.label.toLowerCase()))
                                            );
                                            const dupeFormulaLabels = selectedCalc.formulas
                                                .filter((f) => f.label && otherFormulaLabels.has(f.label.toLowerCase()))
                                                .map((f) => f.label);

                                            if (!dupeCalcName && dupeFormulaLabels.length === 0) return null;

                                            return (
                                                <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1.5">
                                                    <div className="flex items-center gap-2 font-semibold">
                                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                                        Rename required — duplicate names detected
                                                    </div>
                                                    <ul className="list-disc list-inside ml-6 space-y-0.5 text-amber-700">
                                                        {dupeCalcName && (
                                                            <li>Calculator name <strong>"{selectedCalc.name}"</strong> is already used by another calculator</li>
                                                        )}
                                                        {dupeFormulaLabels.map((label) => (
                                                            <li key={label}>Formula <strong>"{label}"</strong> has the same name in another calculator</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            );
                                        })()}

                                        {/* Builder */}
                                        <DragDropCalculatorBuilder calculatorId={selectedCalc.id} />

                                        {/* ═══ Additional Charges ═══ */}
                                        <AdditionalChargesSection parentCalcId={selectedCalc.id} />
                                    </div>
                                ) : categoryCalcs.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Calculator className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                        <p className="text-black/40 text-base font-semibold mb-1">
                                            No calculator for "{selectedCategory?.name}" yet.
                                        </p>
                                        <p className="text-sm text-black/30 mb-5 max-w-sm mx-auto">
                                            Create a calculator with multiple formulas to define how costs are computed.
                                        </p>
                                        <button
                                            onClick={handleCreateCalculator}
                                            className="btn-primary"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Create Calculator
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-black/30">Select a calculator above to start editing.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'rates' && <RateManager />}
            </div>

            {/* Delete calculator modal */}
            {showDeleteCalcModal && selectedCalc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4 animate-slide-up">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-red-50">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-black">Delete "{selectedCalc.name}"?</h3>
                                <p className="text-sm text-black/50 mt-0.5">
                                    This will remove the calculator and all its {selectedCalc.formulas.length} formulas permanently.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowDeleteCalcModal(false)}
                                className="px-4 py-2 text-sm text-black/50 hover:text-black font-semibold rounded-xl hover:bg-black/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const calcId = selectedCalc.id;
                                    deleteCalculator(calcId);
                                    setShowDeleteCalcModal(false);
                                    // Select next available calc
                                    const remaining = categoryCalcs.filter((c) => c.id !== calcId);
                                    setSelectedCalcId(remaining.length > 0 ? remaining[0].id : null);
                                }}
                                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 font-semibold rounded-xl transition-colors"
                            >
                                Delete Calculator
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// CASCADING CATEGORY SELECTOR
// ═══════════════════════════════════════════════════════════════════════

function CascadingCategorySelector({
    selectedCategoryId,
    onSelect,
}: {
    selectedCategoryId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const { categories, getCategoryChildren, getCategoryBreadcrumb, getCalculatorsForCategory } = useAppStore();

    const breadcrumb = selectedCategoryId ? getCategoryBreadcrumb(selectedCategoryId) : [];

    const rootCategories = categories
        .filter((c) => c.parentId === null)
        .sort((a, b) => a.order - b.order);

    const levels: { options: typeof categories; selectedId: string | null }[] = [];

    levels.push({
        options: rootCategories,
        selectedId: breadcrumb.length > 0 ? breadcrumb[0].id : null,
    });

    for (let i = 0; i < breadcrumb.length; i++) {
        const children = getCategoryChildren(breadcrumb[i].id);
        if (children.length > 0) {
            levels.push({
                options: children,
                selectedId: i + 1 < breadcrumb.length ? breadcrumb[i + 1].id : null,
            });
        }
    }

    if (rootCategories.length === 0) {
        return (
            <div className="text-center py-5 rounded-2xl bg-black/[0.02] border border-dashed border-black/10">
                <p className="text-sm text-black/40 font-semibold">No categories yet. Create them in the Categories tab first.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {levels.map((level, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                    {i > 0 && (
                        <ChevronRight className="w-4 h-4 text-black/25 shrink-0" />
                    )}
                    {level.options.map((cat) => {
                        const isSelected = cat.id === level.selectedId;
                        const calcCount = getCalculatorsForCategory(cat.id).length;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => onSelect(cat.id)}
                                className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${isSelected
                                    ? 'bg-black text-white shadow-lg shadow-black/15'
                                    : 'bg-black/[0.04] text-black/60 hover:text-black hover:bg-black/[0.08]'
                                    }`}
                            >
                                {cat.name}
                                {calcCount > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isSelected ? 'bg-white/20 text-white/80' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {calcCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// ADDITIONAL CHARGES SECTION
// ═══════════════════════════════════════════════════════════════════════

function AdditionalChargesSection({ parentCalcId }: { parentCalcId: string }) {
    const store = useAppStore();
    const {
        createCharge,
        getChargesForCalculator,
        deleteCalculator,
        updateCalculator,
    } = store;

    const charges = getChargesForCalculator(parentCalcId);
    const parentCalc = store.calculators.find((c) => c.id === parentCalcId);

    const [expandedChargeId, setExpandedChargeId] = useState<string | null>(null);
    const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
    const [chargeNameDraft, setChargeNameDraft] = useState('');
    const [showNewChargeInput, setShowNewChargeInput] = useState(false);
    const [newChargeName, setNewChargeName] = useState('');

    const handleAddCharge = () => {
        if (!newChargeName.trim()) return;
        const id = createCharge(parentCalcId, newChargeName.trim());
        setNewChargeName('');
        setShowNewChargeInput(false);
        if (id) setExpandedChargeId(id);
    };

    const handleStartRename = (charge: { id: string; name: string }) => {
        setEditingChargeId(charge.id);
        setChargeNameDraft(charge.name);
    };

    const handleCommitRename = (chargeId: string) => {
        if (chargeNameDraft.trim()) {
            updateCalculator(chargeId, { name: chargeNameDraft.trim() });
        }
        setEditingChargeId(null);
    };

    return (
        <div className="mt-6 space-y-3">
            {/* Charge list */}
            {charges.map((charge) => {
                const isExpanded = expandedChargeId === charge.id;
                const isEditing = editingChargeId === charge.id;

                return (
                    <div
                        key={charge.id}
                        className={`rounded-2xl border transition-all ${isExpanded
                            ? 'border-blue-200/60 bg-blue-50/20 shadow-md'
                            : 'border-black/8 bg-white hover:border-black/12'
                            }`}
                    >
                        {/* Charge header */}
                        <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => setExpandedChargeId(isExpanded ? null : charge.id)}
                        >
                            <div className="p-1 rounded-md bg-blue-100 text-blue-600">
                                <Calculator className="w-3 h-3" />
                            </div>

                            {isEditing ? (
                                <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={chargeNameDraft}
                                        onChange={(e) => setChargeNameDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCommitRename(charge.id);
                                            if (e.key === 'Escape') setEditingChargeId(null);
                                        }}
                                        autoFocus
                                        placeholder="Charge name..."
                                        title="Rename charge"
                                        className="flex-1 text-sm font-semibold text-black bg-white border border-black/15 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                    <button
                                        onClick={() => handleCommitRename(charge.id)}
                                        className="p-1 rounded bg-black text-white hover:bg-black/80 transition-colors"
                                        title="Save"
                                    >
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => setEditingChargeId(null)}
                                        className="p-1 rounded text-black/30 hover:text-black transition-colors"
                                        title="Cancel"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <span className="text-sm font-semibold text-black flex-1 truncate">{charge.name}</span>
                            )}

                            <span className="text-[10px] text-black/30 font-mono">
                                {charge.formulas.length}f · {charge.usedInputIds.length}i
                            </span>

                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => handleStartRename(charge)}
                                    className="p-1 rounded text-black/15 hover:text-black transition-colors"
                                    title="Rename"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => deleteCalculator(charge.id)}
                                    className="p-1 rounded text-black/15 hover:text-red-500 transition-colors"
                                    title="Delete charge"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>

                            {isExpanded ? (
                                <ChevronRight className="w-3.5 h-3.5 text-black/20 rotate-90 transition-transform" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-black/20 transition-transform" />
                            )}
                        </div>

                        {/* Expanded: show formula builder for this charge */}
                        {isExpanded && (
                            <div className="px-4 pb-4 border-t border-black/5 animate-slide-up">
                                <DragDropCalculatorBuilder calculatorId={charge.id} />
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Add charge button / inline name input */}
            {showNewChargeInput ? (
                <div className="flex items-center gap-2 rounded-2xl p-3 border border-dashed border-blue-300 bg-blue-50/30 animate-slide-up">
                    <Plus className="w-4 h-4 text-blue-400 shrink-0" />
                    <input
                        type="text"
                        value={newChargeName}
                        onChange={(e) => setNewChargeName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCharge();
                            if (e.key === 'Escape') { setShowNewChargeInput(false); setNewChargeName(''); }
                        }}
                        autoFocus
                        placeholder="Enter charge name (e.g. Installation, Accessories)..."
                        title="New charge name"
                        className="flex-1 text-sm text-black bg-transparent outline-none placeholder:text-black/30"
                    />
                    <button
                        onClick={handleAddCharge}
                        disabled={!newChargeName.trim()}
                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-black/10 disabled:text-black/30 rounded-lg transition-colors"
                        title="Create charge"
                    >
                        Add
                    </button>
                    <button
                        onClick={() => { setShowNewChargeInput(false); setNewChargeName(''); }}
                        className="p-1 rounded text-black/30 hover:text-black transition-colors"
                        title="Cancel"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowNewChargeInput(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-black/10 hover:border-blue-300 hover:bg-blue-50/30 text-black/30 hover:text-blue-500 transition-all group"
                    title="Add other charges"
                >
                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Add Other Charges</span>
                </button>
            )}

            {/* Grand Total Discount Config — after all charges */}
            {parentCalc && (
                <div className="mt-4 rounded-2xl border border-teal-200/60 bg-teal-50/20 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={parentCalc.enableGrandDiscount || false}
                                onChange={(e) => updateCalculator(parentCalcId, { enableGrandDiscount: e.target.checked })}
                                className="w-4 h-4 rounded border-black/20 text-teal-500 focus:ring-teal-300 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
                                <Percent className="w-3 h-3" />
                                Allow Grand Total Discount
                            </span>
                        </label>
                        {parentCalc.enableGrandDiscount && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-teal-500 bg-teal-50 px-1.5 py-0.5 rounded-md">Active</span>
                        )}
                    </div>
                    {parentCalc.enableGrandDiscount && (
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-black/40 font-semibold">Min</span>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={parentCalc.grandDiscountMinPercent || ''}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./, '$1');
                                            updateCalculator(parentCalcId, { grandDiscountMinPercent: v });
                                        }}
                                        placeholder="0"
                                        className="w-16 text-sm font-mono font-semibold text-black bg-white rounded-lg px-2.5 py-1.5 pr-6 outline-none focus:ring-2 focus:ring-teal-200 border border-teal-200/60"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-black/30 font-bold">%</span>
                                </div>
                            </div>
                            <span className="text-black/20 text-xs font-bold">to</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-black/40 font-semibold">Max</span>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={parentCalc.grandDiscountMaxPercent || ''}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./, '$1');
                                            updateCalculator(parentCalcId, { grandDiscountMaxPercent: v });
                                        }}
                                        placeholder="10"
                                        className="w-16 text-sm font-mono font-semibold text-black bg-white rounded-lg px-2.5 py-1.5 pr-6 outline-none focus:ring-2 focus:ring-teal-200 border border-teal-200/60"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-black/30 font-bold">%</span>
                                </div>
                            </div>
                            <span className="text-[10px] text-teal-600/70">
                                Discount on combined grand total of all charges
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

