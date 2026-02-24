import { useState } from 'react';
import { Trash2, Plus, AlertTriangle, X } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import { buildDependencyGraph, detectCircularReferences } from '@arovave/engine';
import type { OperationType } from '@arovave/engine';

const OPERATIONS: { value: OperationType; label: string; symbol: string }[] = [
    { value: 'add', label: 'Add', symbol: '+' },
    { value: 'subtract', label: 'Subtract', symbol: '−' },
    { value: 'multiply', label: 'Multiply', symbol: '×' },
    { value: 'divide', label: 'Divide', symbol: '÷' },
];

export function FormulaBuilder() {
    const {
        schema,
        addFormula,
        removeFormula,
        updateFormula,
        addFormulaOperand,
        removeFormulaOperand,
        getAllFieldKeys,
        getAllFormulaOutputKeys,
    } = useTemplateStore();

    // Check for circular references live
    const circularErrors = (() => {
        try {
            const validFormulas = schema.formulas.filter(
                (f) => f.outputKey && f.operands.length > 0
            );
            if (validFormulas.length === 0) return [];
            const graph = buildDependencyGraph(validFormulas);
            return detectCircularReferences(graph);
        } catch {
            return [];
        }
    })();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-black">Formulas</h2>
                <button onClick={addFormula} className="btn-primary text-sm !px-3 !py-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Add Formula
                </button>
            </div>

            {/* Circular reference warning */}
            {circularErrors.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-sm text-red-300">
                        <strong>Circular Reference Detected:</strong>{' '}
                        {circularErrors[0].message}
                    </div>
                </div>
            )}

            {schema.formulas.length === 0 && (
                <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-black text-base">
                        No formulas yet. Formulas compute values from fields and other formulas.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {schema.formulas.map((formula, formulaIndex) => (
                    <FormulaCard
                        key={formulaIndex}
                        formulaIndex={formulaIndex}
                        allFieldKeys={getAllFieldKeys()}
                        allFormulaKeys={getAllFormulaOutputKeys()}
                        onRemove={() => removeFormula(formulaIndex)}
                        onUpdate={(updates) => updateFormula(formulaIndex, updates)}
                        onAddOperand={(op) => addFormulaOperand(formulaIndex, op)}
                        onRemoveOperand={(oi) => removeFormulaOperand(formulaIndex, oi)}
                    />
                ))}
            </div>
        </div>
    );
}

function FormulaCard({
    formulaIndex,
    allFieldKeys,
    allFormulaKeys,
    onRemove,
    onUpdate,
    onAddOperand,
    onRemoveOperand,
}: {
    formulaIndex: number;
    allFieldKeys: string[];
    allFormulaKeys: string[];
    onRemove: () => void;
    onUpdate: (updates: Partial<{ outputKey: string; operationType: OperationType; label: string }>) => void;
    onAddOperand: (operand: string) => void;
    onRemoveOperand: (operandIndex: number) => void;
}) {
    const { schema } = useTemplateStore();
    const formula = schema.formulas[formulaIndex];
    const [showPicker, setShowPicker] = useState(false);

    if (!formula) return null;

    // Available operands: field keys + formula outputs (except self) + literal numbers
    const availableOperands = [
        ...allFieldKeys.map((k) => ({ key: k, group: 'Fields' })),
        ...allFormulaKeys
            .filter((k) => k !== formula.outputKey)
            .map((k) => ({ key: k, group: 'Formula Outputs' })),
    ];

    // Also allow dropdown .rate access
    const rateOperands: { key: string; group: string }[] = [];
    schema.sections.forEach((s) =>
        s.fields.forEach((f) => {
            if (f.type === 'dropdown' && f.key) {
                rateOperands.push({ key: `${f.key}.rate`, group: 'Dropdown Rates' });
            }
        })
    );

    const allAvailable = [...availableOperands, ...rateOperands];

    const opSymbol = OPERATIONS.find((o) => o.value === formula.operationType)?.symbol || '?';

    return (
        <div className="glass rounded-2xl border border-surface-border p-4 space-y-3">
            {/* Top row: output key, operation, label, delete */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-black font-mono shrink-0">#{formulaIndex + 1}</span>

                <input
                    type="text"
                    value={formula.outputKey}
                    onChange={(e) =>
                        onUpdate({
                            outputKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                        })
                    }
                    placeholder="output_key"
                    className="w-36 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                />

                <span className="text-sm text-black">=</span>

                <select
                    value={formula.operationType}
                    onChange={(e) =>
                        onUpdate({ operationType: e.target.value as OperationType })
                    }
                    className="w-28 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-black/10"
                >
                    {OPERATIONS.map((op) => (
                        <option key={op.value} value={op.value}>
                            {op.label} ({op.symbol})
                        </option>
                    ))}
                </select>

                <input
                    type="text"
                    value={formula.label || ''}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="Description (optional)..."
                    className="flex-1 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                />

                <button
                    onClick={onRemove}
                    className="p-1.5 rounded text-black hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Remove formula"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Operands display */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-black shrink-0">Operands:</span>

                {formula.operands.map((operand, oi) => (
                    <span key={oi} className="flex items-center">
                        {oi > 0 && (
                            <span className="text-black/50 font-bold text-base mx-1">{opSymbol}</span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.06] border border-black/10 px-2 py-0.5 text-sm font-mono text-black">
                            {operand}
                            <button
                                onClick={() => onRemoveOperand(oi)}
                                className="text-brand-500/50 hover:text-red-500 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    </span>
                ))}

                {/* Add operand button / picker */}
                <div className="relative">
                    <button
                        onClick={() => setShowPicker(!showPicker)}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-surface-border px-2 py-0.5 text-sm text-black hover:text-black/50 hover:border-black/15 transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                        operand
                    </button>

                    {showPicker && (
                        <div className="absolute top-full left-0 mt-1 z-20 w-56 max-h-48 overflow-auto rounded-xl bg-white border border-surface-border shadow-xl">
                            {/* Literal number input */}
                            <LiteralInput
                                onAdd={(v) => {
                                    onAddOperand(v);
                                    setShowPicker(false);
                                }}
                            />
                            <div className="border-t border-surface-border" />

                            {allAvailable.length === 0 && (
                                <p className="text-sm text-black px-3 py-2">
                                    No fields or formulas available yet
                                </p>
                            )}

                            {/* Group by type */}
                            {['Fields', 'Formula Outputs', 'Dropdown Rates'].map((group) => {
                                const items = allAvailable.filter((a) => a.group === group);
                                if (items.length === 0) return null;
                                return (
                                    <div key={group}>
                                        <div className="text-[10px] text-black px-3 py-1 uppercase tracking-wider">
                                            {group}
                                        </div>
                                        {items.map((item) => (
                                            <button
                                                key={item.key}
                                                onClick={() => {
                                                    onAddOperand(item.key);
                                                    setShowPicker(false);
                                                }}
                                                className="w-full text-left px-3 py-1.5 text-sm font-mono text-black hover:bg-black/[0.06] transition-colors"
                                            >
                                                {item.key}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function LiteralInput({ onAdd }: { onAdd: (value: string) => void }) {
    const [value, setValue] = useState('');

    return (
        <div className="flex items-center gap-1 px-2 py-2">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Literal number..."
                className="flex-1 rounded bg-white border border-black/10 px-2 py-1 text-sm text-black placeholder:text-black/30 outline-none"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && value.trim()) {
                        onAdd(value.trim());
                        setValue('');
                    }
                }}
            />
            <button
                onClick={() => {
                    if (value.trim()) {
                        onAdd(value.trim());
                        setValue('');
                    }
                }}
                className="text-sm text-black/50 hover:text-black px-1"
            >
                Add
            </button>
        </div>
    );
}
