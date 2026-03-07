import { useState } from 'react';
import {
    Search,
    DollarSign,
    Check,
    X,
    AlertTriangle,
    ChevronDown,
    ChevronRight,

    List,
    Lock,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';

// ═══════════════════════════════════════════════════════════════════════
// RATE MANAGER — Central view of all rates from Input Hub
// Shows fixed values and dropdown option rates.
// Rates can only be UPDATED here (with a warning), NOT added or deleted.
// ═══════════════════════════════════════════════════════════════════════

type EditTarget =
    | { kind: 'fixedValue'; inputId: string }
    | { kind: 'dropdownRate'; inputId: string; optionId: string };

export function RateManager() {
    const store = useAppStore();
    const { inputDefinitions, calculators } = store;

    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<EditTarget | null>(null);
    const [pendingValue, setPendingValue] = useState('');
    const [showWarning, setShowWarning] = useState<{ target: EditTarget; inputName: string; affectedCalcs: string[] } | null>(null);
    const [expandedDropdowns, setExpandedDropdowns] = useState<Set<string>>(new Set());

    // Gather all rate-bearing inputs
    const fixedInputs = inputDefinitions.filter((i) => i.type === 'fixed');
    const dropdownInputs = inputDefinitions.filter((i) => i.type === 'dropdown');

    const hasAnyRates = fixedInputs.length > 0 || dropdownInputs.length > 0;

    // Search filter
    const matchesSearch = (text: string) =>
        !search || text.toLowerCase().includes(search.toLowerCase());

    const filteredFixed = fixedInputs.filter((i) => matchesSearch(i.name));
    const filteredDropdown = dropdownInputs.filter((i) => {
        if (matchesSearch(i.name)) return true;
        return (i.dropdownOptions || []).some((o) => matchesSearch(o.label));
    });

    const hasFilteredResults = filteredFixed.length > 0 || filteredDropdown.length > 0;

    // Toggle dropdown expand
    const toggleDropdown = (id: string) => {
        setExpandedDropdowns((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Find affected calculators for an input
    const getAffectedCalcs = (inputId: string): string[] => {
        return calculators
            .filter((c) => (c.usedInputIds || []).includes(inputId))
            .map((c) => c.name);
    };

    // Start editing — show warning first
    const requestEdit = (target: EditTarget, currentValue: string) => {
        const inputId = target.inputId;
        const input = inputDefinitions.find((i) => i.id === inputId);
        const inputName = input?.name || 'Unknown';
        const affectedCalcs = getAffectedCalcs(inputId);
        setShowWarning({ target, inputName, affectedCalcs });
        setPendingValue(currentValue);
    };

    // User confirmed the warning
    const confirmEdit = () => {
        if (!showWarning) return;
        setEditing(showWarning.target);
        setShowWarning(null);
    };

    // Commit the edit
    const commitEdit = () => {
        if (!editing) return;
        if (editing.kind === 'fixedValue') {
            store.updateInput(editing.inputId, { fixedValue: pendingValue });
        } else if (editing.kind === 'dropdownRate') {
            store.updateDropdownOption(editing.inputId, editing.optionId, { rate: pendingValue });
        }
        setEditing(null);
    };

    const cancelEdit = () => {
        setEditing(null);
    };

    const isEditing = (target: EditTarget) => {
        if (!editing) return false;
        if (editing.kind !== target.kind) return false;
        if (editing.inputId !== target.inputId) return false;
        if (editing.kind === 'dropdownRate' && target.kind === 'dropdownRate') {
            return editing.optionId === target.optionId;
        }
        return true;
    };

    // Editable cell renderer
    const RateCell = ({ target, currentValue }: { target: EditTarget; currentValue: string }) => {
        const active = isEditing(target);
        return (
            <div className="flex items-center gap-1.5">
                {active ? (
                    <>
                        <span className="text-black/30 text-sm">₹</span>
                        <input
                            type="text"
                            value={pendingValue}
                            onChange={(e) => setPendingValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                            className="w-24 text-sm font-mono text-black bg-white border border-black/15 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-black/15"
                            placeholder="0"
                        />
                        <button
                            onClick={commitEdit}
                            className="p-1 rounded-md bg-black text-white hover:bg-black/80 transition-colors"
                            title="Save"
                        >
                            <Check className="w-3 h-3" />
                        </button>
                        <button
                            onClick={cancelEdit}
                            className="p-1 rounded-md text-black/30 hover:text-black transition-colors"
                            title="Cancel"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => requestEdit(target, currentValue)}
                        className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-black/[0.04] transition-colors cursor-pointer"
                        title="Click to edit rate"
                    >
                        <span className="text-sm font-mono font-semibold text-black">
                            ₹{currentValue || '0'}
                        </span>
                        <span className="text-[10px] text-black/0 group-hover:text-black/30 transition-colors">
                            edit
                        </span>
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-black">Rate Manager</h2>
                <p className="text-sm text-black/40 mt-0.5">
                    View and update all rates from Input Hub. Click any rate value to edit it.
                </p>
            </div>

            {/* Search */}
            {hasAnyRates && (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search inputs and rates..."
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/[0.03] border border-black/5 text-sm text-black placeholder:text-black/25 outline-none focus:ring-2 focus:ring-black/10 transition-all"
                    />
                </div>
            )}

            {/* Empty state */}
            {!hasAnyRates && (
                <div className="text-center py-16 rounded-2xl border-2 border-dashed border-black/10">
                    <DollarSign className="w-10 h-10 text-black/15 mx-auto mb-3" />
                    <p className="text-sm text-black/30 font-medium mb-1">
                        No rates to manage yet
                    </p>
                    <p className="text-xs text-black/20 max-w-xs mx-auto">
                        Go to the <strong>Input Hub</strong> tab to create Fixed or Dropdown inputs. Their rates will appear here.
                    </p>
                </div>
            )}

            {/* No search results */}
            {hasAnyRates && !hasFilteredResults && search && (
                <div className="text-center py-8">
                    <p className="text-sm text-black/30">No rates match "{search}"</p>
                </div>
            )}

            {/* ── FIXED VALUE INPUTS ── */}
            {filteredFixed.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <Lock className="w-3.5 h-3.5 text-black/30" />
                        <h3 className="text-xs font-bold text-black/40 uppercase tracking-widest">
                            Fixed Values
                        </h3>
                        <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded-full font-bold text-black/30">
                            {filteredFixed.length}
                        </span>
                    </div>

                    <div className="rounded-2xl border border-black/8 overflow-hidden">
                        <div className="grid grid-cols-[1fr_120px_100px] gap-3 px-5 py-2.5 bg-black/[0.03] text-[10px] text-black/40 uppercase tracking-widest font-bold">
                            <span>Input Name</span>
                            <span>Fixed Value</span>
                            <span>Type</span>
                        </div>
                        <div className="divide-y divide-black/5">
                            {filteredFixed.map((input) => (
                                <div
                                    key={input.id}
                                    className="grid grid-cols-[1fr_120px_100px] gap-3 px-5 py-3 items-center hover:bg-black/[0.01] transition-colors"
                                >
                                    <span className="text-sm font-semibold text-black">{input.name}</span>
                                    <RateCell
                                        target={{ kind: 'fixedValue', inputId: input.id }}
                                        currentValue={input.fixedValue || '0'}
                                    />
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full w-fit">
                                        FIXED
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── DROPDOWN INPUT RATES ── */}
            {filteredDropdown.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <List className="w-3.5 h-3.5 text-black/30" />
                        <h3 className="text-xs font-bold text-black/40 uppercase tracking-widest">
                            Dropdown Rates
                        </h3>
                        <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded-full font-bold text-black/30">
                            {filteredDropdown.length}
                        </span>
                    </div>

                    <div className="rounded-2xl border border-black/8 overflow-hidden divide-y divide-black/5">
                        {filteredDropdown.map((input) => {
                            const options = input.dropdownOptions || [];
                            const isExpanded = expandedDropdowns.has(input.id);

                            return (
                                <div key={input.id}>
                                    {/* Dropdown header row */}
                                    <button
                                        onClick={() => toggleDropdown(input.id)}
                                        className="w-full grid grid-cols-[1fr_120px_100px] gap-3 px-5 py-3 items-center hover:bg-black/[0.02] transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isExpanded
                                                ? <ChevronDown className="w-3.5 h-3.5 text-black/30 shrink-0" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-black/30 shrink-0" />
                                            }
                                            <span className="text-sm font-semibold text-black text-left">{input.name}</span>
                                        </div>
                                        <span className="text-xs text-black/40 font-medium">
                                            {options.length} option{options.length !== 1 ? 's' : ''}
                                        </span>
                                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full w-fit">
                                            DROPDOWN
                                        </span>
                                    </button>

                                    {/* Expanded options */}
                                    {isExpanded && options.length > 0 && (
                                        <div className="bg-black/[0.015]">
                                            {/* Sub-header */}
                                            <div className="grid grid-cols-[1fr_120px_100px] gap-3 px-5 pl-12 py-2 text-[10px] text-black/30 uppercase tracking-widest font-bold border-t border-black/5">
                                                <span>Option Label</span>
                                                <span>Rate</span>
                                                <span>Value</span>
                                            </div>
                                            <div className="divide-y divide-black/[0.03]">
                                                {options.map((opt) => (
                                                    <div
                                                        key={opt.id}
                                                        className="grid grid-cols-[1fr_120px_100px] gap-3 px-5 pl-12 py-2.5 items-center hover:bg-black/[0.02] transition-colors"
                                                    >
                                                        <span className="text-sm text-black/70">{opt.label || 'Unnamed'}</span>
                                                        <RateCell
                                                            target={{ kind: 'dropdownRate', inputId: input.id, optionId: opt.id }}
                                                            currentValue={opt.rate || '0'}
                                                        />
                                                        <span className="text-xs text-black/40 font-mono">{opt.value || '—'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {isExpanded && options.length === 0 && (
                                        <div className="px-5 pl-12 py-3 text-xs text-black/30 bg-black/[0.015] border-t border-black/5">
                                            No options defined. Add options in the Input Hub.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── WARNING MODAL ── */}
            {showWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4 animate-slide-up">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-amber-50 shrink-0 mt-0.5">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-black">
                                    Update "{showWarning.inputName}" rate?
                                </h3>
                                {showWarning.affectedCalcs.length > 0 ? (
                                    <>
                                        <p className="text-sm text-black/50 mt-1">
                                            This change will affect the following calculator{showWarning.affectedCalcs.length > 1 ? 's' : ''}:
                                        </p>
                                        <div className="mt-2 space-y-1">
                                            {showWarning.affectedCalcs.map((name, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-2 text-sm font-semibold text-black bg-amber-50 px-3 py-1.5 rounded-lg"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                                    {name}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-black/40 mt-1">
                                        No calculators currently use this input.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                            <button
                                onClick={() => setShowWarning(null)}
                                className="px-4 py-2 text-sm text-black/50 hover:text-black font-semibold rounded-xl hover:bg-black/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmEdit}
                                className="px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 font-semibold rounded-xl transition-colors"
                            >
                                Yes, Edit Rate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
