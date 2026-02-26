import { useState } from 'react';
import {
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Layers,
    Box,
    ToggleLeft,
    ToggleRight,
    X,
    Calculator,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { CostBlockType, BlockOperation } from '../../types/calculator';

// ─── Block type options ────────────────────────────────────────────────

const BLOCK_TYPES: { value: CostBlockType; label: string }[] = [
    { value: 'area-based', label: 'Area-Based' },
    { value: 'fixed-rate', label: 'Fixed Rate' },
    { value: 'dropdown-rate', label: 'Dropdown Rate' },
    { value: 'per-piece', label: 'Per Piece' },
    { value: 'aggregation', label: 'Aggregation' },
];

const OPERATIONS: { value: BlockOperation; label: string; symbol: string }[] = [
    { value: '+', label: 'Add', symbol: '+' },
    { value: '-', label: 'Subtract', symbol: '−' },
    { value: '×', label: 'Multiply', symbol: '×' },
    { value: '÷', label: 'Divide', symbol: '÷' },
    { value: 'sum', label: 'Sum All', symbol: 'Σ' },
];

function labelToKey(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 30) || 'output';
}

// ═══════════════════════════════════════════════════════════════════════
// COST BLOCK BUILDER — Multi-stage pricing block editor
// ═══════════════════════════════════════════════════════════════════════

export function CostBlockBuilder({ calculatorId }: { calculatorId: string }) {
    const store = useAppStore();
    const calculator = store.calculators.find((c) => c.id === calculatorId);
    const [showAddBlock, setShowAddBlock] = useState(false);
    const [newBlockLabel, setNewBlockLabel] = useState('');
    const [newBlockType, setNewBlockType] = useState<CostBlockType>('per-piece');

    if (!calculator) return null;

    const blocks = calculator.costBlocks || [];

    // All available operands: row keys + all earlier block formula outputs
    const rowFields = calculator.rows
        .filter((r) => r.key && r.label)
        .map((r) => ({ key: r.key, label: r.label }));

    const allOutputKeys = blocks.flatMap((b) =>
        b.formulas.map((f) => ({ key: f.outputKey, label: f.label || f.outputKey }))
    );

    const handleAddBlock = () => {
        if (!newBlockLabel.trim()) return;
        store.addCostBlock(calculatorId, newBlockLabel.trim(), newBlockType);
        setNewBlockLabel('');
        setNewBlockType('per-piece');
        setShowAddBlock(false);
    };

    return (
        <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-black flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Cost Blocks
                    <span className="text-black font-normal ml-1">({blocks.length} blocks)</span>
                </h3>
                <button
                    onClick={() => setShowAddBlock(!showAddBlock)}
                    className="btn-primary text-sm !px-3 !py-1.5"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Block
                </button>
            </div>

            {blocks.length === 0 && !showAddBlock && (
                <div className="glass rounded-2xl p-6 text-center">
                    <Layers className="w-10 h-10 text-black/20 mx-auto mb-2" />
                    <p className="text-black text-base">
                        No cost blocks yet. Add blocks to create a multi-stage pricing pipeline.
                    </p>
                    <p className="text-black/50 text-sm mt-1">
                        Each block computes a cost component (e.g. "Material Cost", "Transport", "Total").
                    </p>
                </div>
            )}

            {/* Add Block Form */}
            {showAddBlock && (
                <div className="glass rounded-2xl border border-black/10 p-4 space-y-3 animate-fade-in">
                    <h4 className="text-sm font-semibold text-black">New Cost Block</h4>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newBlockLabel}
                            onChange={(e) => setNewBlockLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddBlock(); }}
                            placeholder="Block name (e.g. Material Cost)..."
                            className="flex-1 rounded-xl bg-white border border-black/10 px-3 py-2 text-base text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                            autoFocus
                            aria-label="Block name"
                        />
                        <select
                            value={newBlockType}
                            onChange={(e) => setNewBlockType(e.target.value as CostBlockType)}
                            className="rounded-xl bg-white border border-black/10 px-3 py-2 text-sm text-black outline-none focus:ring-1 focus:ring-black/10"
                            aria-label="Block type"
                        >
                            {BLOCK_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddBlock}
                            disabled={!newBlockLabel.trim()}
                            className="btn-primary text-sm !px-4 !py-1.5 disabled:opacity-40"
                        >
                            Add Block
                        </button>
                        <button
                            onClick={() => setShowAddBlock(false)}
                            className="text-sm text-black/50 hover:text-black px-3 py-1.5 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Block List */}
            <div className="space-y-3">
                {blocks
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((block, blockIndex) => (
                        <BlockCard
                            key={block.id}
                            calculatorId={calculatorId}
                            block={block}
                            blockIndex={blockIndex}
                            totalBlocks={blocks.length}
                            rowFields={rowFields}
                            allOutputKeys={allOutputKeys}
                        />
                    ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// BLOCK CARD — Individual cost block editor
// ═══════════════════════════════════════════════════════════════════════

function BlockCard({
    calculatorId,
    block,
    blockIndex,
    totalBlocks,
    rowFields,
    allOutputKeys,
}: {
    calculatorId: string;
    block: { id: string; key: string; label: string; orderIndex: number; blockType: CostBlockType; isActive: boolean; isOptional: boolean; outputKey: string; formulas: { id: string; outputKey: string; label: string; operationType: BlockOperation; operands: string[]; orderIndex: number }[] };
    blockIndex: number;
    totalBlocks: number;
    rowFields: { key: string; label: string }[];
    allOutputKeys: { key: string; label: string }[];
}) {
    const store = useAppStore();
    const [collapsed, setCollapsed] = useState(false);
    const [showAddFormula, setShowAddFormula] = useState(false);
    const [newFormulaLabel, setNewFormulaLabel] = useState('');
    const [newFormulaOp, setNewFormulaOp] = useState<BlockOperation>('+');
    const [newFormulaOperands, setNewFormulaOperands] = useState<string[]>([]);

    // Operands available to THIS block's formulas: row fields + earlier blocks' outputs + this block's earlier formulas
    const thisBlockEarlierOutputs = block.formulas.map((f) => ({ key: f.outputKey, label: f.label || f.outputKey }));
    const availableOperands = [
        ...rowFields,
        ...allOutputKeys.filter((o) => !block.formulas.some((f) => f.outputKey === o.key)), // from other blocks
        ...thisBlockEarlierOutputs,
    ];
    // Deduplicate
    const seen = new Set<string>();
    const uniqueOperands = availableOperands.filter((o) => {
        if (!o.key || seen.has(o.key)) return false;
        seen.add(o.key);
        return true;
    });

    const typeBadge = BLOCK_TYPES.find((t) => t.value === block.blockType);

    const handleAddFormula = () => {
        if (!newFormulaLabel.trim() || newFormulaOperands.length === 0) return;
        const outputKey = labelToKey(newFormulaLabel.trim());
        store.addBlockFormula(calculatorId, block.id, {
            outputKey,
            label: newFormulaLabel.trim(),
            operationType: newFormulaOp,
            operands: newFormulaOperands,
            orderIndex: block.formulas.length + 1,
        });
        setNewFormulaLabel('');
        setNewFormulaOp('+');
        setNewFormulaOperands([]);
        setShowAddFormula(false);
    };

    const toggleOperand = (key: string) => {
        setNewFormulaOperands((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const getOperandLabel = (key: string) => {
        const found = uniqueOperands.find((o) => o.key === key);
        return found?.label || key;
    };

    return (
        <div className={`glass rounded-2xl border overflow-hidden transition-all ${block.isActive ? 'border-black/15' : 'border-black/5 opacity-60'
            }`}>
            {/* Block Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-black/[0.02]">
                {/* Reorder */}
                <div className="flex flex-col gap-0 shrink-0">
                    <button
                        onClick={() => store.moveCostBlock(calculatorId, block.id, 'up')}
                        disabled={blockIndex === 0}
                        className="p-0.5 text-black hover:text-black disabled:opacity-20 transition-colors"
                        title="Move up"
                    >
                        <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => store.moveCostBlock(calculatorId, block.id, 'down')}
                        disabled={blockIndex === totalBlocks - 1}
                        className="p-0.5 text-black hover:text-black disabled:opacity-20 transition-colors"
                        title="Move down"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>
                </div>

                {/* Order badge */}
                <span className="w-6 h-6 rounded-full bg-black/[0.06] flex items-center justify-center text-xs font-bold text-black shrink-0">
                    {block.orderIndex}
                </span>

                {/* Icon */}
                <Box className="w-4 h-4 text-black/50 shrink-0" />

                {/* Label */}
                <input
                    type="text"
                    value={block.label}
                    onChange={(e) => store.updateCostBlock(calculatorId, block.id, { label: e.target.value })}
                    className="flex-1 bg-transparent text-base font-semibold text-black outline-none"
                    aria-label="Block label"
                />

                {/* Type badge */}
                <span className="px-2 py-0.5 rounded-full bg-black/[0.04] text-[10px] font-semibold text-black/70 uppercase tracking-wider shrink-0">
                    {typeBadge?.label || block.blockType}
                </span>

                {/* Type selector */}
                <select
                    value={block.blockType}
                    onChange={(e) => store.updateCostBlock(calculatorId, block.id, { blockType: e.target.value as CostBlockType })}
                    className="rounded-md bg-white border border-black/10 px-2 py-1 text-xs text-black outline-none focus:ring-1 focus:ring-black/10"
                    aria-label="Block type"
                >
                    {BLOCK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>

                {/* Optional toggle */}
                <label className="flex items-center gap-1 text-xs text-black/50 cursor-pointer shrink-0" title="Optional block">
                    <input
                        type="checkbox"
                        checked={block.isOptional}
                        onChange={(e) => store.updateCostBlock(calculatorId, block.id, { isOptional: e.target.checked })}
                        className="rounded border-black/20 bg-white w-3 h-3"
                    />
                    Optional
                </label>

                {/* Active toggle */}
                <button
                    onClick={() => store.updateCostBlock(calculatorId, block.id, { isActive: !block.isActive })}
                    className={`p-1 rounded transition-colors ${block.isActive ? 'text-green-600' : 'text-black/30'}`}
                    title={block.isActive ? 'Active (click to disable)' : 'Inactive (click to enable)'}
                >
                    {block.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>

                {/* Collapse */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 text-black/40 hover:text-black transition-colors shrink-0"
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                {/* Delete */}
                <button
                    onClick={() => store.removeCostBlock(calculatorId, block.id)}
                    className="p-1 rounded text-black/30 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Delete block"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Block Body — Formulas */}
            {!collapsed && (
                <div className="border-t border-black/10 px-4 py-3 space-y-3">
                    {/* Existing formulas */}
                    {block.formulas.length > 0 && (
                        <div className="space-y-2">
                            {block.formulas
                                .sort((a, b) => a.orderIndex - b.orderIndex)
                                .map((formula) => {
                                    const opSymbol = OPERATIONS.find((o) => o.value === formula.operationType)?.symbol || formula.operationType;
                                    return (
                                        <div key={formula.id} className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2">
                                            <Calculator className="w-3.5 h-3.5 text-black/30 shrink-0" />
                                            <span className="text-sm font-semibold text-black shrink-0">{formula.label}</span>
                                            <span className="text-xs text-black/40">=</span>
                                            <div className="flex items-center gap-1 flex-wrap flex-1">
                                                {formula.operands.map((op, i) => (
                                                    <span key={i} className="flex items-center gap-1">
                                                        {i > 0 && (
                                                            <span className="text-xs font-bold text-black/60">{opSymbol}</span>
                                                        )}
                                                        <span className="px-2 py-0.5 rounded-lg bg-black/[0.04] text-xs font-medium text-black border border-black/10">
                                                            {getOperandLabel(op)}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-black/30 font-mono shrink-0">→ {formula.outputKey}</span>
                                            <button
                                                onClick={() => store.removeBlockFormula(calculatorId, block.id, formula.id)}
                                                className="p-1 rounded text-black/20 hover:text-red-500 transition-colors shrink-0"
                                                title="Remove formula"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {block.formulas.length === 0 && !showAddFormula && (
                        <p className="text-sm text-black/40 italic">No formulas in this block yet.</p>
                    )}

                    {/* Add Formula Form */}
                    {showAddFormula ? (
                        <div className="bg-black/[0.02] rounded-xl border border-black/10 p-3 space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newFormulaLabel}
                                    onChange={(e) => setNewFormulaLabel(e.target.value)}
                                    placeholder="Formula name (e.g. Total Area)..."
                                    className="flex-1 rounded-lg bg-white border border-black/10 px-2.5 py-1.5 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                                    autoFocus
                                    aria-label="Formula name"
                                />
                                <select
                                    value={newFormulaOp}
                                    onChange={(e) => setNewFormulaOp(e.target.value as BlockOperation)}
                                    className="rounded-lg bg-white border border-black/10 px-2 py-1.5 text-sm text-black outline-none"
                                    aria-label="Operation type"
                                >
                                    {OPERATIONS.map((op) => (
                                        <option key={op.value} value={op.value}>{op.symbol} {op.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Operand picker */}
                            <div>
                                <span className="text-[10px] text-black/50 uppercase tracking-wider block mb-1">
                                    Select operands ({newFormulaOperands.length} selected):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {uniqueOperands.map((field) => (
                                        <button
                                            key={field.key}
                                            onClick={() => toggleOperand(field.key)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${newFormulaOperands.includes(field.key)
                                                ? 'bg-black text-white border border-black'
                                                : 'bg-white text-black border border-black/10 hover:border-black/30'
                                                }`}
                                        >
                                            {field.label}
                                        </button>
                                    ))}
                                    {uniqueOperands.length === 0 && (
                                        <span className="text-xs text-black/30 italic">
                                            Add row fields first to use as operands.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Selected operands preview */}
                            {newFormulaOperands.length > 0 && (
                                <div className="flex items-center gap-1 text-sm">
                                    <span className="text-black/40">=</span>
                                    {newFormulaOperands.map((op, i) => (
                                        <span key={op} className="flex items-center gap-1">
                                            {i > 0 && (
                                                <span className="font-bold text-black/60">
                                                    {OPERATIONS.find((o) => o.value === newFormulaOp)?.symbol}
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 rounded-lg bg-black/5 text-xs font-medium text-black border border-black/10">
                                                {getOperandLabel(op)}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={handleAddFormula}
                                    disabled={!newFormulaLabel.trim() || newFormulaOperands.length === 0}
                                    className="btn-primary text-xs !px-3 !py-1.5 disabled:opacity-40"
                                >
                                    Save Formula
                                </button>
                                <button
                                    onClick={() => { setShowAddFormula(false); setNewFormulaOperands([]); setNewFormulaLabel(''); }}
                                    className="text-xs text-black/50 hover:text-black px-2 py-1.5 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddFormula(true)}
                            className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            Add Formula
                        </button>
                    )}

                    {/* Output key info */}
                    {block.outputKey && (
                        <div className="flex items-center gap-2 text-xs text-black/40 border-t border-black/5 pt-2">
                            <span>Block output:</span>
                            <span className="font-mono bg-black/[0.04] px-2 py-0.5 rounded-lg">{block.outputKey}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
