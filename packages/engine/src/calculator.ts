/**
 * Main calculator — orchestrates the entire calculation pipeline.
 * This is the single entry point for all pricing calculations.
 *
 * Pipeline:
 *   1. Parse schema → validate structure → flatten cost blocks
 *   2. Validate inputs → check required fields, types
 *   3. Build dependency graph → detect circular references
 *   4. Initialize context → resolve inputs + defaults
 *   5. Execute formulas in order → produce outputs
 *   6. Apply final rounding → produce total
 *   7. Build block-level output breakdown
 *   8. Return deterministic result with audit trail
 *
 * Guarantees:
 *   - Same input + same schema = identical output (deterministic)
 *   - All math via Decimal.js (no native floats)
 *   - No eval(), no string-based formula execution
 *   - Full audit trail of every computation step
 */

import Decimal from 'decimal.js';
import type {
    TemplateSchema,
    InputValues,
    CalculationResult,
    CalculationError,
    BlockOutput,
} from './types';
import { parseSchema } from './parser';
import { validateInputs } from './validator';
import {
    buildDependencyGraph,
    detectCircularReferences,
    getExecutionOrder,
} from './resolver';
import { initializeContext, executeFormula } from './executor';
import { applyRounding, configureDecimal } from './rounding';

// Initialize Decimal.js once
configureDecimal();

/**
 * Simple FNV-1a hash for determinism verification.
 * Works in both Node.js and browser environments.
 * Not for security — just for same-input detection.
 */
function fnv1aHash(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function computeInputHash(versionId: string, inputs: InputValues): string {
    const sortedKeys = Object.keys(inputs).sort();
    const canonical = sortedKeys.map((k) => `${k}=${inputs[k]}`).join('&');
    const payload = `${versionId}:${canonical}`;
    return fnv1aHash(payload);
}

/**
 * Main calculation function.
 *
 * @param schema - The product template schema (from published version)
 * @param inputs - User-provided input values (field key → value string)
 * @param blockOverrides - Optional runtime overrides for block activation (block key → boolean)
 * @returns Deterministic calculation result with audit trail
 */
export function calculate(
    schema: TemplateSchema,
    inputs: InputValues,
    blockOverrides?: Record<string, boolean>,
): CalculationResult {
    const allErrors: CalculationError[] = [];

    // ─── Step 1: Parse schema + flatten cost blocks ──────────────────
    const parsed = parseSchema(schema, blockOverrides);
    if (!parsed.valid) {
        return {
            success: false,
            outputs: {},
            total: '0',
            steps: [],
            errors: parsed.errors,
        };
    }

    // ─── Step 2: Validate inputs ─────────────────────────────────────
    const validation = validateInputs(parsed.fieldMap, inputs);
    if (!validation.valid) {
        return {
            success: false,
            outputs: {},
            total: '0',
            steps: [],
            errors: validation.errors.map((e) => ({
                code: 'MISSING_REQUIRED_INPUT' as const,
                message: e.message,
                field: e.field,
            })),
        };
    }

    // ─── Step 3: Build dependency graph & check for cycles ───────────
    const graph = buildDependencyGraph(parsed.sortedFormulas);
    const circularErrors = detectCircularReferences(graph);
    if (circularErrors.length > 0) {
        return {
            success: false,
            outputs: {},
            total: '0',
            steps: [],
            errors: circularErrors,
        };
    }

    // ─── Step 4: Determine execution order ───────────────────────────
    const executionOrder = getExecutionOrder(parsed.sortedFormulas, graph);
    if (!executionOrder) {
        return {
            success: false,
            outputs: {},
            total: '0',
            steps: [],
            errors: [
                {
                    code: 'CIRCULAR_REFERENCE',
                    message: 'Could not determine execution order due to circular references',
                },
            ],
        };
    }

    // ─── Step 5: Initialize context & execute formulas ───────────────
    const context = initializeContext(parsed.fieldMap, inputs, schema.rounding);

    for (const outputKey of executionOrder) {
        const formula = parsed.formulaMap.get(outputKey);
        if (!formula) continue;
        executeFormula(formula, context);
    }

    // Check for execution errors
    if (context.errors.length > 0) {
        allErrors.push(...context.errors);
    }

    // ─── Step 6: Build output map with final rounding ────────────────
    const outputs: Record<string, string> = {};
    for (const formula of parsed.sortedFormulas) {
        const value = context.values.get(formula.outputKey);
        if (value !== undefined) {
            outputs[formula.outputKey] = applyRounding(value, schema.rounding).toString();
        }
    }

    // ─── Step 7: Determine total ─────────────────────────────────────
    // The last formula's output is considered the total
    // unless there's an explicit "total" key
    let total = new Decimal(0);
    if (context.values.has('total')) {
        total = context.values.get('total')!;
    } else if (parsed.sortedFormulas.length > 0) {
        const lastFormula = parsed.sortedFormulas[parsed.sortedFormulas.length - 1];
        const lastValue = context.values.get(lastFormula.outputKey);
        if (lastValue) {
            total = lastValue;
        }
    }

    const finalTotal = applyRounding(total, schema.rounding).toString();

    // ─── Step 8: Build block-level output breakdown ──────────────────
    const blockOutputs: BlockOutput[] = [];
    if (parsed.activeBlocks.length > 0) {
        for (const block of parsed.activeBlocks) {
            const value = context.values.get(block.outputKey);
            blockOutputs.push({
                blockKey: block.key,
                label: block.label,
                blockType: block.blockType,
                outputKey: block.outputKey,
                value: value ? applyRounding(value, schema.rounding).toString() : '0',
                isActive: true,
            });
        }
    }

    // ─── Step 9: Compute input hash ──────────────────────────────────
    const inputHash = computeInputHash(schema.versionId, inputs);

    return {
        success: allErrors.length === 0,
        outputs,
        total: finalTotal,
        steps: context.steps,
        errors: allErrors,
        inputHash,
        blockOutputs: blockOutputs.length > 0 ? blockOutputs : undefined,
    };
}

