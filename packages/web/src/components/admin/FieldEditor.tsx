import { Trash2 } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import { DropdownOptionEditor } from './DropdownOptionEditor';
import type { FieldType } from '@arovave/engine';

const FIELD_TYPES: { value: FieldType; label: string; desc: string }[] = [
    { value: 'number', label: 'Number', desc: 'User enters a numeric value' },
    { value: 'dropdown', label: 'Dropdown', desc: 'User picks from options with rates' },
    { value: 'fixed', label: 'Fixed', desc: 'Hidden constant value' },
];

export function FieldEditor({
    sectionIndex,
    fieldIndex,
}: {
    sectionIndex: number;
    fieldIndex: number;
}) {
    const { schema, updateField, removeField } = useTemplateStore();
    const field = schema.sections[sectionIndex]?.fields[fieldIndex];

    if (!field) return null;

    return (
        <div className="rounded-xl bg-white/60 border border-surface-border p-3 space-y-3">
            {/* Top row: type + key + label + delete */}
            <div className="flex items-start gap-2">
                {/* Type selector */}
                <select
                    value={field.type}
                    onChange={(e) =>
                        updateField(sectionIndex, fieldIndex, {
                            type: e.target.value as FieldType,
                            options: e.target.value === 'dropdown' ? [] : undefined,
                        })
                    }
                    className="w-32 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-black/10"
                >
                    {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>

                {/* Key */}
                <input
                    type="text"
                    value={field.key}
                    onChange={(e) =>
                        updateField(sectionIndex, fieldIndex, {
                            key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                        })
                    }
                    placeholder="field_key"
                    className="w-36 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                />

                {/* Label */}
                <input
                    type="text"
                    value={field.label}
                    onChange={(e) =>
                        updateField(sectionIndex, fieldIndex, { label: e.target.value })
                    }
                    placeholder="Display label..."
                    className="flex-1 rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                />

                {/* Delete */}
                <button
                    onClick={() => removeField(sectionIndex, fieldIndex)}
                    className="p-1.5 rounded text-black hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Remove field"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Second row: toggles + default value */}
            <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5 text-black cursor-pointer">
                    <input
                        type="checkbox"
                        checked={field.isRequired}
                        onChange={(e) =>
                            updateField(sectionIndex, fieldIndex, {
                                isRequired: e.target.checked,
                            })
                        }
                        className="rounded border-surface-border bg-white text-brand-500 focus:ring-black/10 w-3.5 h-3.5"
                    />
                    Required
                </label>

                <label className="flex items-center gap-1.5 text-black cursor-pointer">
                    <input
                        type="checkbox"
                        checked={field.isVisible}
                        onChange={(e) =>
                            updateField(sectionIndex, fieldIndex, {
                                isVisible: e.target.checked,
                            })
                        }
                        className="rounded border-surface-border bg-white text-brand-500 focus:ring-black/10 w-3.5 h-3.5"
                    />
                    Visible
                </label>

                {(field.type === 'number' || field.type === 'fixed') && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-black">Default:</span>
                        <input
                            type="text"
                            value={field.defaultValue || ''}
                            onChange={(e) =>
                                updateField(sectionIndex, fieldIndex, {
                                    defaultValue: e.target.value,
                                })
                            }
                            placeholder="0"
                            className="w-24 rounded-md bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                        />
                    </div>
                )}
            </div>

            {/* Dropdown options */}
            {field.type === 'dropdown' && (
                <DropdownOptionEditor
                    sectionIndex={sectionIndex}
                    fieldIndex={fieldIndex}
                />
            )}
        </div>
    );
}
