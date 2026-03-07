import { useState } from 'react';
import {
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Hash,
    List,
    Lock,
    Search,
    ChevronDown as Expand,
    ChevronRight,
    AlertTriangle,
    FolderTree,
    Layers,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { InputType, InputDefinition } from '../../types/calculator';

// ═══════════════════════════════════════════════════════════════════════
// INPUT HUB — Centralized Input Management
// ═══════════════════════════════════════════════════════════════════════

const TYPE_META: Record<InputType, { label: string; icon: typeof Hash; color: string }> = {
    number: { label: 'Number', icon: Hash, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    dropdown: { label: 'Dropdown', icon: List, color: 'bg-purple-50 text-purple-600 border-purple-200' },
    fixed: { label: 'Fixed', icon: Lock, color: 'bg-amber-50 text-amber-600 border-amber-200' },
};

export function InputHub() {
    const store = useAppStore();
    const {
        inputDefinitions,
        addInput,
        removeInput,
        updateInput,
        moveInput,
        getInputUsage,
        addDropdownOption,
        removeDropdownOption,
        updateDropdownOption,
        addReferenceItem,
        removeReferenceItem,
        updateReferenceItem,
    } = store;

    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const sorted = [...inputDefinitions]
        .sort((a, b) => a.order - b.order)
        .filter((i) =>
            search ? i.name.toLowerCase().includes(search.toLowerCase()) : true,
        );

    const handleDelete = (id: string) => {
        const usage = getInputUsage(id);
        if (usage.length > 0) {
            setDeleteConfirm(id);
        } else {
            removeInput(id);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header Row */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-black">Input Hub</h2>
                    <p className="text-sm text-black/40 mt-0.5">
                        Define all inputs here — they're shared across every calculator.
                    </p>
                </div>

                {/* Add Button */}
                <div className="relative">
                    <button
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        className="btn-primary !text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Input
                    </button>

                    {showAddMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                            <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl shadow-black/10 border border-black/8 p-2 min-w-[200px] animate-slide-up">
                                {(Object.entries(TYPE_META) as [InputType, typeof TYPE_META.number][]).map(
                                    ([type, meta]) => {
                                        const Icon = meta.icon;
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    addInput(type);
                                                    setShowAddMenu(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/[0.03] transition-colors text-left group"
                                            >
                                                <div className={`p-1.5 rounded-lg border ${meta.color}`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold text-black block">
                                                        {meta.label} Input
                                                    </span>
                                                    <span className="text-[11px] text-black/40">
                                                        {type === 'number' && 'User enters a number value'}
                                                        {type === 'dropdown' && 'User picks from options'}
                                                        {type === 'fixed' && 'Admin-set constant value'}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    },
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Search */}
            {inputDefinitions.length > 3 && (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search inputs..."
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/[0.03] border border-black/5 text-sm text-black placeholder:text-black/25 outline-none focus:ring-2 focus:ring-black/10 transition-all"
                    />
                </div>
            )}

            {/* Input List */}
            {sorted.length === 0 ? (
                <div className="text-center py-16">
                    <Layers className="w-12 h-12 text-black/15 mx-auto mb-4" />
                    <p className="text-black/40 font-semibold">
                        {search ? 'No inputs match your search.' : 'No inputs yet. Add your first input above.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.map((input, idx) => (
                        <InputCard
                            key={input.id}
                            input={input}
                            index={idx}
                            total={sorted.length}
                            isExpanded={expandedId === input.id}
                            onToggleExpand={() =>
                                setExpandedId(expandedId === input.id ? null : input.id)
                            }
                            onDelete={() => handleDelete(input.id)}
                            onMove={(dir) => moveInput(input.id, dir)}
                            onUpdate={(updates) => updateInput(input.id, updates)}
                            usage={getInputUsage(input.id)}
                            onAddDropdownOption={() => addDropdownOption(input.id)}
                            onRemoveDropdownOption={(optId) => removeDropdownOption(input.id, optId)}
                            onUpdateDropdownOption={(optId, updates) =>
                                updateDropdownOption(input.id, optId, updates)
                            }
                            onAddReferenceItem={() => addReferenceItem(input.id)}
                            onRemoveReferenceItem={(itemId) => removeReferenceItem(input.id, itemId)}
                            onUpdateReferenceItem={(itemId, updates) =>
                                updateReferenceItem(input.id, itemId, updates)
                            }
                        />
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <DeleteConfirmModal
                    inputId={deleteConfirm}
                    onConfirm={() => {
                        removeInput(deleteConfirm);
                        setDeleteConfirm(null);
                    }}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT CARD — Single input item
// ═══════════════════════════════════════════════════════════════════════

function InputCard({
    input,
    index,
    total,
    isExpanded,
    onToggleExpand,
    onDelete,
    onMove,
    onUpdate,
    usage,
    onAddDropdownOption,
    onRemoveDropdownOption,
    onUpdateDropdownOption,
    onAddReferenceItem,
    onRemoveReferenceItem,
    onUpdateReferenceItem,
}: {
    input: InputDefinition;
    index: number;
    total: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onDelete: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onUpdate: (updates: Partial<InputDefinition>) => void;
    usage: { calcId: string; calcName: string }[];
    onAddDropdownOption: () => void;
    onRemoveDropdownOption: (id: string) => void;
    onUpdateDropdownOption: (id: string, updates: Record<string, string>) => void;
    onAddReferenceItem: () => void;
    onRemoveReferenceItem: (id: string) => void;
    onUpdateReferenceItem: (id: string, updates: Record<string, string>) => void;
}) {
    const meta = TYPE_META[input.type];
    const Icon = meta.icon;

    return (
        <div
            className={`rounded-2xl border transition-all duration-300 ${isExpanded
                ? 'bg-white border-black/12 shadow-lg shadow-black/5'
                : 'bg-white/80 border-black/6 hover:border-black/12 hover:shadow-md hover:shadow-black/5'
                }`}
        >
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                onClick={onToggleExpand}
            >
                {/* Type badge */}
                <div className={`p-1.5 rounded-lg border ${meta.color} shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={input.name}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-semibold text-black bg-transparent outline-none w-full"
                        placeholder="Input name..."
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-black/30 font-mono">{input.key}</span>
                        {usage.length > 0 && (
                            <span className="text-[10px] text-black/40 flex items-center gap-0.5">
                                · Used in {usage.length} calc{usage.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>



                {/* Fixed Value */}
                {input.type === 'fixed' && (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[10px] text-black/30 block text-right mb-0.5">Value</label>
                        <input
                            type="text"
                            value={input.fixedValue || ''}
                            onChange={(e) => onUpdate({ fixedValue: e.target.value })}
                            className="w-20 text-right text-sm font-mono font-semibold text-black bg-black/[0.03] rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-black/10 border border-black/5"
                            placeholder="0"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => onMove('up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg text-black/20 hover:text-black hover:bg-black/5 transition-colors disabled:opacity-0"
                        title="Move up"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onMove('down')}
                        disabled={index === total - 1}
                        className="p-1.5 rounded-lg text-black/20 hover:text-black hover:bg-black/5 transition-colors disabled:opacity-0"
                        title="Move down"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Expand indicator */}
                <ChevronRight
                    className={`w-4 h-4 text-black/20 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''
                        }`}
                />
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-black/5 space-y-4 animate-slide-up">
                    {/* Required toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={input.isRequired || false}
                            onChange={(e) => onUpdate({ isRequired: e.target.checked })}
                            className="w-4 h-4 rounded border-black/20 text-black focus:ring-black/20"
                        />
                        <span className="text-sm text-black/60 font-medium">Required field</span>
                    </label>

                    {/* Dropdown Options */}
                    {input.type === 'dropdown' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-black/50 uppercase tracking-wider">
                                    Options
                                </span>
                                <button
                                    onClick={onAddDropdownOption}
                                    className="text-xs text-black/40 hover:text-black font-semibold flex items-center gap-1 transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Option
                                </button>
                            </div>

                            {(!input.dropdownOptions || input.dropdownOptions.length === 0) && (
                                <p className="text-xs text-black/30 italic py-2">No options yet.</p>
                            )}

                            {input.dropdownOptions?.map((opt) => (
                                <div
                                    key={opt.id}
                                    className="flex items-center gap-2 bg-black/[0.02] rounded-xl px-3 py-2"
                                >
                                    <input
                                        type="text"
                                        value={opt.label}
                                        onChange={(e) =>
                                            onUpdateDropdownOption(opt.id, { label: e.target.value })
                                        }
                                        placeholder="Label..."
                                        className="flex-1 text-sm text-black bg-transparent outline-none placeholder:text-black/25"
                                    />
                                    <input
                                        type="text"
                                        value={opt.value}
                                        onChange={(e) =>
                                            onUpdateDropdownOption(opt.id, { value: e.target.value })
                                        }
                                        placeholder="Value..."
                                        className="w-24 text-sm text-black/60 bg-transparent outline-none placeholder:text-black/25 font-mono"
                                    />
                                    <input
                                        type="text"
                                        value={opt.rate}
                                        onChange={(e) =>
                                            onUpdateDropdownOption(opt.id, { rate: e.target.value })
                                        }
                                        placeholder="Rate"
                                        className="w-20 text-sm text-black bg-transparent outline-none placeholder:text-black/25 font-mono text-right"
                                    />
                                    <button
                                        onClick={() => onRemoveDropdownOption(opt.id)}
                                        className="p-1 rounded text-black/20 hover:text-red-500 transition-colors"
                                        title="Remove option"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Reference Items */}
                    {input.type === 'number' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-black/50 uppercase tracking-wider">
                                    Reference Items
                                </span>
                                <button
                                    onClick={onAddReferenceItem}
                                    className="text-xs text-black/40 hover:text-black font-semibold flex items-center gap-1 transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Item
                                </button>
                            </div>

                            {(!input.referenceItems || input.referenceItems.length === 0) && (
                                <p className="text-xs text-black/30 italic py-1">
                                    Optional: add reference values users can pick from.
                                </p>
                            )}

                            {input.referenceItems?.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-2 bg-black/[0.02] rounded-xl px-3 py-2"
                                >
                                    <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) =>
                                            onUpdateReferenceItem(item.id, { name: e.target.value })
                                        }
                                        placeholder="Name..."
                                        className="flex-1 text-sm text-black bg-transparent outline-none placeholder:text-black/25"
                                    />
                                    <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) =>
                                            onUpdateReferenceItem(item.id, { value: e.target.value })
                                        }
                                        placeholder="Value"
                                        className="w-24 text-sm text-black bg-transparent outline-none placeholder:text-black/25 font-mono text-right"
                                    />
                                    <button
                                        onClick={() => onRemoveReferenceItem(item.id)}
                                        className="p-1 rounded text-black/20 hover:text-red-500 transition-colors"
                                        title="Remove reference item"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Usage info */}
                    {usage.length > 0 && (
                        <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold mb-1">
                                <AlertTriangle className="w-3 h-3" />
                                Used in {usage.length} calculator{usage.length > 1 ? 's' : ''}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {usage.map((u) => (
                                    <span
                                        key={u.calcId}
                                        className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium"
                                    >
                                        {u.calcName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════

function DeleteConfirmModal({
    inputId,
    onConfirm,
    onCancel,
}: {
    inputId: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const { inputDefinitions, getInputUsage } = useAppStore();
    const input = inputDefinitions.find((i) => i.id === inputId);
    const usage = getInputUsage(inputId);

    if (!input) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4 animate-slide-up">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-50">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-black">Delete "{input.name}"?</h3>
                        <p className="text-sm text-black/50 mt-0.5">
                            This will remove it from {usage.length} calculator{usage.length > 1 ? 's' : ''}:
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {usage.map((u) => (
                        <span
                            key={u.calcId}
                            className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium"
                        >
                            {u.calcName}
                        </span>
                    ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-black/50 hover:text-black font-semibold rounded-xl hover:bg-black/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 font-semibold rounded-xl transition-colors"
                    >
                        Delete Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}
