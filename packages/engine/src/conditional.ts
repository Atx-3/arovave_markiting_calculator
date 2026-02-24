/**
 * Conditional logic evaluator.
 * Evaluates structured condition expressions using Decimal.js comparisons.
 * No eval(), no string-based evaluation.
 */

import Decimal from 'decimal.js';
import type { ConditionExpression, ConditionalBranch } from './types';

/**
 * Resolve a value reference to its Decimal value.
 * Handles field keys (looked up from context) and literal decimal strings.
 */
function resolveValue(ref: string, context: Map<string, Decimal>): Decimal | null {
    // Check if it's a direct field reference
    if (context.has(ref)) {
        return context.get(ref)!;
    }

    // Check for dotted notation (e.g., "material_type.rate")
    const dotIndex = ref.indexOf('.');
    if (dotIndex !== -1) {
        const fullKey = ref;
        if (context.has(fullKey)) {
            return context.get(fullKey)!;
        }
    }

    // Try parsing as a literal decimal
    try {
        const val = new Decimal(ref);
        if (!val.isNaN()) {
            return val;
        }
    } catch {
        // Not a valid decimal literal
    }

    return null;
}

/**
 * Evaluate a single condition expression.
 * Returns true/false based on the comparison.
 */
export function evaluateCondition(
    condition: ConditionExpression,
    context: Map<string, Decimal>,
): boolean {
    const leftVal = resolveValue(condition.left, context);
    const rightVal = resolveValue(condition.right, context);

    if (leftVal === null || rightVal === null) {
        // Cannot evaluate — treat as false
        return false;
    }

    switch (condition.operator) {
        case 'eq':
            return leftVal.eq(rightVal);
        case 'neq':
            return !leftVal.eq(rightVal);
        case 'gt':
            return leftVal.gt(rightVal);
        case 'gte':
            return leftVal.gte(rightVal);
        case 'lt':
            return leftVal.lt(rightVal);
        case 'lte':
            return leftVal.lte(rightVal);
        default:
            return false;
    }
}

/**
 * Evaluate conditional branches and return the matching branch's operands and operation.
 * Evaluates branches in order — first match wins.
 * Returns null if no branch matches.
 */
export function evaluateConditionalBranches(
    branches: ConditionalBranch[],
    context: Map<string, Decimal>,
): { operands: string[]; operation: string } | null {
    for (const branch of branches) {
        if (evaluateCondition(branch.condition, context)) {
            return {
                operands: branch.thenOperands,
                operation: branch.thenOperation,
            };
        }
    }
    return null;
}
