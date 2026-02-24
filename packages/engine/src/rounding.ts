/**
 * Rounding engine — applies financial rounding using Decimal.js.
 * Centralizes all rounding logic to a single configurable point.
 */

import Decimal from 'decimal.js';
import type { RoundingConfig, RoundingMode } from './types';

/**
 * Map our rounding mode to Decimal.js rounding constants.
 */
function getDecimalRounding(mode: RoundingMode): Decimal.Rounding {
    switch (mode) {
        case 'ROUND_UP':
            return Decimal.ROUND_UP;
        case 'ROUND_DOWN':
            return Decimal.ROUND_DOWN;
        case 'ROUND_CEIL':
            return Decimal.ROUND_CEIL;
        case 'ROUND_FLOOR':
            return Decimal.ROUND_FLOOR;
        case 'ROUND_HALF_UP':
            return Decimal.ROUND_HALF_UP;
        case 'ROUND_HALF_DOWN':
            return Decimal.ROUND_HALF_DOWN;
        case 'ROUND_HALF_EVEN':
            return Decimal.ROUND_HALF_EVEN;
        default:
            return Decimal.ROUND_HALF_UP;
    }
}

/**
 * Apply final rounding to a Decimal value.
 */
export function applyRounding(value: Decimal, config: RoundingConfig): Decimal {
    return value.toDecimalPlaces(config.decimals, getDecimalRounding(config.mode));
}

/**
 * Apply intermediate rounding (higher precision, used during computation steps).
 */
export function applyIntermediateRounding(value: Decimal, config: RoundingConfig): Decimal {
    const intermediateDecimals = config.intermediateDecimals ?? config.decimals + 2;
    return value.toDecimalPlaces(intermediateDecimals, getDecimalRounding(config.mode));
}

/**
 * Configure Decimal.js global settings for financial safety.
 * Call this once at engine initialization.
 */
export function configureDecimal(): void {
    Decimal.set({
        precision: 28,          // High precision for financial math
        rounding: Decimal.ROUND_HALF_UP,
        toExpPos: 28,           // Avoid scientific notation
        toExpNeg: -28,
    });
}
