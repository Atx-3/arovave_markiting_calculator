import { Trash2, Plus, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import { FieldEditor } from './FieldEditor';

export function SectionEditor() {
    const { schema, addSection, removeSection, updateSectionName, moveSection } =
        useTemplateStore();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-black">Sections & Fields</h2>
                <button onClick={addSection} className="btn-primary text-sm !px-3 !py-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Add Section
                </button>
            </div>

            {schema.sections.length === 0 && (
                <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-black text-base">
                        No sections yet. Add a section to start building your template.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {schema.sections.map((section, sectionIndex) => (
                    <SectionCard
                        key={sectionIndex}
                        section={section}
                        sectionIndex={sectionIndex}
                        totalSections={schema.sections.length}
                        onUpdateName={(name) => updateSectionName(sectionIndex, name)}
                        onRemove={() => removeSection(sectionIndex)}
                        onMoveUp={() => sectionIndex > 0 && moveSection(sectionIndex, sectionIndex - 1)}
                        onMoveDown={() =>
                            sectionIndex < schema.sections.length - 1 &&
                            moveSection(sectionIndex, sectionIndex + 1)
                        }
                    />
                ))}
            </div>
        </div>
    );
}

function SectionCard({
    section,
    sectionIndex,
    totalSections,
    onUpdateName,
    onRemove,
    onMoveUp,
    onMoveDown,
}: {
    section: { name: string; fields: any[] };
    sectionIndex: number;
    totalSections: number;
    onUpdateName: (name: string) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const { addField } = useTemplateStore();

    return (
        <div className="glass rounded-2xl border border-surface-border overflow-hidden">
            {/* Section Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-black/[0.02] border-b border-surface-border">
                <GripVertical className="w-4 h-4 text-black cursor-grab" />

                <div className="flex gap-1">
                    <button
                        onClick={onMoveUp}
                        disabled={sectionIndex === 0}
                        className="p-1 rounded text-black hover:text-black hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onMoveDown}
                        disabled={sectionIndex === totalSections - 1}
                        className="p-1 rounded text-black hover:text-black hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>

                <input
                    type="text"
                    value={section.name}
                    onChange={(e) => onUpdateName(e.target.value)}
                    placeholder="Section name..."
                    className="flex-1 bg-transparent text-black text-base font-semibold placeholder:text-black/30 outline-none"
                />

                <span className="text-sm text-black tabular-nums">
                    {section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
                </span>

                <button
                    onClick={onRemove}
                    className="p-1.5 rounded text-black hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove section"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Fields */}
            <div className="p-4 space-y-3">
                {section.fields.map((_, fieldIndex) => (
                    <FieldEditor
                        key={fieldIndex}
                        sectionIndex={sectionIndex}
                        fieldIndex={fieldIndex}
                    />
                ))}

                <button
                    onClick={() => addField(sectionIndex)}
                    className="w-full py-2 rounded-xl border border-dashed border-surface-border text-black text-sm font-semibold hover:text-black/50 hover:border-black/15 transition-colors"
                >
                    + Add Field
                </button>
            </div>
        </div>
    );
}
