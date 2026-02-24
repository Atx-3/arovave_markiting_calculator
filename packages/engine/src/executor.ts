/**
 * Formula graph executor — the heart of the calculation engine.
 * Executes formulas in dependency order using Decimal.js arithmetic.
 * No eval(). No native float math. All operations are structured.
 */

import Decimal from 'decimal.js';
import type {
    FormulaDefinition,
    FieldDefinition,
    RoundingConfig,
    CalculationStep,
    CalculationError,
    InputValues,
    OperationType,
} from './types';
import { evaluateConditionalBranches } from './conditional';
import { applyIntermediateRounding } from './rounding';

/**
 * Execution context holds all resolved values during a calculation run.
 */
export interface ExecutionContext {
    /** All resolved values (inputs + computed) */
    values: Map<string, Decimal>;
    /** Audit trail of each executed formula step */
    steps: CalculationStep[];
    /** Errors encountered during execution */
    errors: CalculationError[];
    /** Rounding configuration */
    rounding: RoundingConfig;
}

/**
 * Initialize execution context with user inputs and fixed field values.
 */
export function initializeContext(
    fieldMap: Map<string, FieldDefinition>,
    inputs: InputValues,
    rounding: RoundingConfig,
): ExecutionContext {
    const values = new Map<string, Decimal>();

    for (const [key, field] of fieldMap) {
        const inputValue = inputs[key];

        switch (field.type) {
            case 'number': {
                const raw = inputValue ?? field.defaultValue ?? '0';
                try {
                    values.set(key, new Decimal(raw));
                } catch {
                    values.set(key, new Decimal(0));
                }
                break;
            }

            case 'dropdown': {
                // Store selected value and its rate
                const selectedValue = inputValue ?? field.defaultValue ?? '';
                if (field.options && selectedValue) {
                    const option = field.options.find((o) => o.value === selectedValue);
                    if (option) {
                        // Store rate as "key.rate"
                        values.set(`${key}.rate`, new Decimal(option.rate));
                        // Store value as numeric if possible, else 0
                        try {
                            values.set(key, new Decimal(option.rate));
                        } catch {
                            values.set(key, new Decimal(0));
                        }
                    }
                }
                break;
            }

            case 'fixed': {
                const fixedVal = field.defaultValue ?? '0';
                try {
                    values.set(key, new Decimal(fixedVal));
                } catch {
                    values.set(key, new Decimal(0));
                }
                break;
            }

            // formula, conditional, output types are computed — skip initialization
            default:
                break;
        }
    }

    return {
        values,
        steps: [],
        errors: [],
        rounding,
    };
}

/**
 * Resolve an operand reference to its Decimal value.
 * Supports:
 *   - Field keys (looked up from context)
 *   - Dotted notation ("material_type.rate")
 *   - Decimal literals ("0.18", "100")
 */
function resolveOperand(operand: string, context: ExecutionContext): Decimal | null {
    // Direct value lookup
    if (context.values.has(operand)) {
        return context.values.get(operand)!;
    }

    // Try as literal decimal
    try {
        const val = new Decimal(operand);
        if (!val.isNaN()) {
            return val;
        }
    } catch {
        // Not a valid decimal
    }

    return null;
}

/**
 * Execute a single arithmetic operation on resolved operands.
 */
function executeOperation(
    operationType: OperationType,
    resolvedOperands: Decimal[],
    formula: FormulaDefinition,
    context: ExecutionContext,
): Decimal | null {
    if (resolvedOperands.length === 0) {
        context.errors.push({
            code: 'INVALID_OPERAND',
            message: `Formula "${formula.outputKey}": no valid operands to operate on`,
            formula: formula.outputKey,
        });
        return null;
    }

    let result = resolvedOperands[0];

    for (let i = 1; i < resolvedOperands.length; i++) {
        switch (operationType) {
            case 'add':
                result = result.plus(resolvedOperands[i]);
                break;

            case 'subtract':
                result = result.minus(resolvedOperands[i]);
                break;

            case 'multiply':
                result = result.times(resolvedOperands[i]);
                break;

            case 'divide':
                if (resolvedOperands[i].isZero()) {
                    context.errors.push({
                        code: 'DIVISION_BY_ZERO',
                        message: `Formula "${formula.outputKey}": division by zero at operand index ${i}`,
                        formula: formula.outputKey,
                    });
                    return null;
                }
                result = result.dividedBy(resolvedOperands[i]);
                break;

            case 'sum':
                // Sum is N-ary addition — accumulate all operands
                result = result.plus(resolvedOperands[i]);
                break;

            default:
                context.errors.push({
                    code: 'INVALID_OPERATION',
                    message: `Formula "${formula.outputKey}": unsupported operation "${operationType}"`,
                    formula: formula.outputKey,
                });
                return null;
        }
    }

    return result;
}

/**
 * Execute a single formula within the context.
 */
export function executeFormula(
    formula: FormulaDefinition,
    context: ExecutionContext,
): void {
    let operands = formula.operands;
    let operationType = formula.operationType;

    // Handle conditional formulas
    if (formula.operationType === 'conditional' && formula.conditionalBranches) {
        const matchedBranch = evaluateConditionalBranches(
            formula.conditionalBranches,
            context.values,
        );

        if (matchedBranch) {
            operands = matchedBranch.operands;
            operationType = matchedBranch.operation as OperationType;
        } else {
            // No branch matched — result is 0
            context.values.set(formula.outputKey, new Decimal(0));
            context.steps.push({
                orderIndex: formula.orderIndex,
                outputKey: formula.outputKey,
                operationType: 'conditional',
                operands: [],
                result: '0',
                label: formula.label ?? `${formula.outputKey} (no condition matched)`,
            });
            return;
        }
    }

    // Resolve all operands
    const resolvedOperands: Decimal[] = [];
    const operandDetails: Array<{ key: string; value: string }> = [];

    for (const operand of operands) {
        const resolved = resolveOperand(operand, context);
        if (resolved === null) {
            context.errors.push({
                code: 'UNKNOWN_FIELD_REF',
                message: `Formula "${formula.outputKey}": could not resolve operand "${operand}"`,
                formula: formula.outputKey,
                field: operand,
            });
            return;
        }
        resolvedOperands.push(resolved);
        operandDetails.push({ key: operand, value: resolved.toString() });
    }

    // Execute the operation
    const result = executeOperation(operationType, resolvedOperands, formula, context);

    if (result === null) {
        return; // Error already recorded
    }

    // Apply intermediate rounding
    const rounded = applyIntermediateRounding(result, context.rounding);

    // Store the result
    context.values.set(formula.outputKey, rounded);

    // Record the step for audit trail
    context.steps.push({
        orderIndex: formula.orderIndex,
        outputKey: formula.outputKey,
        operationType,
        operands: operandDetails,
        result: rounded.toString(),
        label: formula.label,
    });
}
