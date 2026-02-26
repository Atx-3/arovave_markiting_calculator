import { useState } from 'react';
import {
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    X,
    Hash,
    List,
    Lock,
    ChevronRight,
    Asterisk,
    Equal,
    Trophy,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { RowType, Operation } from '../../types/calculator';

// ─── Row types (no "calculated" — formulas are separate) ──────────────

const ROW_TYPES: { value: RowType; label: string; icon: typeof Hash; color: string }[] = [
    { value: 'input', label: 'Input', icon: Hash, color: 'text-black' },
    { value: 'dropdown', label: 'Dropdown', icon: List, color: 'text-black' },
    { value: 'fixed', label: 'Fixed Value', icon: Lock, color: 'text-black' },
];

// ─── Operators — common shown by default, "More" for all ─────────────

const COMMON_OPERATORS: { symbol: string; op: Operation; label: string }[] = [
    { symbol: '+', op: '+', label: 'Add' },
    { symbol: '−', op: '-', label: 'Subtract' },
    { symbol: '×', op: '×', label: 'Multiply' },
    { symbol: '÷', op: '÷', label: 'Divide' },
];

const EXTRA_OPERATORS: { symbol: string; op: Operation; label: string }[] = [
    { symbol: '%', op: '%' as Operation, label: 'Percentage' },
    { symbol: '^', op: '^' as Operation, label: 'Power' },
    { symbol: '√', op: '√' as Operation, label: 'Square Root' },
    { symbol: 'min', op: 'min' as Operation, label: 'Minimum' },
    { symbol: 'max', op: 'max' as Operation, label: 'Maximum' },
    { symbol: 'avg', op: 'avg' as Operation, label: 'Average' },
    { symbol: 'round', op: 'round' as Operation, label: 'Round' },
    { symbol: 'ceil', op: 'ceil' as Operation, label: 'Round Up' },
    { symbol: 'floor', op: 'floor' as Operation, label: 'Round Down' },
    { symbol: 'abs', op: 'abs' as Operation, label: 'Absolute' },
];

// ─── Auto-generate key from label ────────────────────────────────────

function labelToKey(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 30) || 'field';
}

// ═══════════════════════════════════════════════════════════════════════
// CALCULATOR BUILDER — Simplified: label-only, formula bar, required
// ═══════════════════════════════════════════════════════════════════════

export function CalculatorBuilder({ calculatorId }: { calculatorId: string }) {
    const store = useAppStore();
    const calculator = store.calculators.find((c) => c.id === calculatorId);
    if (!calculator) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-black">
                    Calculator Rows
                    <span className="text-black font-normal ml-2">({calculator.rows.length} rows)</span>
                </h3>
                <button
                    onClick={() => {
                        store.addRow(calculatorId);
                        // Auto-set key after adding
                        setTimeout(() => {
                            const calc = store.calculators.find((c) => c.id === calculatorId);
                            if (calc) {
                                const lastRow = calc.rows[calc.rows.length - 1];
                                if (lastRow && !lastRow.key) {
                                    store.updateRow(calculatorId, lastRow.id, { key: `field_${calc.rows.length}` });
                                }
                            }
                        }, 10);
                    }}
                    className="btn-primary text-sm !px-3 !py-1.5"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                </button>
            </div>

            {calculator.rows.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center">
                    <p className="text-black text-base">
                        No rows yet. Add rows to build your calculator form.
                    </p>
                    <p className="text-black text-sm mt-1">
                        Each row is a field: input, dropdown, or fixed value. Then build formulas below.
                    </p>
                </div>
            )}

            {/* Rows */}
            <div className="space-y-2">
                {calculator.rows.map((row, index) => {
                    const TypeIcon = ROW_TYPES.find((t) => t.value === row.type)?.icon || Hash;
                    const typeColor = ROW_TYPES.find((t) => t.value === row.type)?.color || 'text-black';

                    return (
                        <div key={row.id} className="glass rounded-2xl border border-surface-border overflow-hidden">
                            {/* Main row — simplified */}
                            <div className="flex items-center gap-2 px-3 py-2.5">
                                {/* Order */}
                                <span className="text-sm text-black font-mono w-5 text-center shrink-0">{row.order}</span>

                                {/* Move */}
                                <div className="flex flex-col gap-0">
                                    <button onClick={() => store.moveRow(calculatorId, row.id, 'up')} disabled={index === 0}
                                        className="p-0.5 text-black hover:text-black disabled:opacity-20 transition-colors" title="Move up">
                                        <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => store.moveRow(calculatorId, row.id, 'down')} disabled={index === calculator.rows.length - 1}
                                        className="p-0.5 text-black hover:text-black disabled:opacity-20 transition-colors" title="Move down">
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Type selector (disabled for formula-generated rows) */}
                                <select
                                    value={row.type === 'calculated' ? 'calculated' : row.type}
                                    onChange={(e) => {
                                        if (row.type === 'calculated') return; // Don't allow changing formula rows
                                        const type = e.target.value as RowType;
                                        store.updateRow(calculatorId, row.id, {
                                            type,
                                            dropdownOptions: type === 'dropdown' ? row.dropdownOptions || [] : undefined,
                                            fixedValue: type === 'fixed' ? row.fixedValue || '0' : undefined,
                                        });
                                    }}
                                    disabled={row.type === 'calculated'}
                                    className={`w-28 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-black/10 ${row.type === 'calculated' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title={row.type === 'calculated' ? 'This row is generated by a formula' : 'Field type'}
                                >
                                    {ROW_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                    {row.type === 'calculated' && (
                                        <option value="calculated">Calculated</option>
                                    )}
                                </select>

                                <TypeIcon className={`w-3.5 h-3.5 ${typeColor} shrink-0`} />

                                {/* Label only (key auto-generated) */}
                                <input
                                    type="text"
                                    value={row.label}
                                    onChange={(e) => {
                                        const label = e.target.value;
                                        store.updateRow(calculatorId, row.id, {
                                            label,
                                            key: labelToKey(label),
                                        });
                                    }}
                                    placeholder="Field label..."
                                    className="flex-1 rounded-md bg-white border border-black/10 px-2 py-1.5 text-base text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                                />

                                {/* Fixed value */}
                                {row.type === 'fixed' && (
                                    <input
                                        type="text"
                                        value={row.fixedValue || ''}
                                        onChange={(e) => store.updateRow(calculatorId, row.id, { fixedValue: e.target.value })}
                                        placeholder="₹0"
                                        className="w-24 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                )}

                                {/* Compulsory toggle */}
                                <label
                                    className={`flex items-center gap-1 text-sm cursor-pointer shrink-0 px-2 py-1 rounded-md transition-colors ${row.isRequired
                                        ? 'text-red-500 bg-red-50'
                                        : 'text-black hover:text-black'
                                        }`}
                                    title="Mark as compulsory"
                                >
                                    <input
                                        type="checkbox"
                                        checked={row.isRequired || false}
                                        onChange={(e) => store.updateRow(calculatorId, row.id, { isRequired: e.target.checked })}
                                        className="rounded border-surface-border bg-white text-red-500 focus:ring-red-500/40 w-3 h-3"
                                    />
                                    <Asterisk className="w-3 h-3" />
                                    Required
                                </label>

                                {/* Total toggle — only for non-calculated rows */}
                                {row.type !== 'calculated' && (
                                    <label className="flex items-center gap-1 text-sm text-black cursor-pointer shrink-0" title="Mark as total row">
                                        <input
                                            type="checkbox"
                                            checked={row.isTotal || false}
                                            onChange={(e) => store.updateRow(calculatorId, row.id, { isTotal: e.target.checked })}
                                            className="rounded border-surface-border bg-white text-black focus:ring-black/10 w-3 h-3"
                                        />
                                        Total
                                    </label>
                                )}
                                {row.type === 'calculated' && row.isTotal && (
                                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg shrink-0" title="This formula is used for Grand Total">
                                        <Trophy className="w-3 h-3" />
                                        Grand Total
                                    </span>
                                )}

                                {/* Delete */}
                                <button
                                    onClick={() => store.removeRow(calculatorId, row.id)}
                                    className="p-1.5 rounded text-black hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                    title="Remove row"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Dropdown options */}
                            {row.type === 'dropdown' && (
                                <div className="border-t border-surface-border px-4 py-3 bg-white/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-black">Options</span>
                                        <button
                                            onClick={() => store.addDropdownOption(calculatorId, row.id)}
                                            className="text-sm text-black/50 hover:text-black flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" /> Add Option
                                        </button>
                                    </div>

                                    {(row.dropdownOptions || []).length > 0 && (
                                        <div className="grid grid-cols-[1fr_1fr_100px_24px] gap-2 text-[10px] text-black uppercase tracking-wider px-1">
                                            <span>Label</span>
                                            <span>Value</span>
                                            <span>Rate (₹)</span>
                                            <span></span>
                                        </div>
                                    )}

                                    {(row.dropdownOptions || []).map((opt, oi) => (
                                        <div key={oi} className="grid grid-cols-[1fr_1fr_100px_24px] gap-2 items-center">
                                            <input type="text" value={opt.label}
                                                onChange={(e) => store.updateDropdownOption(calculatorId, row.id, oi, { label: e.target.value })}
                                                placeholder="Steel" className="rounded bg-white border border-black/10 px-2 py-1 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10" />
                                            <input type="text" value={opt.value}
                                                onChange={(e) => store.updateDropdownOption(calculatorId, row.id, oi, { value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                                                placeholder="steel" className="rounded bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10" />
                                            <input type="text" value={opt.rate}
                                                onChange={(e) => store.updateDropdownOption(calculatorId, row.id, oi, { rate: e.target.value })}
                                                placeholder="150" className="rounded bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10" />
                                            <button onClick={() => store.removeDropdownOption(calculatorId, row.id, oi)}
                                                className="p-0.5 rounded text-black hover:text-red-500 transition-colors" title="Remove option">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Formula Builder — below all rows */}
            {calculator.rows.length >= 1 && (
                <FormulaBar calculatorId={calculatorId} />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// FORMULA BAR — Visual formula builder with operators
// ═══════════════════════════════════════════════════════════════════════

function FormulaBar({ calculatorId }: { calculatorId: string }) {
    const store = useAppStore();
    const calculator = store.calculators.find((c) => c.id === calculatorId);
    if (!calculator) return null;

    const [tokens, setTokens] = useState<{ type: 'field' | 'operator' | 'number'; value: string }[]>([]);
    const [showMoreOps, setShowMoreOps] = useState(false);
    const [resultLabel, setResultLabel] = useState('');
    const [numberInput, setNumberInput] = useState('');

    // All existing calculated rows (formulas)
    const existingFormulas = calculator.rows.filter((r) => r.type === 'calculated' && r.formula);

    // All non-calculated fields + earlier formula outputs = available operands
    const inputFields = calculator.rows
        .filter((r) => r.key && r.label && r.type !== 'calculated')
        .map((r) => ({ key: r.key, label: r.label }));

    const formulaFields = existingFormulas
        .filter((r) => r.key && r.label)
        .map((r) => ({ key: r.key, label: r.label }));

    const allFields = [...inputFields, ...formulaFields];

    const addField = (key: string) => setTokens([...tokens, { type: 'field', value: key }]);
    const addOperator = (op: string) => setTokens([...tokens, { type: 'operator', value: op }]);
    const addNumber = () => {
        if (!numberInput.trim()) return;
        setTokens([...tokens, { type: 'number', value: numberInput.trim() }]);
        setNumberInput('');
    };
    const removeToken = (index: number) => setTokens(tokens.filter((_, i) => i !== index));
    const clearTokens = () => { setTokens([]); setResultLabel(''); setNumberInput(''); };

    // Save formula — creates a new calculated row
    const finishFormula = () => {
        if (tokens.length < 3 || !resultLabel.trim()) return;

        const operands = tokens.filter((t) => t.type === 'field' || t.type === 'number').map((t) => t.value);
        const operators = tokens.filter((t) => t.type === 'operator');
        const mainOp = operators.length > 0 ? operators[0].value : '+';

        store.addCalculatedRow(
            calculatorId,
            resultLabel.trim(),
            labelToKey(resultLabel.trim()),
            { operands, operation: mainOp as Operation }
        );

        setTokens([]);
        setResultLabel('');
    };

    const lastToken = tokens[tokens.length - 1];
    const expectingField = tokens.length === 0 || lastToken?.type === 'operator';
    const expectingOperator = lastToken?.type === 'field' || lastToken?.type === 'number';
    const canFinish = tokens.length >= 3 && expectingOperator;

    const getFieldLabel = (key: string) => {
        const field = allFields.find((f) => f.key === key);
        return field?.label || key;
    };

    return (
        <div className="glass rounded-2xl border border-black/10 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-black flex items-center gap-2">
                    <Equal className="w-4 h-4" />
                    Formulas
                    <span className="text-black font-normal">({existingFormulas.length} formulas)</span>
                </h3>
            </div>

            {/* ── Existing formulas list ── */}
            {existingFormulas.length > 0 && (
                <div className="space-y-2">
                    {existingFormulas.map((formula, fi) => (
                        <div key={formula.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${formula.isTotal ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/10'}`}>
                            <span className="w-5 h-5 rounded-full bg-black/[0.06] flex items-center justify-center text-[10px] font-bold text-black shrink-0">
                                {fi + 1}
                            </span>
                            <div className="flex items-center gap-1 flex-wrap flex-1">
                                {formula.formula && formula.formula.operands.map((operand, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && (
                                            <span className="px-2 py-0.5 rounded-lg bg-black/[0.04] text-black font-bold text-sm">
                                                {formula.formula!.operation}
                                            </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded-lg bg-black/5 text-black border border-black/10 text-xs font-medium">
                                            {getFieldLabel(operand)}
                                        </span>
                                    </span>
                                ))}
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-black/[0.06] text-black font-bold text-sm">=</span>
                            <span className="text-sm font-semibold text-black shrink-0">{formula.label}</span>
                            <button
                                onClick={() => store.setGrandTotalRow(calculatorId, formula.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${formula.isTotal
                                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                    : 'bg-black/[0.03] text-black/40 border border-black/10 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200'
                                    }`}
                                title={formula.isTotal ? 'This is the Grand Total' : 'Set as Grand Total'}
                            >
                                <Trophy className="w-3 h-3" />
                                {formula.isTotal ? 'Grand Total' : 'Set as Total'}
                            </button>
                            <button
                                onClick={() => store.removeRow(calculatorId, formula.id)}
                                className="p-1 rounded text-black/20 hover:text-red-500 transition-colors shrink-0 ml-1"
                                title="Delete formula"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── New formula builder — always available ── */}
            <div className="space-y-3 border-t border-black/5 pt-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-black/50 uppercase tracking-wider">
                        {existingFormulas.length === 0 ? 'Build your first formula' : 'Add another formula'}
                    </span>
                    {tokens.length > 0 && (
                        <button onClick={clearTokens} className="text-xs text-black/40 hover:text-black transition-colors">
                            Clear
                        </button>
                    )}
                </div>

                {/* Formula display — each token individually deletable */}
                <div className="flex items-center gap-1.5 flex-wrap min-h-[44px] rounded-xl bg-white border border-black/10 px-3 py-2">
                    {tokens.length === 0 && (
                        <span className="text-sm text-black/30 italic">Click a field below to start...</span>
                    )}
                    {tokens.map((token, i) => (
                        <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-sm font-semibold ${token.type === 'field'
                                ? 'bg-black/5 text-black border border-black/15'
                                : token.type === 'number'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-black/5 text-black font-bold text-base px-3'
                                }`}
                        >
                            {token.type === 'field'
                                ? getFieldLabel(token.value)
                                : token.value}
                            <button
                                onClick={() => removeToken(i)}
                                className="opacity-40 hover:opacity-100 hover:text-red-500 transition-all ml-0.5"
                                title="Remove"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}

                    {canFinish && (
                        <span className="px-2.5 py-1 rounded-xl bg-black/[0.06] text-black font-bold text-lg">=</span>
                    )}
                </div>

                {/* Field & formula output buttons */}
                <div className="space-y-2">
                    <span className="text-[10px] text-black/50 uppercase tracking-wider">
                        {expectingField ? '▸ Pick a field or formula result:' : expectingOperator ? '▸ Pick an operator:' : 'Fields:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {inputFields.map((field) => (
                            <button
                                key={field.key}
                                onClick={() => addField(field.key)}
                                disabled={!expectingField}
                                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${expectingField
                                    ? 'bg-black/5 border border-black/10 text-black hover:bg-black/10 cursor-pointer'
                                    : 'bg-white border border-black/5 text-black/30 cursor-not-allowed'
                                    }`}
                            >
                                {field.label}
                            </button>
                        ))}
                        {formulaFields.map((field) => (
                            <button
                                key={field.key}
                                onClick={() => addField(field.key)}
                                disabled={!expectingField}
                                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${expectingField
                                    ? 'bg-green-50 border border-green-200 text-green-800 hover:bg-green-100 cursor-pointer'
                                    : 'bg-white border border-black/5 text-black/30 cursor-not-allowed'
                                    }`}
                                title="Result from earlier formula"
                            >
                                ƒ {field.label}
                            </button>
                        ))}
                    </div>

                    {/* Number input — for literals like "18", "1.18", "100" */}
                    {expectingField && (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={numberInput}
                                onChange={(e) => setNumberInput(e.target.value.replace(/[^0-9.]/g, ''))}
                                onKeyDown={(e) => { if (e.key === 'Enter') addNumber(); }}
                                placeholder="Or type a number..."
                                className="w-40 rounded-lg bg-white border border-black/10 px-2.5 py-1.5 text-sm text-black font-mono placeholder:text-black/20 outline-none focus:ring-1 focus:ring-black/10"
                            />
                            {numberInput && (
                                <button
                                    onClick={addNumber}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors"
                                >
                                    Add {numberInput}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Operators */}
                <div className="flex flex-wrap gap-1.5">
                    {COMMON_OPERATORS.map((op) => (
                        <button
                            key={op.symbol}
                            onClick={() => addOperator(op.op)}
                            disabled={!expectingOperator}
                            className={`w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center transition-all ${expectingOperator
                                ? 'bg-black/[0.04] border border-black/10 text-black hover:bg-black/[0.08] cursor-pointer'
                                : 'bg-white border border-black/5 text-black/20 cursor-not-allowed'
                                }`}
                            title={op.label}
                        >
                            {op.symbol}
                        </button>
                    ))}

                    <button
                        onClick={() => setShowMoreOps(!showMoreOps)}
                        className={`px-3 h-10 rounded-xl border text-sm font-semibold transition-colors ${showMoreOps
                            ? 'bg-black/[0.06] border-black/20 text-black'
                            : 'border-black/10 text-black/50 hover:text-black'
                            }`}
                    >
                        {showMoreOps ? 'Less' : 'More ▾'}
                    </button>

                    {showMoreOps && EXTRA_OPERATORS.map((op) => (
                        <button
                            key={op.symbol}
                            onClick={() => addOperator(op.op)}
                            disabled={!expectingOperator}
                            className={`px-3 h-10 rounded-xl text-sm font-semibold flex items-center justify-center transition-all ${expectingOperator
                                ? 'bg-black/[0.04] border border-black/10 text-black hover:bg-black/[0.08] cursor-pointer'
                                : 'bg-white border border-black/5 text-black/20 cursor-not-allowed'
                                }`}
                            title={op.label}
                        >
                            <span className="font-bold">{op.symbol}</span>
                        </button>
                    ))}
                </div>

                {/* Result label + save */}
                {canFinish && (
                    <div className="flex items-center gap-3 pt-2 border-t border-black/10">
                        <Equal className="w-4 h-4 text-black shrink-0" />
                        <input
                            type="text"
                            value={resultLabel}
                            onChange={(e) => setResultLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && resultLabel.trim()) finishFormula(); }}
                            placeholder="Name this result (e.g. Area, Rate 1, Grand Total)..."
                            className="flex-1 rounded-xl bg-white border border-black/10 px-3 py-2 text-base text-black placeholder:text-black/30 outline-none focus:ring-2 focus:ring-black/10"
                            autoFocus
                        />
                        <button
                            onClick={finishFormula}
                            disabled={!resultLabel.trim()}
                            className="btn-primary text-sm !px-5 !py-2 disabled:opacity-40"
                        >
                            Save Formula
                        </button>
                    </div>
                )}

                {tokens.length > 0 && tokens.length < 3 && (
                    <p className="text-[11px] text-black/40 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />
                        {expectingField ? 'Now pick a field, formula result, or type a number' : 'Now pick an operator'} to continue...
                    </p>
                )}
            </div>

            {/* Tip for percentage */}
            {existingFormulas.length === 0 && tokens.length === 0 && (
                <div className="text-xs text-black/30 border-t border-black/5 pt-2 space-y-1">
                    <p><strong>Tip:</strong> Create formulas step by step:</p>
                    <p>1. <code>Length × Width = Area</code></p>
                    <p>2. <code>Area × Rate = Cost</code></p>
                    <p>3. <code>Cost × 1.18 = Grand Total</code> (adds 18% GST)</p>
                </div>
            )}
        </div>
    );
}

