import { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Hash,
    List,
    Lock,
    GripVertical,
    Trophy,
    X,
    Calculator,
    Layers,
    Combine,
    Copy,
    Eye,
    EyeOff,
    Zap,
    AlertTriangle,
    Save,
    Check,
    Pencil,
    RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { FormulaToken, InputDefinition, InputType } from '../../types/calculator';

// ═══════════════════════════════════════════════════════════════════════
// TYPE ICONS & COLORS
// ═══════════════════════════════════════════════════════════════════════

const TYPE_ICON: Record<InputType, typeof Hash> = {
    number: Hash,
    dropdown: List,
    fixed: Lock,
};

const TYPE_COLOR: Record<InputType, string> = {
    number: 'bg-blue-50 text-blue-600 border-blue-200',
    dropdown: 'bg-purple-50 text-purple-600 border-purple-200',
    fixed: 'bg-amber-50 text-amber-600 border-amber-200',
};

const OPERATORS = [
    { symbol: '+', label: 'Add' },
    { symbol: '-', label: 'Subtract' },
    { symbol: '×', label: 'Multiply' },
    { symbol: '÷', label: 'Divide' },
    { symbol: '%', label: 'Percentage' },
];

const BRACKETS = [
    { symbol: '(', label: 'Open bracket' },
    { symbol: ')', label: 'Close bracket' },
];

// ═══════════════════════════════════════════════════════════════════════
// FORMULA EXPRESSION PREVIEW (human-readable)
// ═══════════════════════════════════════════════════════════════════════

function getFormulaPreview(tokens: FormulaToken[], inputDefs: InputDefinition[], allFormulas: { id: string; label: string }[]): string {
    if (tokens.length === 0) return '—';
    return tokens
        .map((t) => {
            if (t.type === 'input') {
                const def = inputDefs.find((d) => d.id === t.value);
                return def?.name || t.label || '?';
            }
            if (t.type === 'formula_ref') {
                const f = allFormulas.find((fm) => fm.id === t.value);
                return `[${f?.label || t.label || 'Formula'}]`;
            }
            if (t.type === 'number') return t.value;
            if (t.type === 'operator') return ` ${t.value} `;
            if (t.type === 'bracket') return t.value;
            return t.value;
        })
        .join('');
}

// ═══════════════════════════════════════════════════════════════════════
// DRAG-AND-DROP CALCULATOR BUILDER (Native HTML5 DnD)
// ═══════════════════════════════════════════════════════════════════════

export function DragDropCalculatorBuilder({ calculatorId }: { calculatorId: string }) {
    const store = useAppStore();
    const {
        inputDefinitions,
        calculators,
        addFormula,
        removeFormula,
        updateFormula,
        moveFormula,
        addUsedInput,
        insertFormulaToken,
        addLocalRate,
        removeLocalRate,
        updateLocalRate,
        updateCalculator,
    } = store;

    const calc = calculators.find((c) => c.id === calculatorId);
    if (!calc) return null;

    const sortedFormulas = [...calc.formulas].sort((a, b) => a.order - b.order);

    const [activeFormula, setActiveFormula] = useState<string | null>(
        sortedFormulas.length > 0 ? sortedFormulas[0].id : null,
    );
    const [dragOverFormula, setDragOverFormula] = useState(false);

    // ── Formula Save/Edit/Discard state ──
    // Track which formulas are currently in editing mode
    const [editingFormulaIds, setEditingFormulaIds] = useState<Set<string>>(
        () => new Set(), // Existing formulas start as saved (locked) on load
    );
    // Snapshot of tokens before editing (for discard)
    const [formulaSnapshots, setFormulaSnapshots] = useState<Record<string, FormulaToken[]>>({});
    // Discard confirmation state
    const [showDiscardConfirm, setShowDiscardConfirm] = useState<string | null>(null);

    // Determine if a formula is in editing mode
    const isFormulaEditing = (formulaId: string) => editingFormulaIds.has(formulaId);

    // Save a formula (lock it)
    const handleSaveFormula = (formulaId: string) => {
        setEditingFormulaIds((prev) => {
            const next = new Set(prev);
            next.delete(formulaId);
            return next;
        });
        // Clear snapshot
        setFormulaSnapshots((prev) => {
            const next = { ...prev };
            delete next[formulaId];
            return next;
        });
    };

    // Start editing a saved formula
    const handleStartEditing = (formulaId: string) => {
        // Snapshot current tokens
        const formula = calc.formulas.find((f) => f.id === formulaId);
        if (formula) {
            setFormulaSnapshots((prev) => ({
                ...prev,
                [formulaId]: [...formula.tokens],
            }));
        }
        setEditingFormulaIds((prev) => new Set(prev).add(formulaId));
        setActiveFormula(formulaId);
    };

    // Discard changes — restore snapshot
    const handleDiscardChanges = (formulaId: string) => {
        const snapshot = formulaSnapshots[formulaId];
        if (snapshot) {
            store.setFormulaTokens(calculatorId, formulaId, snapshot);
        }
        setEditingFormulaIds((prev) => {
            const next = new Set(prev);
            next.delete(formulaId);
            return next;
        });
        setFormulaSnapshots((prev) => {
            const next = { ...prev };
            delete next[formulaId];
            return next;
        });
        setShowDiscardConfirm(null);
    };

    // Drag an input to the formula canvas
    const handleDragStart = (e: React.DragEvent, inputId: string) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'input', id: inputId }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    // Drag a formula result to another formula
    const handleFormulaDragStart = (e: React.DragEvent, formulaId: string, formulaLabel: string) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'formula_ref', id: formulaId, label: formulaLabel }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverFormula(true);
    };

    const handleDragLeave = () => {
        setDragOverFormula(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverFormula(false);
        const raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;

        // Parse the drag payload — supports both new JSON format and legacy plain IDs
        let dragData: { type: string; id: string; label?: string };
        try {
            dragData = JSON.parse(raw);
        } catch {
            // Legacy fallback: treat as input ID
            dragData = { type: 'input', id: raw };
        }

        // Auto-create a formula if none exists or none is active
        let targetFormulaId = activeFormula;
        if (!targetFormulaId || !calc.formulas.find((f) => f.id === targetFormulaId)) {
            targetFormulaId = addFormula(calculatorId);
            setActiveFormula(targetFormulaId);
        }

        const currentCalc = useAppStore.getState().calculators.find((c) => c.id === calculatorId);
        const formula = currentCalc?.formulas.find((f) => f.id === targetFormulaId);
        if (!formula) return;

        let newToken: FormulaToken;

        if (dragData.type === 'formula_ref') {
            // Don't allow a formula to reference itself
            if (dragData.id === targetFormulaId) return;
            const refFormula = currentCalc?.formulas.find((f) => f.id === dragData.id);
            newToken = {
                type: 'formula_ref',
                value: dragData.id,
                label: refFormula?.label || dragData.label || 'Formula',
            };
        } else {
            // Input drag
            const input = inputDefinitions.find((i) => i.id === dragData.id);
            if (!input) return;
            addUsedInput(calculatorId, dragData.id);
            newToken = {
                type: 'input',
                value: dragData.id,
                label: input.name,
            };
        }

        store.setFormulaTokens(calculatorId, targetFormulaId, [...formula.tokens, newToken]);
    };

    const insertTokenInFormula = (formulaId: string, index: number, token: FormulaToken) => {
        const formula = calc.formulas.find((f) => f.id === formulaId);
        if (!formula) return;
        insertFormulaToken(calculatorId, formulaId, index, token);
    };

    const removeTokenFromFormula = (formulaId: string, index: number) => {
        const formula = calc.formulas.find((f) => f.id === formulaId);
        if (!formula) return;
        const newTokens = formula.tokens.filter((_, i) => i !== index);
        store.setFormulaTokens(calculatorId, formulaId, newTokens);
    };

    const handleAddFormula = () => {
        const id = addFormula(calculatorId);
        setActiveFormula(id);
        // New formulas start in editing mode
        setEditingFormulaIds((prev) => new Set(prev).add(id));
    };

    const handleDuplicateFormula = (formulaId: string) => {
        const formula = calc.formulas.find((f) => f.id === formulaId);
        if (!formula) return;
        const newId = addFormula(calculatorId);
        updateFormula(calculatorId, newId, {
            label: `${formula.label} (copy)`,
            isTotal: false,
        });
        store.setFormulaTokens(calculatorId, newId, [...formula.tokens]);
        setActiveFormula(newId);
        // Duplicated formulas start in editing mode
        setEditingFormulaIds((prev) => new Set(prev).add(newId));
    };

    return (
        <div className="flex gap-5 min-h-[500px]">
            {/* ─── Left Sidebar: Available Inputs ─── */}
            <div className="w-56 shrink-0 space-y-3">
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider px-1">
                    Available Inputs
                </h3>
                <p className="text-[11px] text-black/30 px-1">
                    Drag into formula or click to add
                </p>

                {inputDefinitions.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl bg-black/[0.02] border border-dashed border-black/10">
                        <Layers className="w-6 h-6 text-black/15 mx-auto mb-2" />
                        <p className="text-[11px] text-black/30 font-medium">
                            No inputs yet. Add them in the Input Hub tab.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                        {inputDefinitions
                            .sort((a, b) => a.order - b.order)
                            .map((input) => {
                                const Icon = TYPE_ICON[input.type];
                                const isUsed = calc.usedInputIds.includes(input.id);
                                return (
                                    <div
                                        key={input.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, input.id)}
                                        onClick={() => {
                                            // Auto-create formula if none active
                                            let targetId = activeFormula;
                                            if (!targetId || !calc.formulas.find((f) => f.id === targetId)) {
                                                targetId = addFormula(calculatorId);
                                                setActiveFormula(targetId);
                                            }
                                            addUsedInput(calculatorId, input.id);
                                            const targetFormula = calc.formulas.find((f) => f.id === targetId);
                                            insertTokenInFormula(targetId, targetFormula?.tokens.length || 0, {
                                                type: 'input',
                                                value: input.id,
                                                label: input.name,
                                            });
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all group select-none ${isUsed
                                            ? 'bg-blue-50/30 border-blue-200/40 hover:border-blue-300/60'
                                            : 'bg-white border-black/8 hover:border-black/15 hover:shadow-sm'
                                            }`}
                                    >
                                        <GripVertical className="w-3 h-3 text-black/15 group-hover:text-black/30 shrink-0" />
                                        <div className={`p-1 rounded-md border ${TYPE_COLOR[input.type]} shrink-0`}>
                                            <Icon className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs font-medium text-black truncate flex-1">{input.name}</span>
                                        {isUsed && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* Formula references */}
                {sortedFormulas.length > 1 && (
                    <>
                        <div className="h-px bg-black/5 my-3" />
                        <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider px-1">
                            Formula Results
                        </h3>
                        <p className="text-[11px] text-black/30 px-1">
                            Drag or click to use in another formula
                        </p>
                        <div className="space-y-1.5">
                            {sortedFormulas
                                .filter((f) => f.id !== activeFormula)
                                .map((f) => (
                                    <div
                                        key={f.id}
                                        draggable
                                        onDragStart={(e) => handleFormulaDragStart(e, f.id, f.label)}
                                        onClick={() => {
                                            if (!activeFormula) return;
                                            const targetFormula = calc.formulas.find((fm) => fm.id === activeFormula);
                                            insertTokenInFormula(activeFormula, targetFormula?.tokens.length || 0, {
                                                type: 'formula_ref',
                                                value: f.id,
                                                label: f.label,
                                            });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/50 hover:border-emerald-300 text-left transition-colors group cursor-grab active:cursor-grabbing select-none"
                                        title={`Drag or click to use result of ${f.label}`}
                                    >
                                        <GripVertical className="w-3 h-3 text-emerald-300 group-hover:text-emerald-500 shrink-0" />
                                        <Combine className="w-3 h-3 text-emerald-500 shrink-0" />
                                        <span className="text-xs font-medium text-emerald-700 truncate">
                                            {f.label}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </>
                )}
            </div>

            {/* ─── Center: Formula Canvas ─── */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider flex items-center gap-2">
                        Formulas
                        {sortedFormulas.length > 0 && (
                            <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded-full font-bold text-black/40">
                                {sortedFormulas.length}
                            </span>
                        )}
                    </h3>
                    <button
                        onClick={handleAddFormula}
                        className="text-xs text-black/40 hover:text-black font-semibold flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-xl hover:bg-black/[0.03]"
                        title="Add a new formula"
                    >
                        <Plus className="w-3 h-3" />
                        Add Formula
                    </button>
                </div>

                {sortedFormulas.length === 0 ? (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`text-center py-16 rounded-2xl border-2 border-dashed transition-colors ${dragOverFormula ? 'border-blue-300 bg-blue-50/30' : 'border-black/10'
                            }`}
                    >
                        <Calculator className="w-10 h-10 text-black/15 mx-auto mb-3" />
                        <p className="text-sm text-black/30 font-medium mb-1">
                            No formulas yet
                        </p>
                        <p className="text-xs text-black/20 mb-4 max-w-xs mx-auto">
                            Drag an input here to auto-create your first formula, or click the button below.
                        </p>
                        <button
                            onClick={handleAddFormula}
                            className="btn-primary !text-sm"
                            title="Add first formula"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add First Formula
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedFormulas.map((formula, idx) => (
                            <FormulaCard
                                key={formula.id}
                                calculatorId={calculatorId}
                                formula={formula}
                                index={idx}
                                totalFormulas={sortedFormulas.length}
                                isActive={activeFormula === formula.id}
                                isDragOver={activeFormula === formula.id && dragOverFormula}
                                isEditing={isFormulaEditing(formula.id)}
                                showDiscardConfirm={showDiscardConfirm === formula.id}
                                onActivate={() => setActiveFormula(formula.id)}
                                onRemove={() => {
                                    removeFormula(calculatorId, formula.id);
                                    setEditingFormulaIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(formula.id);
                                        return next;
                                    });
                                    if (activeFormula === formula.id) {
                                        setActiveFormula(
                                            sortedFormulas.find((f) => f.id !== formula.id)?.id || null,
                                        );
                                    }
                                }}
                                onDuplicate={() => handleDuplicateFormula(formula.id)}
                                onMove={(dir) => moveFormula(calculatorId, formula.id, dir)}
                                onUpdateLabel={(label) =>
                                    updateFormula(calculatorId, formula.id, { label })
                                }
                                onToggleTotal={() => {
                                    const newIsTotal = !formula.isTotal;
                                    sortedFormulas.forEach((f) => {
                                        if (f.isTotal && f.id !== formula.id) {
                                            updateFormula(calculatorId, f.id, { isTotal: false });
                                        }
                                    });
                                    updateFormula(calculatorId, formula.id, {
                                        isTotal: newIsTotal,
                                    });
                                }}
                                onToggleHidden={() =>
                                    updateFormula(calculatorId, formula.id, { hidden: !formula.hidden })
                                }
                                onInsertToken={(index, token) => insertTokenInFormula(formula.id, index, token)}
                                onRemoveToken={(tokenIdx) =>
                                    removeTokenFromFormula(formula.id, tokenIdx)
                                }
                                hasChanges={(() => {
                                    const snap = formulaSnapshots[formula.id];
                                    if (!snap) return formula.tokens.length > 0;
                                    if (snap.length !== formula.tokens.length) return true;
                                    return snap.some((t, i) => t.type !== formula.tokens[i]?.type || t.value !== formula.tokens[i]?.value);
                                })()}
                                onSaveFormula={() => handleSaveFormula(formula.id)}
                                onStartEditing={() => handleStartEditing(formula.id)}
                                onDiscardChanges={() => handleDiscardChanges(formula.id)}
                                onRequestDiscard={() => setShowDiscardConfirm(formula.id)}
                                onCancelDiscard={() => setShowDiscardConfirm(null)}
                                inputDefinitions={inputDefinitions}
                                allFormulas={sortedFormulas}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            />
                        ))}

                        {/* Quick "Add another" button after formulas list */}
                        <button
                            onClick={handleAddFormula}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-black/8 text-xs text-black/25 hover:text-black/50 hover:border-black/15 font-semibold transition-all"
                            title="Add another formula"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Another Formula
                        </button>

                        {/* Grand Total Selector — tab style */}
                        {sortedFormulas.length > 0 && (
                            <div className="mt-4 bg-white rounded-2xl border border-black/8 p-3">
                                <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider mb-2 px-1">
                                    🏆 Select Grand Total Formula
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {sortedFormulas.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => {
                                                // Exclusive: clear all, then set this one
                                                sortedFormulas.forEach((sf) => {
                                                    if (sf.isTotal && sf.id !== f.id) {
                                                        updateFormula(calculatorId, sf.id, { isTotal: false });
                                                    }
                                                });
                                                updateFormula(calculatorId, f.id, { isTotal: !f.isTotal });
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${f.isTotal
                                                ? 'bg-emerald-500 text-white shadow-md'
                                                : 'bg-black/[0.04] text-black/50 hover:bg-black/[0.08] hover:text-black/70'
                                                }`}
                                        >
                                            {f.isTotal ? '🏆 ' : ''}{f.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Profit % input */}
                                {sortedFormulas.some((f) => f.isTotal) && (
                                    <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-5 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] font-semibold text-black/40 shrink-0">
                                                Profit %
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={calc.profitPercent || ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./, '$1');
                                                        updateCalculator(calculatorId, { profitPercent: v });
                                                    }}
                                                    placeholder="0"
                                                    className="w-20 text-sm font-mono font-semibold text-black bg-black/[0.03] rounded-lg px-3 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-emerald-200 border border-black/5"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-black/30 font-bold">%</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] font-semibold text-black/40 shrink-0">
                                                GST %
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={calc.gstPercent || ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./, '$1');
                                                        updateCalculator(calculatorId, { gstPercent: v });
                                                    }}
                                                    placeholder="0"
                                                    className="w-20 text-sm font-mono font-semibold text-black bg-black/[0.03] rounded-lg px-3 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-blue-200 border border-black/5"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-black/30 font-bold">%</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-black/25">
                                            Applied on this calculator's subtotal
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// FORMULA CARD
// ═══════════════════════════════════════════════════════════════════════

function FormulaCard({
    calculatorId,
    formula,
    index,
    totalFormulas,
    isActive,
    isDragOver,
    isEditing,
    showDiscardConfirm,
    hasChanges,
    onActivate,
    onRemove,
    onDuplicate,
    onMove,
    onUpdateLabel,
    onToggleTotal,
    onToggleHidden,
    onInsertToken,
    onRemoveToken,
    onSaveFormula,
    onStartEditing,
    onDiscardChanges,
    onRequestDiscard,
    onCancelDiscard,
    inputDefinitions,
    allFormulas,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    calculatorId: string;
    formula: { id: string; label: string; tokens: FormulaToken[]; isTotal?: boolean; hidden?: boolean; order: number };
    index: number;
    totalFormulas: number;
    isActive: boolean;
    isDragOver: boolean;
    isEditing: boolean;
    showDiscardConfirm: boolean;
    hasChanges: boolean;
    onActivate: () => void;
    onRemove: () => void;
    onDuplicate: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onUpdateLabel: (label: string) => void;
    onToggleTotal: () => void;
    onToggleHidden: () => void;
    onInsertToken: (index: number, token: FormulaToken) => void;
    onRemoveToken: (index: number) => void;
    onSaveFormula: () => void;
    onStartEditing: () => void;
    onDiscardChanges: () => void;
    onRequestDiscard: () => void;
    onCancelDiscard: () => void;
    inputDefinitions: InputDefinition[];
    allFormulas: { id: string; label: string }[];
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
}) {
    const [showNumberInput, setShowNumberInput] = useState(false);
    const [numberValue, setNumberValue] = useState('');
    const [cursorIndex, setCursorIndex] = useState(formula.tokens.length);

    // Clamp cursor to valid range whenever tokens change
    useEffect(() => {
        if (cursorIndex > formula.tokens.length) {
            setCursorIndex(formula.tokens.length);
        }
    }, [formula.tokens.length, cursorIndex]);

    const getInputName = (id: string) => {
        const input = inputDefinitions.find((i) => i.id === id);
        return input?.name || 'Unknown';
    };

    // Insert at cursor and advance
    const insertAtCursor = (token: FormulaToken) => {
        const pos = Math.min(cursorIndex, formula.tokens.length);
        onInsertToken(pos, token);
        setCursorIndex(pos + 1);
    };

    const handleAddNumber = () => {
        if (numberValue) {
            insertAtCursor({ type: 'number', value: numberValue });
            setNumberValue('');
            setShowNumberInput(false);
        }
    };

    const handleRemoveToken = (idx: number) => {
        onRemoveToken(idx);
        if (cursorIndex > idx) {
            setCursorIndex(cursorIndex - 1);
        }
    };

    // Detect formulas that reference this formula
    const dependentFormulas = allFormulas.filter((f) =>
        f.id !== formula.id &&
        (useAppStore.getState().calculators
            .find((c) => c.id === calculatorId)
            ?.formulas.find((ff) => ff.id === f.id)
            ?.tokens.some((t) => t.type === 'formula_ref' && t.value === formula.id) ?? false)
    );

    const preview = getFormulaPreview(formula.tokens, inputDefinitions, allFormulas);

    // Is this formula saved (locked / read-only)?
    const isSaved = !isEditing;

    return (
        <div
            onClick={onActivate}
            className={`rounded-2xl border transition-all duration-300 ${isActive
                ? isEditing
                    ? `bg-white border-blue-300 shadow-lg shadow-blue-100/50 ring-2 ring-blue-200/50 ${isDragOver ? 'ring-blue-400/50 border-blue-400' : ''}`
                    : 'bg-white border-black/15 shadow-lg shadow-black/10'
                : isSaved
                    ? 'bg-white/80 border-emerald-200/50 hover:border-emerald-300 cursor-pointer'
                    : 'bg-white/60 border-black/6 hover:border-black/10 cursor-pointer'
                }`}
        >
            {/* Formula Header */}
            <div className="flex items-center gap-2 px-4 py-3">
                {/* Order number */}
                <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isActive
                    ? isEditing ? 'bg-blue-500 text-white' : 'bg-black text-white'
                    : isSaved ? 'bg-emerald-100 text-emerald-600' : 'bg-black/5 text-black/30'
                    }`}>{index + 1}</span>

                {/* Saved badge */}
                {isSaved && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">
                        <Check className="w-2.5 h-2.5" />
                        Saved
                    </span>
                )}

                {/* Editing badge */}
                {isEditing && isActive && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md shrink-0">
                        <Pencil className="w-2.5 h-2.5" />
                        Editing
                    </span>
                )}

                {/* Label */}
                {isEditing && isActive ? (
                    <input
                        type="text"
                        value={formula.label}
                        onChange={(e) => onUpdateLabel(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`flex-1 text-sm font-semibold bg-transparent outline-none min-w-0 ${formula.isTotal ? 'text-emerald-700' : 'text-black'}`}
                        placeholder="Formula name..."
                    />
                ) : (
                    <span className={`flex-1 text-sm font-semibold min-w-0 truncate ${formula.isTotal ? 'text-emerald-700' : 'text-black'}`}>
                        {formula.label || 'Unnamed formula'}
                    </span>
                )}

                {/* Expression Preview (when not active) */}
                {!isActive && formula.tokens.length > 0 && (
                    <span className="text-[11px] text-black/30 font-mono truncate max-w-[200px] shrink-0"
                        title={preview}>
                        {preview}
                    </span>
                )}

                {/* Hidden badge */}
                {formula.hidden && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">Hidden</span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                    {/* Edit button for saved formulas */}
                    {isSaved && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartEditing();
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                            title="Edit this formula"
                        >
                            <Pencil className="w-3 h-3" />
                            Edit
                        </button>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleHidden();
                        }}
                        className={`p-1 rounded transition-colors ${formula.hidden ? 'text-amber-500 hover:text-amber-600' : 'text-black/15 hover:text-black'}`}
                        title={formula.hidden ? 'Show on sales page' : 'Hide from sales page'}
                    >
                        {formula.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate();
                        }}
                        className="p-1 rounded text-black/15 hover:text-black transition-colors"
                        title="Duplicate formula"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMove('up');
                        }}
                        disabled={index === 0}
                        className="p-1 rounded text-black/15 hover:text-black transition-colors disabled:opacity-0"
                        title="Move up"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMove('down');
                        }}
                        disabled={index === totalFormulas - 1}
                        className="p-1 rounded text-black/15 hover:text-black transition-colors disabled:opacity-0"
                        title="Move down"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="p-1 rounded text-black/15 hover:text-red-500 transition-colors"
                        title="Delete formula"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ═══ SAVED (READ-ONLY) VIEW ═══ */}
            {isActive && isSaved && formula.tokens.length > 0 && (
                <div className="px-4 pb-4 animate-slide-up">
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                        <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[12px] text-emerald-700 font-mono truncate flex-1">
                            {formula.label} = {preview}
                        </span>
                    </div>
                </div>
            )}

            {/* ═══ EDITING VIEW ═══ */}
            {isActive && isEditing && (
                <div className="px-4 pb-4 space-y-3 animate-slide-up">
                    {/* Discard Confirmation Warning */}
                    {showDiscardConfirm && (
                        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-red-700">Discard all changes?</p>
                                    <p className="text-xs text-red-600/70 mt-0.5">
                                        This will revert the formula back to its last saved state. Any changes you've made will be permanently lost.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-6">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDiscardChanges(); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Yes, Discard Changes
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancelDiscard(); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/10 text-black/60 text-xs font-semibold hover:bg-black/[0.03] transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Dependency Warning */}
                    {dependentFormulas.length > 0 && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="text-[11px] leading-relaxed">
                                <strong>Warning:</strong> This formula is referenced by{' '}
                                {dependentFormulas.map((f, i) => (
                                    <span key={f.id}>
                                        {i > 0 && ', '}
                                        <strong>{f.label}</strong>
                                    </span>
                                ))}
                                . Changes will affect those calculations.
                            </span>
                        </div>
                    )}

                    {/* Formula expression preview */}
                    {formula.tokens.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50/50 to-transparent border border-blue-100/50">
                            <Eye className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="text-[11px] text-blue-600/60 font-mono truncate">
                                {formula.label} = {preview}
                            </span>
                        </div>
                    )}

                    {/* Token Chain / Drop Zone — with clickable cursor gaps */}
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={`min-h-[56px] rounded-xl border-2 border-dashed p-3 flex flex-wrap items-center gap-0 transition-colors ${isDragOver
                            ? 'border-blue-300 bg-blue-50/30'
                            : formula.tokens.length === 0
                                ? 'border-blue-200/60 bg-blue-50/20'
                                : 'border-blue-200/40 bg-blue-50/10'
                            }`}
                    >
                        {formula.tokens.length === 0 ? (
                            <span
                                className="text-xs text-blue-400/50 italic flex items-center gap-2 w-full cursor-text"
                                onClick={() => setCursorIndex(0)}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Click here, then use buttons below to build your formula...
                            </span>
                        ) : (
                            <>
                                {/* Render gap slots + tokens with cursor */}
                                {formula.tokens.map((token, idx) => (
                                    <span key={idx} className="inline-flex items-center">
                                        {/* Gap slot BEFORE this token */}
                                        <span
                                            onClick={(e) => { e.stopPropagation(); setCursorIndex(idx); }}
                                            className={`w-1 self-stretch min-h-[28px] rounded-sm cursor-text transition-all mx-0.5 ${cursorIndex === idx
                                                ? 'bg-blue-500 animate-pulse w-[3px]'
                                                : 'hover:bg-blue-300 hover:w-[3px]'
                                                }`}
                                            title="Click to place cursor here"
                                        />
                                        <TokenChip
                                            token={token}
                                            onRemove={() => handleRemoveToken(idx)}
                                            getInputName={getInputName}
                                        />
                                    </span>
                                ))}
                                {/* Gap slot AFTER last token */}
                                <span
                                    onClick={(e) => { e.stopPropagation(); setCursorIndex(formula.tokens.length); }}
                                    className={`w-1 self-stretch min-h-[28px] rounded-sm cursor-text transition-all mx-0.5 flex-1 min-w-[12px] ${cursorIndex === formula.tokens.length
                                        ? 'bg-blue-500 animate-pulse w-[3px] flex-initial'
                                        : 'hover:bg-blue-300 hover:w-[3px]'
                                        }`}
                                    title="Click to place cursor at end"
                                />
                            </>
                        )}
                    </div>

                    {/* Operator + Bracket Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Operators */}
                        <div className="flex items-center gap-1 bg-black/[0.02] rounded-xl p-1">
                            {OPERATORS.map((op) => (
                                <button
                                    key={op.symbol}
                                    onClick={() =>
                                        insertAtCursor({ type: 'operator', value: op.symbol })
                                    }
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-black/50 hover:text-black hover:bg-white hover:shadow-sm transition-all"
                                    title={op.label}
                                >
                                    {op.symbol}
                                </button>
                            ))}
                        </div>

                        {/* Brackets */}
                        <div className="flex items-center gap-1 bg-black/[0.02] rounded-xl p-1">
                            {BRACKETS.map((b) => (
                                <button
                                    key={b.symbol}
                                    onClick={() =>
                                        insertAtCursor({ type: 'bracket', value: b.symbol })
                                    }
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-black/40 hover:text-black hover:bg-white hover:shadow-sm transition-all"
                                    title={b.label}
                                >
                                    {b.symbol}
                                </button>
                            ))}
                        </div>

                        {/* Number */}
                        {showNumberInput ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={numberValue}
                                    onChange={(e) => setNumberValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddNumber();
                                        if (e.key === 'Escape') setShowNumberInput(false);
                                    }}
                                    autoFocus
                                    placeholder="0"
                                    title="Enter a number"
                                    className="w-16 text-sm font-mono text-black bg-white border border-black/15 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-black/10"
                                />
                                <button
                                    onClick={handleAddNumber}
                                    className="p-1.5 rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
                                    title="Add number"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setShowNumberInput(false)}
                                    className="p-1.5 rounded-lg text-black/30 hover:text-black transition-colors"
                                    title="Cancel"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNumberInput(true)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-black/40 hover:text-black hover:bg-black/[0.03] transition-colors"
                                title="Add a number value"
                            >
                                <Hash className="w-3 h-3" />
                                Number
                            </button>
                        )}

                        {/* Quick-add inputs */}
                        {inputDefinitions.length > 0 && (
                            <div className="flex items-center gap-1 ml-auto">
                                <span className="text-[10px] text-black/20 mr-1">Quick:</span>
                                {inputDefinitions.slice(0, 3).map((input) => (
                                    <button
                                        key={input.id}
                                        onClick={() => {
                                            addUsedInput(calculatorId, input.id);
                                            insertAtCursor({
                                                type: 'input',
                                                value: input.id,
                                                label: input.name,
                                            });
                                        }}
                                        className="px-2 py-1 rounded-lg text-[10px] font-medium text-black/30 hover:text-black hover:bg-black/[0.03] transition-colors truncate max-w-[80px]"
                                        title={`Add ${input.name}`}
                                    >
                                        {input.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ═══ SAVE / DISCARD BUTTONS ═══ */}
                    <div className="flex items-center gap-2 pt-2 border-t border-blue-100">
                        {hasChanges ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSaveFormula(); }}
                                    disabled={formula.tokens.length === 0}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-200"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Save Changes
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRequestDiscard(); }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-all"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Discard Changes
                                </button>
                            </>
                        ) : (
                            <span className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-500">
                                <Check className="w-3.5 h-3.5" />
                                Already saved — no changes made
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// We need access to addUsedInput inside FormulaCard's quick buttons
function addUsedInput(calcId: string, inputId: string) {
    useAppStore.getState().addUsedInput(calcId, inputId);
}

// ═══════════════════════════════════════════════════════════════════════
// TOKEN CHIP — Visual token in formula
// ═══════════════════════════════════════════════════════════════════════

function TokenChip({
    token,
    onRemove,
    getInputName,
}: {
    token: FormulaToken;
    onRemove: () => void;
    getInputName: (id: string) => string;
}) {
    if (token.type === 'operator') {
        return (
            <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-b from-black/5 to-black/10 text-sm font-bold text-black/60 cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors group"
                onClick={onRemove}
                title={`Remove ${token.value}`}
            >
                {token.value}
            </span>
        );
    }

    if (token.type === 'bracket') {
        return (
            <span
                className="inline-flex items-center justify-center w-6 h-7 rounded-md text-lg font-bold text-black/30 cursor-pointer hover:text-red-500 transition-colors"
                onClick={onRemove}
                title={`Remove bracket ${token.value}`}
            >
                {token.value}
            </span>
        );
    }

    if (token.type === 'number') {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-mono font-semibold text-gray-700 cursor-pointer hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors group"
                onClick={onRemove}
                title={`Remove number ${token.value}`}
            >
                {token.value}
                <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
        );
    }

    if (token.type === 'formula_ref') {
        return (
            <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 cursor-pointer hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors group"
                onClick={onRemove}
                title={`Remove formula reference ${token.label || ''}`}
            >
                <Combine className="w-3 h-3" />
                {token.label || 'Formula'}
                <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
        );
    }

    // Input token
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 cursor-pointer hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors group"
            onClick={onRemove}
            title={`Remove ${getInputName(token.value)}`}
        >
            {token.label || getInputName(token.value)}
            <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
    );
}
