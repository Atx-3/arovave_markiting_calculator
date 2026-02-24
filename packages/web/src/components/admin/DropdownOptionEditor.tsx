import { Trash2, Plus } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';

export function DropdownOptionEditor({
    sectionIndex,
    fieldIndex,
}: {
    sectionIndex: number;
    fieldIndex: number;
}) {
    const { schema, addFieldOption, removeFieldOption, updateFieldOption } =
        useTemplateStore();
    const field = schema.sections[sectionIndex]?.fields[fieldIndex];
    const options = field?.options || [];

    return (
        <div className="rounded-xl bg-white/50 border border-surface-border p-3 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-black">Dropdown Options</span>
                <button
                    onClick={() => addFieldOption(sectionIndex, fieldIndex)}
                    className="flex items-center gap-1 text-sm text-black/50 hover:text-black transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    Add Option
                </button>
            </div>

            {options.length === 0 && (
                <p className="text-sm text-black text-center py-2">
                    No options yet. Add options with labels and rates.
                </p>
            )}

            {/* Column headers */}
            {options.length > 0 && (
                <div className="grid grid-cols-[1fr_1fr_100px_28px] gap-2 text-sm text-black px-1">
                    <span>Label</span>
                    <span>Value</span>
                    <span>Rate (₹)</span>
                    <span></span>
                </div>
            )}

            {options.map((option, optionIndex) => (
                <div
                    key={optionIndex}
                    className="grid grid-cols-[1fr_1fr_100px_28px] gap-2 items-center"
                >
                    <input
                        type="text"
                        value={option.label}
                        onChange={(e) =>
                            updateFieldOption(sectionIndex, fieldIndex, optionIndex, {
                                label: e.target.value,
                            })
                        }
                        placeholder="Steel"
                        className="rounded-md bg-white border border-black/10 px-2 py-1 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                    />

                    <input
                        type="text"
                        value={option.value}
                        onChange={(e) =>
                            updateFieldOption(sectionIndex, fieldIndex, optionIndex, {
                                value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                            })
                        }
                        placeholder="steel"
                        className="rounded-md bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                    />

                    <input
                        type="text"
                        value={option.rate}
                        onChange={(e) =>
                            updateFieldOption(sectionIndex, fieldIndex, optionIndex, {
                                rate: e.target.value,
                            })
                        }
                        placeholder="150.00"
                        className="rounded-md bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                    />

                    <button
                        onClick={() => removeFieldOption(sectionIndex, fieldIndex, optionIndex)}
                        className="p-1 rounded text-black hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove option"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            ))}
        </div>
    );
}
