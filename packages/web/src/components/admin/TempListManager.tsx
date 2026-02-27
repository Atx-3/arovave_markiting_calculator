import { useState } from 'react';
import { Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';

export function TempListManager({ calculatorId }: { calculatorId: string }) {
    const { calculators, addTempItem, removeTempItem, updateTempItem } = useAppStore();
    const calculator = calculators.find((c) => c.id === calculatorId);
    const tempItems = calculator?.tempItems || [];

    const [newName, setNewName] = useState('');
    const [newRate, setNewRate] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editRate, setEditRate] = useState('');

    const handleAdd = () => {
        if (newName.trim() && newRate.trim()) {
            addTempItem(calculatorId, newName.trim(), newRate.trim());
            setNewName('');
            setNewRate('');
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-base font-semibold text-black">Temporary Items List</h3>
                <p className="text-sm text-black mt-1">
                    These items appear as a reference sidebar for users on this calculator.
                </p>
            </div>

            {/* Add new item */}
            <div className="glass rounded-2xl p-3">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Item name..."
                        className="flex-1 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <input
                        type="text"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                        placeholder="Rate (₹)"
                        className="w-28 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button onClick={handleAdd} className="btn-primary text-sm !px-3 !py-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        Add
                    </button>
                </div>
            </div>

            {/* Items list */}
            {tempItems.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center">
                    <p className="text-black text-base">
                        No temp items for this calculator yet.
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_100px_60px] gap-2 text-[10px] text-black uppercase tracking-wider px-3">
                        <span>Item Name</span>
                        <span>Rate (₹)</span>
                        <span></span>
                    </div>

                    {tempItems.map((item) => (
                        <div
                            key={item.id}
                            className="glass rounded-xl p-2 grid grid-cols-[1fr_100px_60px] gap-2 items-center group"
                        >
                            {editingId === item.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Item name"
                                        className="rounded bg-white border border-black/10 px-2 py-1 text-sm text-black outline-none focus:ring-1 focus:ring-black/10"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        value={editRate}
                                        onChange={(e) => setEditRate(e.target.value)}
                                        placeholder="Rate (₹)"
                                        className="rounded bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                                updateTempItem(calculatorId, item.id, { name: editName, rate: editRate });
                                                setEditingId(null);
                                            }}
                                            className="p-1 rounded text-black hover:bg-black/[0.04] transition-colors"
                                            title="Save"
                                        >
                                            <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="p-1 rounded text-black hover:text-black transition-colors"
                                            title="Cancel"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="text-sm text-black flex items-center gap-1.5">
                                        {item.name || <span className="text-black/30 italic">Unnamed</span>}
                                        {item.autoFromRowId && (
                                            <span className="text-[9px] uppercase tracking-wider text-black/30 bg-black/[0.04] px-1.5 py-0.5 rounded font-bold">Auto</span>
                                        )}
                                    </span>
                                    <span className="text-sm text-black font-mono">
                                        {item.rate ? `₹${item.rate}` : <span className="text-black/30 italic text-xs">Set rate →</span>}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setEditingId(item.id);
                                                setEditName(item.name);
                                                setEditRate(item.rate);
                                            }}
                                            className="p-1 rounded text-black hover:text-black hover:bg-white transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => removeTempItem(calculatorId, item.id)}
                                            className="p-1 rounded text-black hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
