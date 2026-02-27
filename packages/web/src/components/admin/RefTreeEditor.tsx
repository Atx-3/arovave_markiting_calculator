import { useState, useRef } from 'react';
import {
    Plus,
    Trash2,
    ChevronRight,
    ChevronDown,
    X,
    FolderTree,
    Tag,
    Upload,
    Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../../stores/templateStore';
import type { RefTree, RefTreeNode } from '../../types/calculator';

// ─── Helpers ─────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID().slice(0, 8);

function createEmptyTree(): RefTree {
    return { levels: ['Category'], nodes: [] };
}

// ═══════════════════════════════════════════════════════════════════════
// REF TREE EDITOR — Admin component to build drill-down reference trees
// ═══════════════════════════════════════════════════════════════════════

export function RefTreeEditor({
    calculatorId,
    rowId,
    onClose,
}: {
    calculatorId: string;
    rowId: string;
    onClose: () => void;
}) {
    const { calculators, updateRow } = useAppStore();
    const calc = calculators.find((c) => c.id === calculatorId);
    const row = calc?.rows.find((r) => r.id === rowId);

    const [tree, setTree] = useState<RefTree>(
        row?.refTree || createEmptyTree()
    );
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Save tree to store ───────────────────────────────────────────
    const saveTree = (newTree: RefTree) => {
        setTree(newTree);
        updateRow(calculatorId, rowId, { refTree: newTree });
    };

    // ── Level management ─────────────────────────────────────────────
    const addLevel = () => {
        const newTree = { ...tree, levels: [...tree.levels, `Level ${tree.levels.length + 1}`] };
        saveTree(newTree);
    };

    const renameLevel = (index: number, name: string) => {
        const levels = [...tree.levels];
        levels[index] = name;
        saveTree({ ...tree, levels });
    };

    const removeLevel = (index: number) => {
        if (tree.levels.length <= 1) return;
        const levels = tree.levels.filter((_, i) => i !== index);
        // Prune tree to match new depth
        const pruneToDepth = (nodes: RefTreeNode[], depth: number): RefTreeNode[] => {
            if (depth <= 0) return nodes.map((n) => ({ ...n, children: undefined }));
            return nodes.map((n) => ({
                ...n,
                children: n.children ? pruneToDepth(n.children, depth - 1) : undefined,
            }));
        };
        const nodes = pruneToDepth(tree.nodes, levels.length - 1);
        saveTree({ levels, nodes });
    };

    // ── Excel upload ─────────────────────────────────────────────────
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (rows.length < 2) return; // need header + at least 1 data row

            const headers = rows[0].map(String);
            // Last column = rate, preceding columns = levels
            const levelNames = headers.slice(0, -1);
            if (levelNames.length === 0) return;

            // Build tree from rows
            const rootNodes: RefTreeNode[] = [];

            for (let r = 1; r < rows.length; r++) {
                const cells = rows[r];
                if (!cells || cells.length === 0) continue;

                let currentNodes = rootNodes;
                for (let col = 0; col < levelNames.length; col++) {
                    const cellValue = String(cells[col] ?? '').trim();
                    if (!cellValue) break;

                    let existing = currentNodes.find((n) => n.name === cellValue);
                    if (!existing) {
                        existing = { id: uid(), name: cellValue };
                        if (col < levelNames.length - 1) {
                            existing.children = [];
                        }
                        currentNodes.push(existing);
                    }

                    if (col === levelNames.length - 1) {
                        // Last level — set rate from the final column
                        const rate = String(cells[levelNames.length] ?? '').trim();
                        if (rate) existing.rate = rate;
                    } else {
                        if (!existing.children) existing.children = [];
                        currentNodes = existing.children;
                    }
                }
            }

            const newTree: RefTree = { levels: levelNames, nodes: rootNodes };
            saveTree(newTree);
            // Expand all top-level nodes
            setExpandedNodes(new Set(rootNodes.map((n) => n.id)));
        };
        reader.readAsArrayBuffer(file);

        // Reset input so same file can be re-uploaded
        e.target.value = '';
    };

    // ── Download sample Excel ─────────────────────────────────────────
    const downloadSampleExcel = () => {
        const sampleData = [
            ['State', 'City', 'Rate'],
            ['Maharashtra', 'Mumbai', '45'],
            ['Maharashtra', 'Pune', '50'],
            ['Maharashtra', 'Nagpur', '42'],
            ['Gujarat', 'Ahmedabad', '40'],
            ['Gujarat', 'Surat', '38'],
            ['Rajasthan', 'Jaipur', '35'],
            ['Rajasthan', 'Udaipur', '37'],
        ];
        const ws = XLSX.utils.aoa_to_sheet(sampleData);
        ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sample');
        XLSX.writeFile(wb, 'ref_tree_sample.xlsx');
    };

    // ── Node management ──────────────────────────────────────────────
    const addNode = (parentPath: string[]) => {
        const newNode: RefTreeNode = { id: uid(), name: '' };
        const newTree = { ...tree, nodes: [...tree.nodes] };

        if (parentPath.length === 0) {
            // Top level
            newTree.nodes = [...tree.nodes, newNode];
        } else {
            // Navigate to parent and add child
            newTree.nodes = addChildAtPath(tree.nodes, parentPath, newNode);
        }
        saveTree(newTree);
    };

    const addChildAtPath = (
        nodes: RefTreeNode[],
        path: string[],
        child: RefTreeNode
    ): RefTreeNode[] => {
        return nodes.map((node) => {
            if (node.id === path[0]) {
                if (path.length === 1) {
                    return { ...node, children: [...(node.children || []), child] };
                }
                return {
                    ...node,
                    children: addChildAtPath(node.children || [], path.slice(1), child),
                };
            }
            return node;
        });
    };

    const removeNode = (path: string[]) => {
        const newNodes = removeAtPath(tree.nodes, path);
        saveTree({ ...tree, nodes: newNodes });
    };

    const removeAtPath = (nodes: RefTreeNode[], path: string[]): RefTreeNode[] => {
        if (path.length === 1) {
            return nodes.filter((n) => n.id !== path[0]);
        }
        return nodes.map((node) => {
            if (node.id === path[0]) {
                return {
                    ...node,
                    children: removeAtPath(node.children || [], path.slice(1)),
                };
            }
            return node;
        });
    };

    const updateNode = (path: string[], updates: Partial<RefTreeNode>) => {
        const newNodes = updateAtPath(tree.nodes, path, updates);
        saveTree({ ...tree, nodes: newNodes });
    };

    const updateAtPath = (
        nodes: RefTreeNode[],
        path: string[],
        updates: Partial<RefTreeNode>
    ): RefTreeNode[] => {
        return nodes.map((node) => {
            if (node.id === path[0]) {
                if (path.length === 1) {
                    return { ...node, ...updates };
                }
                return {
                    ...node,
                    children: updateAtPath(node.children || [], path.slice(1), updates),
                };
            }
            return node;
        });
    };

    // ── Toggle expand ────────────────────────────────────────────────
    const toggleExpand = (nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
            return next;
        });
    };

    // ── Render tree nodes recursively ────────────────────────────────
    const renderNodes = (nodes: RefTreeNode[], depth: number, parentPath: string[]) => {
        const isLeaf = depth >= tree.levels.length - 1;
        const levelName = tree.levels[depth] || 'Item';

        return (
            <div className="space-y-1">
                {nodes.map((node) => {
                    const currentPath = [...parentPath, node.id];
                    const isExpanded = expandedNodes.has(node.id);
                    const hasChildren = (node.children || []).length > 0;

                    return (
                        <div key={node.id}>
                            {/* Node row */}
                            <div
                                className={`flex items-center gap-1.5 group pl-[${depth * 20}px]`}
                            >
                                {/* Expand/collapse toggle (non-leaf only) */}
                                {!isLeaf ? (
                                    <button
                                        onClick={() => toggleExpand(node.id)}
                                        className="p-0.5 rounded text-black/30 hover:text-black hover:bg-black/5 transition-colors shrink-0"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                ) : (
                                    <span className="w-[18px] flex items-center justify-center shrink-0">
                                        <Tag className="w-3 h-3 text-black/20" />
                                    </span>
                                )}

                                {/* Name input */}
                                <input
                                    type="text"
                                    value={node.name}
                                    onChange={(e) => updateNode(currentPath, { name: e.target.value })}
                                    placeholder={`${levelName} name...`}
                                    className="flex-1 min-w-0 rounded bg-white border border-black/10 px-2 py-1 text-sm text-black placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                                />

                                {/* Rate input (leaf nodes only) */}
                                {isLeaf && (
                                    <input
                                        type="text"
                                        value={node.rate || ''}
                                        onChange={(e) => updateNode(currentPath, { rate: e.target.value })}
                                        placeholder="₹ Rate"
                                        className="w-20 rounded bg-white border border-black/10 px-2 py-1 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10 text-right"
                                    />
                                )}

                                {/* Delete button */}
                                <button
                                    onClick={() => removeNode(currentPath)}
                                    className="p-1 rounded text-black/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                    title="Remove"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Children (when expanded, for non-leaf) */}
                            {!isLeaf && isExpanded && (
                                <div className="mt-1">
                                    {hasChildren && renderNodes(node.children!, depth + 1, currentPath)}
                                    {/* Add child button */}
                                    <button
                                        onClick={() => addNode(currentPath)}
                                        className={`flex items-center gap-1 text-xs text-black/30 hover:text-black px-2 py-1 hover:bg-black/[0.03] rounded transition-colors mt-0.5 ml-[${(depth + 1) * 20}px]`}
                                        title={`Add ${tree.levels[depth + 1] || 'item'}`}
                                    >
                                        <Plus className="w-3 h-3" />
                                        Add {tree.levels[depth + 1] || 'item'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const nodeCount = countNodes(tree.nodes);

    return (
        <div className="glass rounded-2xl p-4 space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-black" />
                    <h3 className="text-sm font-bold text-black">
                        Reference Tree — {row?.label || 'Input'}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-black/30 hover:text-black transition-colors"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        title="Upload Excel file"
                        onChange={handleExcelUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-black/40 hover:text-black px-2 py-1 rounded-lg border border-black/10 hover:border-black/20 transition-colors"
                        title="Upload Excel file"
                    >
                        <Upload className="w-3 h-3" />
                        Upload
                    </button>
                    <button
                        onClick={downloadSampleExcel}
                        className="flex items-center gap-1 text-xs text-black/40 hover:text-black px-2 py-1 rounded-lg border border-black/10 hover:border-black/20 transition-colors"
                        title="Download sample Excel format"
                    >
                        <Download className="w-3 h-3" />
                        Sample
                    </button>
                </div>
            </div>

            {/* Level path */}
            <div>
                <div className="flex items-center gap-1 text-xs text-black/40 font-bold uppercase tracking-widest mb-2">
                    Drill-down path
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                    {tree.levels.map((level, i) => (
                        <div key={i} className="flex items-center gap-1">
                            {i > 0 && (
                                <ChevronRight className="w-3 h-3 text-black/20" />
                            )}
                            <div className="flex items-center gap-0.5 bg-black/[0.04] rounded-lg pl-1 pr-0.5 py-0.5">
                                <input
                                    type="text"
                                    value={level}
                                    onChange={(e) => renameLevel(i, e.target.value)}
                                    className="w-20 bg-transparent text-xs text-black font-medium outline-none text-center"
                                    placeholder="Level..."
                                />
                                {tree.levels.length > 1 && (
                                    <button
                                        onClick={() => removeLevel(i)}
                                        className="p-0.5 rounded text-black/20 hover:text-red-500 transition-colors"
                                        title="Remove level"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <ChevronRight className="w-3 h-3 text-black/20" />
                    <span className="text-xs text-black/30 italic">Rate</span>
                    <button
                        onClick={addLevel}
                        className="ml-1 flex items-center gap-0.5 text-xs text-black/30 hover:text-black px-1.5 py-0.5 rounded-lg border border-dashed border-black/10 hover:border-black/20 transition-colors"
                    >
                        <Plus className="w-2.5 h-2.5" />
                        Level
                    </button>
                </div>
            </div>

            {/* Tree content */}
            <div className="border-t border-black/5 pt-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-black/40 font-bold uppercase tracking-widest">
                        {tree.levels[0] || 'Items'} ({nodeCount} total)
                    </span>
                </div>

                {tree.nodes.length === 0 ? (
                    <div className="text-center py-6 text-sm text-black/30">
                        No items yet. Add your first {tree.levels[0]?.toLowerCase() || 'item'}.
                    </div>
                ) : (
                    renderNodes(tree.nodes, 0, [])
                )}

                {/* Add top-level node */}
                <button
                    onClick={() => addNode([])}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm text-black/30 hover:text-black py-2 rounded-xl border border-dashed border-black/10 hover:border-black/20 hover:bg-black/[0.02] transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add {tree.levels[0] || 'item'}
                </button>
            </div>
        </div>
    );
}

// Count all nodes in the tree (recursive)
function countNodes(nodes: RefTreeNode[]): number {
    let count = nodes.length;
    for (const node of nodes) {
        if (node.children) count += countNodes(node.children);
    }
    return count;
}
