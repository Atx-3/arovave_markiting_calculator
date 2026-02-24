import { useState } from 'react';
import { Code, Play, CheckCircle, XCircle } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import { calculate } from '@arovave/engine';
import type { CalculationResult } from '@arovave/engine';

export function SchemaPreview() {
    const { schema } = useTemplateStore();
    const [showJson, setShowJson] = useState(false);
    const [testMode, setTestMode] = useState(false);
    const [testInputs, setTestInputs] = useState<Record<string, string>>({});
    const [testResult, setTestResult] = useState<CalculationResult | null>(null);

    // Gather all user-input fields (number + dropdown)
    const inputFields = schema.sections.flatMap((s) =>
        s.fields.filter((f) => f.key && (f.type === 'number' || f.type === 'dropdown'))
    );

    const handleTest = () => {
        try {
            const result = calculate(schema, testInputs);
            setTestResult(result);
        } catch (err: any) {
            setTestResult({
                success: false,
                outputs: {},
                total: '0',
                steps: [],
                errors: [{ code: 'INVALID_OPERATION', message: err.message || 'Engine error' }],
            });
        }
    };

    const schemaValid =
        schema.sections.length > 0 &&
        schema.sections.some((s) => s.fields.some((f) => f.key)) &&
        schema.formulas.length > 0 &&
        schema.formulas.some((f) => f.outputKey && f.operands.length > 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-black">Preview & Test</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setShowJson(!showJson);
                            setTestMode(false);
                        }}
                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition-colors ${showJson
                                ? 'border-black/15 text-black/50 bg-black/[0.04]'
                                : 'border-surface-border text-black hover:text-black'
                            }`}
                    >
                        <Code className="w-3.5 h-3.5" />
                        Schema JSON
                    </button>
                    <button
                        onClick={() => {
                            setTestMode(!testMode);
                            setShowJson(false);
                            setTestResult(null);
                        }}
                        disabled={!schemaValid}
                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${testMode
                                ? 'border-black/15 text-black bg-accent-emerald/10'
                                : 'border-surface-border text-black hover:text-black'
                            }`}
                    >
                        <Play className="w-3.5 h-3.5" />
                        Test Calculation
                    </button>
                </div>
            </div>

            {/* Schema JSON view */}
            {showJson && (
                <div className="glass rounded-2xl p-4 overflow-auto max-h-96">
                    <pre className="text-sm font-mono text-black whitespace-pre-wrap">
                        {JSON.stringify(schema, null, 2)}
                    </pre>
                </div>
            )}

            {/* Test calculation panel */}
            {testMode && (
                <div className="glass rounded-2xl p-4 space-y-4">
                    <h3 className="text-base font-semibold text-black">Test Inputs</h3>

                    {inputFields.length === 0 && (
                        <p className="text-sm text-black">
                            No input fields found. Add number or dropdown fields first.
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        {inputFields.map((field) => (
                            <div key={field.key} className="space-y-1">
                                <label className="text-sm text-black">{field.label || field.key}</label>
                                {field.type === 'dropdown' ? (
                                    <select
                                        value={testInputs[field.key] || ''}
                                        onChange={(e) =>
                                            setTestInputs((prev) => ({ ...prev, [field.key]: e.target.value }))
                                        }
                                        className="w-full rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-black/10"
                                    >
                                        <option value="">Select...</option>
                                        {field.options?.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label} (₹{opt.rate})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={testInputs[field.key] || ''}
                                        onChange={(e) =>
                                            setTestInputs((prev) => ({ ...prev, [field.key]: e.target.value }))
                                        }
                                        placeholder={field.defaultValue || '0'}
                                        className="w-full rounded-md bg-white border border-black/10 px-2 py-1.5 text-sm text-black font-mono placeholder:text-black/30 outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleTest}
                        className="btn-primary text-sm !px-4 !py-2"
                    >
                        <Play className="w-3.5 h-3.5" />
                        Run Calculation
                    </button>

                    {/* Results */}
                    {testResult && (
                        <div
                            className={`rounded-xl p-4 space-y-3 ${testResult.success
                                    ? 'bg-accent-emerald/10 border border-black/10'
                                    : 'bg-red-50 border border-red-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {testResult.success ? (
                                    <CheckCircle className="w-4 h-4 text-black" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span
                                    className={`text-base font-semibold ${testResult.success ? 'text-black' : 'text-red-500'
                                        }`}
                                >
                                    {testResult.success ? 'Calculation Successful' : 'Calculation Failed'}
                                </span>
                            </div>

                            {testResult.success && (
                                <>
                                    {/* Computed values */}
                                    <div className="space-y-1">
                                        {Object.entries(testResult.outputs).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-sm">
                                                <span className="text-black font-mono">{key}</span>
                                                <span className="text-black font-mono font-semibold">₹{value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total */}
                                    <div className="flex justify-between items-center border-t border-surface-border pt-2">
                                        <span className="text-base font-semibold text-black">Total</span>
                                        <span className="text-lg font-bold text-black font-mono">
                                            ₹{testResult.total}
                                        </span>
                                    </div>

                                    {/* Audit trail */}
                                    {testResult.steps.length > 0 && (
                                        <details className="mt-2">
                                            <summary className="text-sm text-black cursor-pointer hover:text-black">
                                                Audit Trail ({testResult.steps.length} steps)
                                            </summary>
                                            <div className="mt-2 space-y-1">
                                                {testResult.steps.map((step, i) => (
                                                    <div key={i} className="text-[11px] text-black font-mono">
                                                        {step.outputKey} = {step.operands.map((o) => `${o.key}(${o.value})`).join(` ${OPERATIONS_MAP[step.operationType] || '?'} `)} = {step.result}
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </>
                            )}

                            {/* Errors */}
                            {testResult.errors.length > 0 && (
                                <div className="space-y-1">
                                    {testResult.errors.map((err, i) => (
                                        <div key={i} className="text-sm text-red-300">
                                            <strong>{err.code}:</strong> {err.message}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Schema summary (always visible) */}
            {!showJson && !testMode && (
                <div className="glass rounded-2xl p-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-black">{schema.sections.length}</div>
                            <div className="text-sm text-black">Sections</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-black">
                                {schema.sections.reduce((sum, s) => sum + s.fields.length, 0)}
                            </div>
                            <div className="text-sm text-black">Fields</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-black">{schema.formulas.length}</div>
                            <div className="text-sm text-black">Formulas</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-black">
                                {schemaValid ? '✓' : '—'}
                            </div>
                            <div className="text-sm text-black">Valid</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const OPERATIONS_MAP: Record<string, string> = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
};
