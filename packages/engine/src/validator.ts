/**
 * Input validator — validates user inputs against field definitions.
 * Ensures required fields are present and values are valid.
 */

import Decimal from 'decimal.js';
import type {
    FieldDefinition,
    InputValues,
    ValidationResult,
    ValidationError,
} from './types';

/**
 * Validate inputs against field definitions.
 * Returns a list of validation errors (empty if valid).
 */
export function validateInputs(
    fieldMap: Map<string, FieldDefinition>,
    inputs: InputValues,
): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [key, field] of fieldMap) {
        const value = inputs[key];

        // Skip formula, output, and fixed fields (they are computed, not user-input)
        if (field.type === 'formula' || field.type === 'output') {
            continue;
        }

        // Check required fields
        if (field.isRequired && (value === undefined || value === null || value === '')) {
            // Check if there's a default value
            if (field.defaultValue !== undefined && field.defaultValue !== '') {
                continue; // default will be used
            }
            errors.push({
                field: key,
                message: `Field "${field.label}" is required`,
            });
            continue;
        }

        // Skip validation for empty optional fields
        if (value === undefined || value === null || value === '') {
            continue;
        }

        // Type-specific validation
        switch (field.type) {
            case 'number':
                validateNumberField(key, field, value, errors);
                break;
            case 'dropdown':
                validateDropdownField(key, field, value, errors);
                break;
            case 'fixed':
                // Fixed fields don't need input validation
                break;
            case 'conditional':
                // Conditional fields are resolved during calculation
                break;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

function validateNumberField(
    key: string,
    field: FieldDefinition,
    value: string,
    errors: ValidationError[],
): void {
    try {
        const decimal = new Decimal(value);
        if (decimal.isNaN()) {
            errors.push({
                field: key,
                message: `Field "${field.label}" must be a valid number`,
            });
        }
    } catch {
        errors.push({
            field: key,
            message: `Field "${field.label}" must be a valid number`,
        });
    }
}

function validateDropdownField(
    key: string,
    field: FieldDefinition,
    value: string,
    errors: ValidationError[],
): void {
    if (!field.options) return;

    const validValues = field.options.map((o) => o.value);
    if (!validValues.includes(value)) {
        errors.push({
            field: key,
            message: `Field "${field.label}" has invalid selection: "${value}". Valid: ${validValues.join(', ')}`,
        });
    }
}
