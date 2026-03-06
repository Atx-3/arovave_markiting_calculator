import { useState, useRef } from 'react';
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
// DRAG-AND-DROP CALCULATOR BUILDER  (Native HTML5 DnD — no libs needed)
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
        addLocalRate,
        removeLocalRate,
        updateLocalRate,
    } = store;

    const calc = calculators.find((c) => c.id === calculatorId);
    if (!calc) return null;

    const sortedFormulas = [...calc.formulas].sort((a, b) => a.order - b.order);

    const [activeFormula, setActiveFormula] = useState<string | null>(
        sortedFormulas.length > 0 ? sortedFormulas[0].id : null,
    );
    const [dragOverFormula, setDragOverFormula] = useState(false);

    // Drag an input to the formula canvas
    const handleDragStart = (e: React.DragEvent, inputId: string) => {
        e.dataTransfer.setData('text/plain', inputId);
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
        const inputId = e.dataTransfer.getData('text/plain');
        if (!inputId || !activeFormula) return;

        const input = inputDefinitions.find((i) => i.id === inputId);
        if (!input) return;

        // Add to used inputs if not already
        addUsedInput(calculatorId, inputId);

        // Add token
        const formula = calc.formulas.find((f) => f.id === activeFormula);
        if (!formula) return;

        const newToken: FormulaToken = {
            type: 'input',
            value: inputId,
            label: input.name,
        };
        store.setFormulaTokens(calculatorId, activeFormula, [...formula.tokens, newToken]);
    };

    const addTokenToFormula = (formulaId: string, token: FormulaToken) => {
        const formula = calc.formulas.find((f) => f.id === formulaId);
        if (!formula) return;
        store.setFormulaTokens(calculatorId, formulaId, [...formula.tokens, token]);
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
    };

    return (
        <div className="flex gap-5 min-h-[500px]">
            {/* ─── Left Sidebar: Available Inputs ─── */}
            <div className="w-56 shrink-0 space-y-3">
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider px-1">
                    Available Inputs
                </h3>
                <p className="text-[11px] text-black/30 px-1">
                    Drag into the formula area or click to add
                </p>

                {inputDefinitions.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl bg-black/[0.02] border border-dashed border-black/10">
                        <Layers className="w-6 h-6 text-black/15 mx-auto mb-2" />
                        <p className="text-[11px] text-black/30 font-medium">
                            No inputs yet. Add them in the Input Hub tab.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {inputDefinitions
                            .sort((a, b) => a.order - b.order)
                            .map((input) => {
                                const Icon = TYPE_ICON[input.type];
                                return (
                                    <div
                                        key={input.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, input.id)}
                                        onClick={() => {
                                            if (!activeFormula) return;
                                            addUsedInput(calculatorId, input.id);
                                            addTokenToFormula(activeFormula, {
                                                type: 'input',
                                                value: input.id,
                                                label: input.name,
                                            });
                                        }}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all group bg-white border-black/8 hover:border-black/15 hover:shadow-sm select-none"
                                    >
                                        <GripVertical className="w-3 h-3 text-black/15 group-hover:text-black/30 shrink-0" />
                                        <div className={`p-1 rounded-md border ${TYPE_COLOR[input.type]} shrink-0`}>
                                            <Icon className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs font-medium text-black truncate flex-1">{input.name}</span>
                                        {input.type === 'number' && input.rate !== '0' && (
                                            <span className="text-[10px] text-black/30 font-mono shrink-0">₹{input.rate}</span>
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
                            Click to use a formula's result
                        </p>
                        <div className="space-y-1.5">
                            {sortedFormulas
                                .filter((f) => f.id !== activeFormula)
                                .map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => {
                                            if (!activeFormula) return;
                                            addTokenToFormula(activeFormula, {
                                                type: 'formula_ref',
                                                value: f.id,
                                                label: f.label,
                                            });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/50 border border-emerald-200/50 hover:border-emerald-300 text-left transition-colors group"
                                        title={`Use result of ${f.label}`}
                                    >
                                        <Combine className="w-3 h-3 text-emerald-500 shrink-0" />
                                        <span className="text-xs font-medium text-emerald-700 truncate">
                                            {f.label}
                                        </span>
                                    </button>
                                ))}
                        </div>
                    </>
                )}
            </div>

            {/* ─── Center: Formula Canvas ─── */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider">
                        Formulas
                    </h3>
                    <button
                        onClick={handleAddFormula}
                        className="text-xs text-black/40 hover:text-black font-semibold flex items-center gap-1.5 transition-colors"
                        title="Add a new formula"
                    >
                        <Plus className="w-3 h-3" />
                        Add Formula
                    </button>
                </div>

                {sortedFormulas.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border-2 border-dashed border-black/10">
                        <Calculator className="w-10 h-10 text-black/15 mx-auto mb-3" />
                        <p className="text-sm text-black/30 font-medium mb-3">
                            No formulas yet. Click "Add Formula" to start building.
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
                                onActivate={() => setActiveFormula(formula.id)}
                                onRemove={() => {
                                    removeFormula(calculatorId, formula.id);
                                    if (activeFormula === formula.id) {
                                        setActiveFormula(
                                            sortedFormulas.find((f) => f.id !== formula.id)?.id || null,
                                        );
                                    }
                                }}
                                onMove={(dir) => moveFormula(calculatorId, formula.id, dir)}
                                onUpdateLabel={(label) =>
                                    updateFormula(calculatorId, formula.id, { label })
                                }
                                onToggleTotal={() =>
                                    updateFormula(calculatorId, formula.id, {
                                        isTotal: !formula.isTotal,
                                    })
                                }
                                onAddToken={(token) => addTokenToFormula(formula.id, token)}
                                onRemoveToken={(tokenIdx) =>
                                    removeTokenFromFormula(formula.id, tokenIdx)
                                }
                                inputDefinitions={inputDefinitions}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Right Sidebar: Local Rates ─── */}
            <div className="w-52 shrink-0 space-y-3">
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider px-1">
                    Local Rates
                </h3>
                <p className="text-[11px] text-black/30 px-1">
                    Rates specific to this calculator only
                </p>

                <div className="space-y-1.5">
                    {calc.localRates.map((lr) => (
                        <div
                            key={lr.id}
                            className="bg-white rounded-xl border border-black/8 p-2.5 space-y-1.5"
                        >
                            <input
                                type="text"
                                value={lr.name}
                                onChange={(e) =>
                                    updateLocalRate(calculatorId, lr.id, { name: e.target.value })
                                }
                                placeholder="Rate name..."
                                className="w-full text-xs text-black bg-transparent outline-none placeholder:text-black/25 font-medium"
                            />
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-black/30">₹</span>
                                <input
                                    type="text"
                                    value={lr.rate}
                                    onChange={(e) =>
                                        updateLocalRate(calculatorId, lr.id, {
                                            rate: e.target.value,
                                        })
                                    }
                                    placeholder="0"
                                    className="flex-1 text-xs text-black bg-transparent outline-none placeholder:text-black/25 font-mono"
                                />
                                <button
                                    onClick={() => removeLocalRate(calculatorId, lr.id)}
                                    className="p-0.5 rounded text-black/15 hover:text-red-500 transition-colors"
                                    title="Remove local rate"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => addLocalRate(calculatorId)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-black/15 text-xs text-black/40 hover:text-black hover:border-black/25 font-semibold transition-colors"
                    title="Add a local rate for this calculator"
                >
                    <Plus className="w-3 h-3" />
                    Add Local Rate
                </button>
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
    onActivate,
    onRemove,
    onMove,
    onUpdateLabel,
    onToggleTotal,
    onAddToken,
    onRemoveToken,
    inputDefinitions,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    calculatorId: string;
    formula: { id: string; label: string; tokens: FormulaToken[]; isTotal?: boolean; order: number };
    index: number;
    totalFormulas: number;
    isActive: boolean;
    isDragOver: boolean;
    onActivate: () => void;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onUpdateLabel: (label: string) => void;
    onToggleTotal: () => void;
    onAddToken: (token: FormulaToken) => void;
    onRemoveToken: (index: number) => void;
    inputDefinitions: InputDefinition[];
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
}) {
    const [showNumberInput, setShowNumberInput] = useState(false);
    const [numberValue, setNumberValue] = useState('');

    const getInputName = (id: string) => {
        const input = inputDefinitions.find((i) => i.id === id);
        return input?.name || 'Unknown';
    };

    const handleAddNumber = () => {
        if (numberValue) {
            onAddToken({ type: 'number', value: numberValue });
            setNumberValue('');
            setShowNumberInput(false);
        }
    };

    return (
        <div
            onClick={onActivate}
            className={`rounded-2xl border transition-all duration-300 ${isActive
                    ? `bg-white border-black/15 shadow-lg shadow-black/10 ${isDragOver ? 'ring-2 ring-blue-400/50 border-blue-300' : ''
                    }`
                    : 'bg-white/60 border-black/6 hover:border-black/10 cursor-pointer'
                }`}
        >
            {/* Formula Header */}
            <div className="flex items-center gap-2 px-4 py-3">
                {/* Total indicator */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleTotal();
                    }}
                    className={`p-1 rounded-lg transition-colors ${formula.isTotal
                            ? 'bg-emerald-50 text-emerald-500'
                            : 'text-black/15 hover:text-black/30'
                        }`}
                    title={formula.isTotal ? 'Marked as total formula' : 'Mark as total formula'}
                >
                    <Trophy className="w-3.5 h-3.5" />
                </button>

                {/* Label */}
                <input
                    type="text"
                    value={formula.label}
                    onChange={(e) => onUpdateLabel(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 text-sm font-semibold bg-transparent outline-none ${formula.isTotal ? 'text-emerald-700' : 'text-black'
                        }`}
                    placeholder="Formula name..."
                />

                {/* Actions */}
                <div className="flex items-center gap-0.5">
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

            {/* Token Display / Drop Zone */}
            {isActive && (
                <div className="px-4 pb-4 space-y-3 animate-slide-up">
                    {/* Token Chain / Drop Zone */}
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={`min-h-[56px] rounded-xl border-2 border-dashed p-3 flex flex-wrap items-center gap-1.5 transition-colors ${isDragOver
                                ? 'border-blue-300 bg-blue-50/30'
                                : formula.tokens.length === 0
                                    ? 'border-black/10 bg-black/[0.01]'
                                    : 'border-black/8 bg-black/[0.01]'
                            }`}
                    >
                        {formula.tokens.length === 0 && (
                            <span className="text-xs text-black/25 italic">
                                Drag inputs here or use buttons below...
                            </span>
                        )}
                        {formula.tokens.map((token, idx) => (
                            <TokenChip
                                key={idx}
                                token={token}
                                onRemove={() => onRemoveToken(idx)}
                                getInputName={getInputName}
                            />
                        ))}
                    </div>

                    {/* Operator + Bracket Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Operators */}
                        <div className="flex items-center gap-1 bg-black/[0.02] rounded-xl p-1">
                            {OPERATORS.map((op) => (
                                <button
                                    key={op.symbol}
                                    onClick={() =>
                                        onAddToken({ type: 'operator', value: op.symbol })
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
                                        onAddToken({ type: 'bracket', value: b.symbol })
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
                                <span className="text-[10px] text-black/20 mr-1">Quick add:</span>
                                {inputDefinitions.slice(0, 4).map((input) => (
                                    <button
                                        key={input.id}
                                        onClick={() => {
                                            addUsedInput(calculatorId, input.id);
                                            onAddToken({
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
                </div>
            )}
        </div>
    );
}

// We need access to addUsedInput inside FormulaCard's quick buttons
// This is a self-contained reference from the store
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
