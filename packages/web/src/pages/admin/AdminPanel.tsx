import { useState, useRef } from 'react';
import {
    Settings,
    FolderTree,
    Calculator,
    ListChecks,
    Plus,
    ChevronRight,
    FileSpreadsheet,
    Upload,
    Link2,
    X,
    Check,
} from 'lucide-react';
import { useAppStore } from '../../stores/templateStore';
import { CategoryTree } from '../../components/admin/CategoryTree';
import { CalculatorBuilder } from '../../components/admin/CalculatorBuilder';
import { TempListManager } from '../../components/admin/TempListManager';
import * as XLSX from 'xlsx';
import type { RowType } from '../../types/calculator';

type Tab = 'categories' | 'calculator' | 'temp-lists';

export function AdminPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('categories');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const store = useAppStore();
    const {
        categories,
        createCalculator,
        getCalculatorForCategory,
        getCategoryBreadcrumb,
    } = store;

    const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
    const selectedCalc = selectedCategoryId ? getCalculatorForCategory(selectedCategoryId) : undefined;

    const handleSelectCategory = (id: string) => {
        setSelectedCategoryId(id);
        const calc = getCalculatorForCategory(id);
        if (calc) setActiveTab('calculator');
    };

    const breadcrumb = selectedCategoryId ? getCategoryBreadcrumb(selectedCategoryId) : [];

    const tabs: { key: Tab; label: string; icon: typeof FolderTree }[] = [
        { key: 'categories', label: 'Categories', icon: FolderTree },
        { key: 'calculator', label: 'Calculator', icon: Calculator },
        { key: 'temp-lists', label: 'Temp List', icon: ListChecks },
    ];

    return (
        <div className="space-y-8 animate-slide-up">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-black flex items-center gap-3 tracking-tight">
                    <Settings className="w-7 h-7 text-black/40" />
                    Admin Panel
                </h1>
                <p className="mt-2 text-base text-black/50">
                    Create categories, build calculators, and manage temp item lists — each category has its own.
                </p>
            </div>

            {/* Selected category indicator */}
            {selectedCategory && (
                <div className="flex items-center gap-2 text-sm bg-black/[0.03] border border-black/10 rounded-2xl px-5 py-3">
                    <span className="text-black/50 font-semibold">Selected:</span>
                    {breadcrumb.map((cat, i) => (
                        <span key={cat.id} className="flex items-center gap-1.5">
                            {i > 0 && <ChevronRight className="w-3 h-3 text-black/30" />}
                            <span className={i === breadcrumb.length - 1 ? 'text-black font-bold' : 'text-black/60'}>
                                {cat.name}
                            </span>
                        </span>
                    ))}
                    {selectedCalc && <span className="text-black/40 text-xs ml-2">📊 has calculator</span>}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-black/[0.03] p-1.5 rounded-2xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === tab.key
                                ? 'bg-white text-black shadow-md shadow-black/5'
                                : 'text-black/40 hover:text-black/70'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="liquid-glass rounded-2xl p-6 min-h-[400px]">
                {activeTab === 'categories' && (
                    <CategoryTree
                        onSelectCategory={handleSelectCategory}
                        selectedCategoryId={selectedCategoryId}
                    />
                )}

                {activeTab === 'calculator' && (
                    <div className="space-y-5">
                        {/* Cascading category selector */}
                        <CascadingCategorySelector
                            selectedCategoryId={selectedCategoryId}
                            onSelect={setSelectedCategoryId}
                        />

                        {!selectedCategoryId ? (
                            <div className="text-center py-12">
                                <FolderTree className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                <p className="text-black/40 text-base font-semibold">
                                    Pick a category above to build its calculator.
                                </p>
                            </div>
                        ) : selectedCalc ? (
                            <>
                                {/* Import from Sheet */}
                                <SheetImporter calculatorId={selectedCalc.id} />
                                <CalculatorBuilder calculatorId={selectedCalc.id} />
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <Calculator className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                <p className="text-black/40 text-base font-semibold mb-4">
                                    No calculator for "{selectedCategory?.name}" yet.
                                </p>
                                <button
                                    onClick={() => {
                                        if (selectedCategoryId && selectedCategory) {
                                            createCalculator(selectedCategoryId, selectedCategory.name);
                                        }
                                    }}
                                    className="btn-primary"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Calculator
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'temp-lists' && (
                    <div className="space-y-5">
                        {/* Cascading category selector */}
                        <CascadingCategorySelector
                            selectedCategoryId={selectedCategoryId}
                            onSelect={setSelectedCategoryId}
                        />

                        {!selectedCalc ? (
                            <div className="text-center py-12">
                                <ListChecks className="w-12 h-12 text-black/20 mx-auto mb-4" />
                                <p className="text-black/40 text-base font-semibold">
                                    {selectedCategoryId
                                        ? `Create a calculator for "${selectedCategory?.name}" first, then add temp items.`
                                        : 'Select a category that has a calculator.'}
                                </p>
                            </div>
                        ) : (
                            <TempListManager calculatorId={selectedCalc.id} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// CASCADING CATEGORY SELECTOR — clickable category buttons, no placeholders
// ═══════════════════════════════════════════════════════════════════════

function CascadingCategorySelector({
    selectedCategoryId,
    onSelect,
}: {
    selectedCategoryId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const { categories, getCategoryChildren, getCategoryBreadcrumb } = useAppStore();

    const breadcrumb = selectedCategoryId ? getCategoryBreadcrumb(selectedCategoryId) : [];

    const rootCategories = categories
        .filter((c) => c.parentId === null)
        .sort((a, b) => a.order - b.order);

    // Build levels: root → children of selected → children of next selected...
    const levels: { options: typeof categories; selectedId: string | null }[] = [];

    // Level 0: roots
    levels.push({
        options: rootCategories,
        selectedId: breadcrumb.length > 0 ? breadcrumb[0].id : null,
    });

    // Subsequent levels based on breadcrumb
    for (let i = 0; i < breadcrumb.length; i++) {
        const children = getCategoryChildren(breadcrumb[i].id);
        if (children.length > 0) {
            levels.push({
                options: children,
                selectedId: i + 1 < breadcrumb.length ? breadcrumb[i + 1].id : null,
            });
        }
    }

    if (rootCategories.length === 0) {
        return (
            <div className="text-center py-5 rounded-2xl bg-black/[0.02] border border-dashed border-black/10">
                <p className="text-sm text-black/40 font-semibold">No categories yet. Create them in the Categories tab first.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {levels.map((level, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                    {i > 0 && (
                        <ChevronRight className="w-4 h-4 text-black/25 shrink-0" />
                    )}
                    {level.options.map((cat) => {
                        const isSelected = cat.id === level.selectedId;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => onSelect(cat.id)}
                                className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 ${isSelected
                                    ? 'bg-black text-white shadow-lg shadow-black/15'
                                    : 'bg-black/[0.04] text-black/60 hover:text-black hover:bg-black/[0.08]'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// SHEET IMPORTER — Upload Excel or paste Google Sheet link
// ═══════════════════════════════════════════════════════════════════════

function SheetImporter({ calculatorId }: { calculatorId: string }) {
    const store = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showImport, setShowImport] = useState(false);
    const [sheetUrl, setSheetUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<{ key: string; label: string; type: RowType }[] | null>(null);

    // Parse Excel file
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown as unknown[][];

            const rows = parseSheetData(jsonData);
            setPreview(rows);
        } catch (err) {
            setError('Failed to parse file. Make sure it\'s a valid Excel/CSV file.');
        } finally {
            setLoading(false);
        }
    };

    // Parse Google Sheet URL
    const handleGoogleSheet = async () => {
        if (!sheetUrl.trim()) return;

        setLoading(true);
        setError('');

        try {
            // Convert Google Sheet URL to CSV export URL
            let csvUrl = '';
            const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (match) {
                const sheetId = match[1];
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
            } else {
                throw new Error('Invalid Google Sheet URL');
            }

            const response = await fetch(csvUrl);
            if (!response.ok) throw new Error('Could not fetch sheet. Make sure it\'s publicly shared.');

            const csvText = await response.text();
            const workbook = XLSX.read(csvText, { type: 'string' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown as unknown[][];

            const rows = parseSheetData(jsonData);
            setPreview(rows);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load Google Sheet. Make sure link is correct and sheet is publicly shared.');
        } finally {
            setLoading(false);
        }
    };

    // Parse raw sheet data into calculator rows
    const parseSheetData = (data: unknown[][]): { key: string; label: string; type: RowType }[] => {
        if (data.length < 2) return [];

        const rows: { key: string; label: string; type: RowType }[] = [];

        // Try to detect header row (first row with string values)
        const headerRow = data[0] as string[];

        for (let i = 0; i < headerRow.length; i++) {
            const header = String(headerRow[i] || '').trim();
            if (!header) continue;

            // Generate a key from the header
            const key = header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            if (!key) continue;

            // Detect type from data in subsequent rows
            let type: RowType = 'input';

            // Check values in column to guess type
            const values = data.slice(1).map((row) => row[i]).filter(Boolean);
            const allNumbers = values.every((v) => !isNaN(Number(v)));
            const uniqueValues = [...new Set(values.map(String))];

            if (uniqueValues.length <= 5 && uniqueValues.length > 1 && !allNumbers) {
                type = 'dropdown'; // Few unique text values → dropdown
            } else if (allNumbers && values.length > 0) {
                // Could be input or fixed — if all same value, it's fixed
                if (uniqueValues.length === 1) {
                    type = 'fixed';
                } else {
                    type = 'input';
                }
            }

            // Check if header suggests a total/calculated field
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('total') || lowerHeader.includes('result') || lowerHeader.includes('sum') || lowerHeader.includes('amount')) {
                type = 'calculated';
            }

            rows.push({ key, label: header, type });
        }

        return rows;
    };

    // Apply imported rows to calculator
    const applyImport = () => {
        if (!preview) return;

        for (const _row of preview) {
            store.addRow(calculatorId);
        }

        // Need to get the latest calculator state after adding rows
        setTimeout(() => {
            const calc = store.calculators.find((c) => c.id === calculatorId);
            if (!calc) return;

            // Update the last N rows with imported data
            const startIndex = calc.rows.length - preview.length;
            for (let i = 0; i < preview.length; i++) {
                const targetRow = calc.rows[startIndex + i];
                if (targetRow) {
                    store.updateRow(calculatorId, targetRow.id, {
                        key: preview[i].key,
                        label: preview[i].label,
                        type: preview[i].type,
                        formula: preview[i].type === 'calculated' ? { operands: [], operation: '+' } : undefined,
                        dropdownOptions: preview[i].type === 'dropdown' ? [] : undefined,
                        fixedValue: preview[i].type === 'fixed' ? '0' : undefined,
                    });

                    // Mark last row as total if it's calculated
                    if (i === preview.length - 1 && preview[i].type === 'calculated') {
                        store.updateRow(calculatorId, targetRow.id, { isTotal: true });
                    }
                }
            }

            setPreview(null);
            setShowImport(false);
            setSheetUrl('');
        }, 50);
    };

    if (!showImport) {
        return (
            <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 text-sm text-black/40 hover:text-black font-semibold border border-dashed border-black/15 hover:border-black/30 px-5 py-3 rounded-2xl transition-all duration-300 hover:bg-black/[0.02]"
            >
                <FileSpreadsheet className="w-4 h-4" />
                Import from Excel / Google Sheet
            </button>
        );
    }

    return (
        <div className="rounded-2xl bg-black/[0.02] border border-black/8 p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-black/40" />
                    Import from Sheet
                </h3>
                <button onClick={() => { setShowImport(false); setPreview(null); setError(''); }}
                    className="p-2 rounded-2xl text-black/30 hover:text-black hover:bg-black/5 transition-all duration-200" title="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {!preview ? (
                <div className="space-y-4">
                    {/* Upload Excel */}
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            aria-label="Upload Excel or CSV file"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-black/10 hover:border-black/25 hover:bg-black/[0.02] transition-all duration-300 group"
                        >
                            <Upload className="w-5 h-5 text-black/30 group-hover:text-black transition-colors" />
                            <span className="text-sm font-semibold text-black/40 group-hover:text-black transition-colors">
                                {loading ? 'Parsing...' : 'Upload Excel / CSV file'}
                            </span>
                        </button>
                    </div>

                    {/* OR */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-black/8"></div>
                        <span className="text-xs text-black/25 font-bold">OR</span>
                        <div className="flex-1 h-px bg-black/8"></div>
                    </div>

                    {/* Google Sheet URL */}
                    <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-black/30 shrink-0" />
                        <input
                            type="text"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            placeholder="Paste Google Sheet URL (must be publicly shared)..."
                            className="flex-1 rounded-2xl bg-white border border-black/10 px-4 py-3 text-sm text-black placeholder:text-black/30/25 outline-none focus:ring-2 focus:ring-black/10 transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleGoogleSheet()}
                        />
                        <button
                            onClick={handleGoogleSheet}
                            disabled={loading || !sheetUrl.trim()}
                            className="btn-primary !text-sm !px-5 !py-3 disabled:opacity-30"
                        >
                            {loading ? 'Loading...' : 'Fetch'}
                        </button>
                    </div>

                    <p className="text-xs text-black/30">
                        Sheet format: First row = headers (column names), remaining rows = data.
                    </p>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 font-semibold">
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                // Preview imported rows
                <div className="space-y-4">
                    <p className="text-sm text-black/50 font-semibold">
                        Preview: {preview.length} fields detected. Review types and click "Apply" to import.
                    </p>

                    <div className="space-y-1 max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-[1fr_80px_100px] gap-2 text-[10px] text-black/30 uppercase tracking-widest px-3 sticky top-0 bg-white py-2 font-bold">
                            <span>Label</span>
                            <span>Key</span>
                            <span>Type</span>
                        </div>
                        {preview.map((row, i) => (
                            <div key={i} className="grid grid-cols-[1fr_80px_100px] gap-2 items-center px-3 py-2 rounded-2xl hover:bg-black/[0.02]">
                                <span className="text-sm text-black font-semibold truncate">{row.label}</span>
                                <span className="text-xs text-black/40 font-mono truncate">{row.key}</span>
                                <select
                                    value={row.type}
                                    onChange={(e) => {
                                        const updated = [...preview];
                                        updated[i] = { ...row, type: e.target.value as RowType };
                                        setPreview(updated);
                                    }}
                                    className="rounded-xl bg-white border border-black/10 px-2 py-1 text-xs text-black outline-none font-semibold"
                                    title="Field type"
                                >
                                    <option value="input">Input</option>
                                    <option value="dropdown">Dropdown</option>
                                    <option value="fixed">Fixed</option>
                                    <option value="calculated">Calculated</option>
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/5">
                        <button
                            onClick={() => { setPreview(null); setError(''); }}
                            className="text-sm text-black/40 hover:text-black font-semibold px-4 py-2 rounded-2xl hover:bg-black/[0.04] transition-all"
                        >
                            Cancel
                        </button>
                        <button onClick={applyImport} className="btn-primary !text-sm">
                            <Check className="w-3.5 h-3.5" />
                            Apply ({preview.length} rows)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
