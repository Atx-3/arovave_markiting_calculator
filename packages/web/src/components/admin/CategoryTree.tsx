import { useState } from 'react';
import { FolderPlus, ChevronRight, ChevronDown, Trash2, Edit3, Check, X, FolderOpen, Calculator } from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';

// ─── Depth-based styling ──────────────────────────────────────────────

const DEPTH_STYLES = [
    { border: 'border-l-black/20', bg: 'bg-black/[0.02]', text: 'text-black', size: 'text-base' },
    { border: 'border-l-black/15', bg: 'bg-black/[0.02]', text: 'text-black', size: 'text-base' },
    { border: 'border-l-black/10', bg: 'bg-black/[0.02]', text: 'text-black', size: 'text-base' },
    { border: 'border-l-black/8', bg: 'bg-black/[0.02]', text: 'text-black', size: 'text-base' },
    { border: 'border-l-black/6', bg: 'bg-black/[0.02]', text: 'text-black', size: 'text-base' },
];

export function CategoryTree({
    onSelectCategory,
    selectedCategoryId,
}: {
    onSelectCategory: (id: string) => void;
    selectedCategoryId: string | null;
}) {
    const { categories, addCategory } = useAppStore();
    const [newCatName, setNewCatName] = useState('');
    const [addingTo, setAddingTo] = useState<string | null | undefined>(undefined);

    const rootCategories = categories
        .filter((c) => c.parentId === null)
        .sort((a, b) => a.order - b.order);

    const handleAdd = (parentId: string | null) => {
        if (newCatName.trim()) {
            addCategory(newCatName.trim(), parentId);
            setNewCatName('');
            setAddingTo(undefined);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-black">Category Tree</h3>
                <button
                    onClick={() => setAddingTo(null)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-black/50 hover:text-black transition-colors bg-black/[0.04] px-3 py-1.5 rounded-xl hover:bg-black/[0.06]"
                    title="Add root category"
                >
                    <FolderPlus className="w-4 h-4" />
                    Add Root
                </button>
            </div>

            {/* Add root input */}
            {addingTo === null && (
                <div className="flex items-center gap-2 bg-black/[0.02] rounded-2xl p-3 border border-black/10">
                    <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd(null)}
                        placeholder="Category name..."
                        className="flex-1 rounded-xl bg-white border border-black/10 px-3 py-2 text-base text-black placeholder:text-black/30 outline-none focus:ring-2 focus:ring-black/10"
                        autoFocus
                    />
                    <button onClick={() => handleAdd(null)} className="p-2 rounded-xl text-black hover:bg-black/[0.04] transition-colors" title="Create">
                        <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setAddingTo(undefined); setNewCatName(''); }} className="p-2 rounded-xl text-black hover:text-black transition-colors" title="Cancel">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {rootCategories.length === 0 && addingTo !== null && (
                <p className="text-base text-black text-center py-6">
                    No categories yet. Click "Add Root" to start.
                </p>
            )}

            {/* Tree */}
            <div className="space-y-2">
                {rootCategories.map((cat) => (
                    <CategoryNode
                        key={cat.id}
                        category={cat}
                        depth={0}
                        selectedId={selectedCategoryId}
                        onSelect={onSelectCategory}
                        addingTo={addingTo}
                        setAddingTo={setAddingTo}
                        newCatName={newCatName}
                        setNewCatName={setNewCatName}
                        handleAdd={handleAdd}
                    />
                ))}
            </div>
        </div>
    );
}

function CategoryNode({
    category,
    depth,
    selectedId,
    onSelect,
    addingTo,
    setAddingTo,
    newCatName,
    setNewCatName,
    handleAdd,
}: {
    category: { id: string; name: string };
    depth: number;
    selectedId: string | null;
    onSelect: (id: string) => void;
    addingTo: string | null | undefined;
    setAddingTo: (v: string | null | undefined) => void;
    newCatName: string;
    setNewCatName: (v: string) => void;
    handleAdd: (parentId: string | null) => void;
}) {
    const { categories, renameCategory, deleteCategory, getCalculatorForCategory } = useAppStore();
    const [expanded, setExpanded] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(category.name);

    const children = categories
        .filter((c) => c.parentId === category.id)
        .sort((a, b) => a.order - b.order);

    const hasCalc = !!getCalculatorForCategory(category.id);
    const isSelected = selectedId === category.id;
    const style = DEPTH_STYLES[depth % DEPTH_STYLES.length];

    return (
        <div className={`rounded-2xl overflow-hidden border-l-[3px] ${style.border} ${depth > 0 ? 'ml-6' : ''}`}>
            {/* Category row */}
            <div
                className={`flex items-center gap-3 py-3 px-4 cursor-pointer group transition-all duration-200 ${isSelected
                    ? 'bg-black/[0.06]'
                    : `${style.bg} hover:bg-black/[0.04]`
                    }`}
                onClick={() => onSelect(category.id)}
            >
                {/* Expand/collapse */}
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className={`p-1 rounded-md transition-colors hover:bg-black/[0.03] ${children.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                    title={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? (
                        <ChevronDown className="w-4 h-4 text-black/50" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-black" />
                    )}
                </button>

                {/* Icon */}
                {hasCalc ? (
                    <Calculator className="w-5 h-5 text-black shrink-0" />
                ) : (
                    <FolderOpen className="w-5 h-5 shrink-0 text-black" />
                )}

                {/* Name */}
                {editing ? (
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { renameCategory(category.id, editName); setEditing(false); }
                            if (e.key === 'Escape') setEditing(false);
                        }}
                        onBlur={() => { renameCategory(category.id, editName); setEditing(false); }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Category name..."
                        title="Rename category"
                        className={`flex-1 bg-transparent ${style.size} font-bold text-black outline-none border-b-2 border-brand-500/50`}
                        autoFocus
                    />
                ) : (
                    <span className={`flex-1 ${style.size} font-bold ${style.text} truncate`}>
                        {category.name}
                    </span>
                )}

                {/* Badges */}
                {hasCalc && (
                    <span className="text-[10px] text-black bg-accent-emerald/10 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        Calculator
                    </span>
                )}
                {children.length > 0 && (
                    <span className="text-[10px] text-black bg-white px-2 py-0.5 rounded-full shrink-0">
                        {children.length} sub
                    </span>
                )}

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => setAddingTo(category.id)}
                        className="p-1.5 rounded-xl hover:bg-black/[0.03] text-black hover:text-black/50 transition-colors"
                        title="Add sub-category"
                    >
                        <FolderPlus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setEditing(true); setEditName(category.name); }}
                        className="p-1.5 rounded-xl hover:bg-black/[0.03] text-black hover:text-black transition-colors"
                        title="Rename"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-1.5 rounded-xl hover:bg-red-50 text-black hover:text-red-500 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Children */}
            {expanded && (
                <div className="space-y-2 py-2 px-2">
                    {/* Add child input */}
                    {addingTo === category.id && (
                        <div className="flex items-center gap-2 ml-6 bg-black/[0.02] rounded-xl p-2 border border-brand-500/15">
                            <input
                                type="text"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd(category.id)}
                                placeholder="Sub-category name..."
                                className="flex-1 rounded-xl bg-white border border-black/10 px-3 py-1.5 text-base text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                                autoFocus
                            />
                            <button onClick={() => handleAdd(category.id)} className="p-1.5 rounded-xl text-black hover:bg-black/[0.04]" title="Create">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setAddingTo(undefined); setNewCatName(''); }} className="p-1.5 rounded-xl text-black hover:text-black" title="Cancel">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {children.map((child) => (
                        <CategoryNode
                            key={child.id}
                            category={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            addingTo={addingTo}
                            setAddingTo={setAddingTo}
                            newCatName={newCatName}
                            setNewCatName={setNewCatName}
                            handleAdd={handleAdd}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
