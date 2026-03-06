import { useState } from 'react';
import {
    AlertTriangle,
    Search,
    Hash,
    List,
    Lock,
    Check,
    X,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import type { InputType } from '../../types/calculator';

// ═══════════════════════════════════════════════════════════════════════
// RATE MANAGER — Centralized Rate Editing
// ═══════════════════════════════════════════════════════════════════════

const TYPE_BADGE: Record<InputType, { label: string; icon: typeof Hash; cls: string }> = {
    number: { label: 'Number', icon: Hash, cls: 'bg-blue-50 text-blue-600' },
    dropdown: { label: 'Dropdown', icon: List, cls: 'bg-purple-50 text-purple-600' },
    fixed: { label: 'Fixed', icon: Lock, cls: 'bg-amber-50 text-amber-600' },
};

export function RateManager() {
    const store = useAppStore();
    const { inputDefinitions, updateInput, getInputUsage } = store;

    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pendingRate, setPendingRate] = useState('');
    const [confirmModal, setConfirmModal] = useState<{
        inputId: string;
        newRate: string;
        affectedCalcs: { calcId: string; calcName: string }[];
    } | null>(null);

    const sorted = [...inputDefinitions]
        .sort((a, b) => a.order - b.order)
        .filter((i) =>
            search
                ? i.name.toLowerCase().includes(search.toLowerCase())
                : true,
        );

    const startEdit = (id: string, currentRate: string) => {
        setEditingId(id);
        setPendingRate(currentRate);
    };

    const commitEdit = (id: string) => {
        const input = inputDefinitions.find((i) => i.id === id);
        if (!input) return;

        const current = input.type === 'fixed' ? input.fixedValue || '0' : input.rate;
        if (pendingRate === current) {
            setEditingId(null);
            return;
        }

        const usage = getInputUsage(id);
        if (usage.length > 0) {
            setConfirmModal({ inputId: id, newRate: pendingRate, affectedCalcs: usage });
        } else {
            applyRateChange(id, pendingRate);
        }
    };

    const applyRateChange = (id: string, newRate: string) => {
        const input = inputDefinitions.find((i) => i.id === id);
        if (!input) return;

        if (input.type === 'fixed') {
            updateInput(id, { fixedValue: newRate });
        } else {
            updateInput(id, { rate: newRate });
        }
        setEditingId(null);
        setConfirmModal(null);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-black">Rate Manager</h2>
                <p className="text-sm text-black/40 mt-0.5">
                    Change any rate here — it updates everywhere. Affected calculators will be warned.
                </p>
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

            {/* Rate Table */}
            {sorted.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-black/40 font-semibold">
                        {search ? 'No inputs match your search.' : 'No inputs defined yet.'}
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl border border-black/8 overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_100px_140px_120px] gap-3 px-5 py-3 bg-black/[0.03] text-[10px] text-black/40 uppercase tracking-widest font-bold">
                        <span>Input Name</span>
                        <span>Type</span>
                        <span>Rate / Value</span>
                        <span>Used In</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-black/5">
                        {sorted.map((input) => {
                            const badge = TYPE_BADGE[input.type];
                            const BadgeIcon = badge.icon;
                            const usage = getInputUsage(input.id);
                            const currentVal = input.type === 'fixed' ? input.fixedValue || '0' : input.rate;
                            const isEditing = editingId === input.id;

                            return (
                                <div
                                    key={input.id}
                                    className="grid grid-cols-[1fr_100px_140px_120px] gap-3 px-5 py-3.5 items-center hover:bg-black/[0.01] transition-colors"
                                >
                                    {/* Name */}
                                    <div>
                                        <span className="text-sm font-semibold text-black">
                                            {input.name}
                                        </span>
                                        <span className="text-[10px] text-black/25 font-mono block mt-0.5">
                                            {input.key}
                                        </span>
                                    </div>

                                    {/* Type Badge */}
                                    <div>
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}
                                        >
                                            <BadgeIcon className="w-2.5 h-2.5" />
                                            {badge.label}
                                        </span>
                                    </div>

                                    {/* Rate */}
                                    <div>
                                        {isEditing ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={pendingRate}
                                                    onChange={(e) => setPendingRate(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') commitEdit(input.id);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                    autoFocus
                                                    placeholder="0"
                                                    title="Edit rate value"
                                                    className="w-20 text-sm font-mono text-black bg-white border border-black/15 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-black/15"
                                                />
                                                <button
                                                    onClick={() => commitEdit(input.id)}
                                                    className="p-1 rounded-md bg-black text-white hover:bg-black/80 transition-colors"
                                                    title="Confirm rate change"
                                                >
                                                    <Check className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1 rounded-md text-black/30 hover:text-black transition-colors"
                                                    title="Cancel edit"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(input.id, currentVal)}
                                                className="text-sm font-mono font-semibold text-black hover:bg-black/[0.04] px-2 py-1 rounded-lg transition-colors text-left"
                                            >
                                                ₹{currentVal}
                                            </button>
                                        )}
                                    </div>

                                    {/* Usage */}
                                    <div>
                                        {usage.length > 0 ? (
                                            <span className="text-xs text-black/50 font-medium">
                                                {usage.length} calc{usage.length > 1 ? 's' : ''}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-black/20">Unused</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4 animate-slide-up">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-amber-50">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-black">Rate Change Warning</h3>
                                <p className="text-sm text-black/50 mt-0.5">
                                    This rate is used in {confirmModal.affectedCalcs.length} calculator
                                    {confirmModal.affectedCalcs.length > 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        <div className="bg-black/[0.02] rounded-xl p-3 space-y-1">
                            <p className="text-xs text-black/40 font-semibold">Affected calculators:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {confirmModal.affectedCalcs.map((c) => (
                                    <span
                                        key={c.calcId}
                                        className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium"
                                    >
                                        {c.calcName}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <p className="text-sm text-black/60">
                            Changing this rate to <strong className="font-mono">₹{confirmModal.newRate}</strong> will
                            update it in all calculators listed above.
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => {
                                    setConfirmModal(null);
                                    setEditingId(null);
                                }}
                                className="px-4 py-2 text-sm text-black/50 hover:text-black font-semibold rounded-xl hover:bg-black/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() =>
                                    applyRateChange(confirmModal.inputId, confirmModal.newRate)
                                }
                                className="px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 font-semibold rounded-xl transition-colors"
                            >
                                Update Everywhere
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
