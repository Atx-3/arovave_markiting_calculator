import { useState } from 'react';
import {
    Settings,
    FolderTree,
    Calculator,
    Layers,
    DollarSign,
    Plus,
    ChevronRight,
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

    const store = useAppStore();
    const {
        categories,
        createCalculator,
        getCalculatorForCategory,
        getCategoryBreadcrumb,
    } = store;

    const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
    const selectedCalc = selectedCategoryId ? getCalculatorForCategory(selectedCategoryId) : undefined;

    const handleSelectCategory = (id: string) => {
        setSelectedCategoryId(id);
        const calc = getCalculatorForCategory(id);
        if (calc) setActiveTab('calculator');
    };

    const breadcrumb = selectedCategoryId ? getCategoryBreadcrumb(selectedCategoryId) : [];

    const tabs: { key: Tab; label: string; icon: typeof FolderTree }[] = [
        { key: 'inputs', label: 'Input Hub', icon: Layers },
        { key: 'categories', label: 'Categories', icon: FolderTree },
        { key: 'calculator', label: 'Calculator', icon: Calculator },
        { key: 'rates', label: 'Rates', icon: DollarSign },
    ];

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

            {/* Selected category indicator (for calculator tab) */}
            {selectedCategory && (activeTab === 'calculator' || activeTab === 'categories') && (
                <div className="flex items-center gap-2 text-sm bg-black/[0.03] border border-black/10 rounded-2xl px-5 py-3">
                    <span className="text-black/50 font-semibold">Selected:</span>
                    {breadcrumb.map((cat, i) => (
                        <span key={cat.id} className="flex items-center gap-1.5">
                            {i > 0 && <ChevronRight className="w-3 h-3 text-black/30" />}
                            <span className={i === breadcrumb.length - 1 ? 'text-black font-bold' : 'text-black/60'}>
                                {cat.name}
                            </span>
                        </span>
                    ))}
                    {selectedCalc && <span className="text-black/40 text-xs ml-2">📊 has calculator</span>}
                </div>
            )}

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
                            onSelect={setSelectedCategoryId}
                        />

                        {!selectedCategoryId ? (
                            <div className="text-center py-12">
                                <FolderTree className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                <p className="text-black/40 text-base font-semibold">
                                    Pick a category above to build its calculator.
                                </p>
                            </div>
                        ) : selectedCalc ? (
                            <DragDropCalculatorBuilder calculatorId={selectedCalc.id} />
                        ) : (
                            <div className="text-center py-12">
                                <Calculator className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                <p className="text-black/40 text-base font-semibold mb-4">
                                    No calculator for "{selectedCategory?.name}" yet.
                                </p>
                                <button
                                    onClick={() => {
                                        if (selectedCategoryId && selectedCategory) {
                                            createCalculator(selectedCategoryId, selectedCategory.name);
                                        }
                                    }}
                                    className="btn-primary"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Calculator
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'rates' && <RateManager />}
            </div>
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
    const { categories, getCategoryChildren, getCategoryBreadcrumb } = useAppStore();

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
        <div className="space-y-3">
            {levels.map((level, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                    {i > 0 && (
                        <ChevronRight className="w-4 h-4 text-black/25 shrink-0" />
                    )}
                    {level.options.map((cat) => {
                        const isSelected = cat.id === level.selectedId;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => onSelect(cat.id)}
                                className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 ${isSelected
                                    ? 'bg-black text-white shadow-lg shadow-black/15'
                                    : 'bg-black/[0.04] text-black/60 hover:text-black hover:bg-black/[0.08]'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
