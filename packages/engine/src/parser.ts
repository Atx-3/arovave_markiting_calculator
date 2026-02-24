/**
 * Schema parser — validates and normalizes a TemplateSchema.
 * Ensures all required fields are present and data types are correct.
 * Supports cost block flattening for multi-stage execution.
 */

import type {
    TemplateSchema,
    SectionDefinition,
    FieldDefinition,
    FormulaDefinition,
    CostBlockDefinition,
    CalculationError,
} from './types';

export interface ParseResult {
    valid: boolean;
    schema: TemplateSchema;
    errors: CalculationError[];
    fieldMap: Map<string, FieldDefinition>;
    formulaMap: Map<string, FormulaDefinition>;
    sortedFormulas: FormulaDefinition[];
    /** Active cost blocks (sorted by orderIndex), used for building blockOutputs */
    activeBlocks: CostBlockDefinition[];
}

/**
 * Parse and validate a template schema.
 * Builds lookup maps for fields and formulas.
 * Flattens cost block formulas into the main formula list.
 * Returns sorted formulas by order_index.
 */
export function parseSchema(
    schema: TemplateSchema,
    blockOverrides?: Record<string, boolean>,
): ParseResult {
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

    // Build formula map from standalone formulas
    const sortedFormulas: FormulaDefinition[] = [];
    if (schema.formulas) {
        for (const formula of schema.formulas) {
            validateFormula(formula, errors);
            formulaMap.set(formula.outputKey, formula);
            sortedFormulas.push(formula);
        }
    }

    // Flatten cost block formulas into the main formula list
    const activeBlocks: CostBlockDefinition[] = [];
    if (schema.costBlocks) {
        for (const block of schema.costBlocks) {
            validateCostBlock(block, errors);

            // Determine if block is active (runtime override takes priority)
            const isActive = blockOverrides?.[block.key] ?? block.isActive;
            if (!isActive) continue;

            activeBlocks.push(block);

            // Merge block formulas into the global formula list
            for (const formula of block.formulas) {
                validateFormula(formula, errors);
                formulaMap.set(formula.outputKey, formula);
                sortedFormulas.push(formula);
            }
        }
        // Sort active blocks by orderIndex for result mapping
        activeBlocks.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    // Sort all formulas (standalone + block) by orderIndex
    sortedFormulas.sort((a, b) => a.orderIndex - b.orderIndex);

    return {
        valid: errors.length === 0,
        schema,
        errors,
        fieldMap,
        formulaMap,
        sortedFormulas,
        activeBlocks,
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

    const validOps = ['add', 'subtract', 'multiply', 'divide', 'sum', 'conditional', 'custom'];
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

function validateCostBlock(block: CostBlockDefinition, errors: CalculationError[]): void {
    if (!block.key) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: 'Cost block missing key',
        });
    }

    if (!block.outputKey) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Cost block "${block.key}" missing outputKey`,
        });
    }

    if (block.orderIndex == null || block.orderIndex < 0) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Cost block "${block.key}" has invalid orderIndex`,
        });
    }

    if (!block.formulas || block.formulas.length === 0) {
        errors.push({
            code: 'INVALID_OPERATION',
            message: `Cost block "${block.key}" has no formulas`,
        });
    }

    // Verify the block's outputKey exists as one of its formula outputs
    if (block.formulas && block.formulas.length > 0) {
        const formulaOutputKeys = block.formulas.map((f) => f.outputKey);
        if (!formulaOutputKeys.includes(block.outputKey)) {
            errors.push({
                code: 'INVALID_OPERATION',
                message: `Cost block "${block.key}" outputKey "${block.outputKey}" does not match any of its formula outputs`,
            });
        }
    }
}
