/**
 * Schema parser — validates and normalizes a TemplateSchema.
 * Ensures all required fields are present and data types are correct.
 */

import type {
    TemplateSchema,
    SectionDefinition,
    FieldDefinition,
    FormulaDefinition,
    CalculationError,
} from './types';

export interface ParseResult {
    valid: boolean;
    schema: TemplateSchema;
    errors: CalculationError[];
    fieldMap: Map<string, FieldDefinition>;
    formulaMap: Map<string, FormulaDefinition>;
    sortedFormulas: FormulaDefinition[];
}

/**
 * Parse and validate a template schema.
 * Builds lookup maps for fields and formulas.
 * Returns sorted formulas by order_index.
 */
export function parseSchema(schema: TemplateSchema): ParseResult {
    const errors: CalculationError[] = [];
    const fieldMap = new Map<string, FieldDefinition>();
    const formulaMap = new Map<string, FormulaDefinition>();

    // Validate rounding config
    if (!schema.rounding) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: 'Missing rounding configuration',
        });
    }

    // Build field map from all sections
    if (schema.sections) {
        for (const section of schema.sections) {
            validateSection(section, fieldMap, errors);
        }
    }

    // Build formula map and sort by order_index
    const sortedFormulas: FormulaDefinition[] = [];
    if (schema.formulas) {
        for (const formula of schema.formulas) {
            validateFormula(formula, errors);
            formulaMap.set(formula.outputKey, formula);
            sortedFormulas.push(formula);
        }
        sortedFormulas.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    return {
        valid: errors.length === 0,
        schema,
        errors,
        fieldMap,
        formulaMap,
        sortedFormulas,
    };
}

function validateSection(
    section: SectionDefinition,
    fieldMap: Map<string, FieldDefinition>,
    errors: CalculationError[],
): void {
    if (!section.name) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: 'Section missing name',
        });
    }

    if (section.fields) {
        for (const field of section.fields) {
            if (!field.key) {
                errors.push({
                    code: 'INVALID_OPERATION',
                    message: `Field in section "${section.name}" missing key`,
                });
                continue;
            }

            if (fieldMap.has(field.key)) {
                errors.push({
                    code: 'INVALID_OPERATION',
                    message: `Duplicate field key: "${field.key}"`,
                    field: field.key,
                });
            }

            // Attach section name for context
            field.sectionName = section.name;
            fieldMap.set(field.key, field);

            // Validate dropdown fields have options
            if (field.type === 'dropdown' && (!field.options || field.options.length === 0)) {
                errors.push({
                    code: 'INVALID_OPERATION',
                    message: `Dropdown field "${field.key}" has no options`,
                    field: field.key,
                });
            }
        }
    }
}

function validateFormula(formula: FormulaDefinition, errors: CalculationError[]): void {
    if (!formula.outputKey) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: 'Formula missing output_key',
        });
    }

    if (!formula.operationType) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Formula "${formula.outputKey}" missing operation_type`,
            formula: formula.outputKey,
        });
    }

    const validOps = ['add', 'subtract', 'multiply', 'divide', 'conditional', 'custom'];
    if (!validOps.includes(formula.operationType)) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Formula "${formula.outputKey}" has invalid operation: "${formula.operationType}"`,
            formula: formula.outputKey,
        });
    }

    if (
        formula.operationType !== 'conditional' &&
        (!formula.operands || formula.operands.length === 0)
    ) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Formula "${formula.outputKey}" has no operands`,
            formula: formula.outputKey,
        });
    }

    if (formula.orderIndex == null || formula.orderIndex < 0) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Formula "${formula.outputKey}" has invalid order_index`,
            formula: formula.outputKey,
        });
    }
}
