/**
 * Core engine unit tests.
 * Tests the deterministic calculation engine in isolation.
 * No database, no API — pure function testing.
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../src/calculator';
import { buildDependencyGraph, detectCircularReferences } from '../src/resolver';
import { parseSchema } from '../src/parser';
import type { TemplateSchema, FormulaDefinition } from '../src/types';

// ─── Test Schema ─────────────────────────────────────────────────────

const WALL_PANEL_SCHEMA: TemplateSchema = {
    productId: 'test-product-1',
    versionId: 'test-version-1',
    versionNumber: 1,
    sections: [
        {
            name: 'Dimensions',
            orderIndex: 1,
            fields: [
                { key: 'width', type: 'number', label: 'Width', isRequired: true, isVisible: true },
                { key: 'height', type: 'number', label: 'Height', isRequired: true, isVisible: true },
            ],
        },
        {
            name: 'Material',
            orderIndex: 2,
            fields: [
                {
                    key: 'material_type',
                    type: 'dropdown',
                    label: 'Material',
                    isRequired: true,
                    isVisible: true,
                    options: [
                        { label: 'Steel', value: 'steel', rate: '150.0000' },
                        { label: 'Aluminum', value: 'aluminum', rate: '220.0000' },
                    ],
                },
            ],
        },
        {
            name: 'Costs',
            orderIndex: 3,
            fields: [
                {
                    key: 'installation_fee',
                    type: 'fixed',
                    label: 'Installation Fee',
                    isRequired: false,
                    isVisible: true,
                    defaultValue: '500.0000',
                },
                {
                    key: 'tax_rate',
                    type: 'fixed',
                    label: 'Tax Rate',
                    isRequired: false,
                    isVisible: false,
                    defaultValue: '0.18',
                },
            ],
        },
    ],
    formulas: [
        { outputKey: 'area', operationType: 'multiply', operands: ['width', 'height'], orderIndex: 1 },
        {
            outputKey: 'material_cost',
            operationType: 'multiply',
            operands: ['area', 'material_type.rate'],
            orderIndex: 2,
        },
        {
            outputKey: 'subtotal',
            operationType: 'add',
            operands: ['material_cost', 'installation_fee'],
            orderIndex: 3,
        },
        {
            outputKey: 'tax_amount',
            operationType: 'multiply',
            operands: ['subtotal', 'tax_rate'],
            orderIndex: 4,
        },
        { outputKey: 'total', operationType: 'add', operands: ['subtotal', 'tax_amount'], orderIndex: 5 },
    ],
    rounding: { mode: 'ROUND_HALF_UP', decimals: 2, intermediateDecimals: 4 },
};

// ─── Basic Calculation Tests ─────────────────────────────────────────

describe('Calculation Engine', () => {
    it('should calculate wall panel with steel correctly', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10',
            height: '8',
            material_type: 'steel',
        });

        expect(result.success).toBe(true);
        expect(result.outputs.area).toBe('80');
        expect(result.outputs.material_cost).toBe('12000');
        expect(result.outputs.subtotal).toBe('12500');
        expect(result.outputs.tax_amount).toBe('2250');
        expect(result.total).toBe('14750');
    });

    it('should calculate wall panel with aluminum correctly', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10',
            height: '8',
            material_type: 'aluminum',
        });

        expect(result.success).toBe(true);
        expect(result.outputs.area).toBe('80');
        expect(result.outputs.material_cost).toBe('17600');
        expect(result.outputs.subtotal).toBe('18100');
        expect(result.outputs.tax_amount).toBe('3258');
        expect(result.total).toBe('21358');
    });

    it('should handle decimal dimensions', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10.5',
            height: '8.3',
            material_type: 'steel',
        });

        expect(result.success).toBe(true);
        // area = 10.5 * 8.3 = 87.15
        expect(result.outputs.area).toBe('87.15');
        // material_cost = 87.15 * 150 = 13072.50
        expect(result.outputs.material_cost).toBe('13072.5');
    });
});

// ─── Determinism Tests ───────────────────────────────────────────────

describe('Determinism Guarantee', () => {
    it('same input + same schema = identical output (1000 iterations)', () => {
        const inputs = { width: '12.7', height: '9.3', material_type: 'steel' };
        const firstResult = calculate(WALL_PANEL_SCHEMA, inputs);

        for (let i = 0; i < 1000; i++) {
            const result = calculate(WALL_PANEL_SCHEMA, inputs);
            expect(result.total).toBe(firstResult.total);
            expect(result.inputHash).toBe(firstResult.inputHash);
            expect(result.outputs).toEqual(firstResult.outputs);
        }
    });

    it('should produce consistent input hash', () => {
        const inputs = { width: '10', height: '8', material_type: 'steel' };
        const r1 = calculate(WALL_PANEL_SCHEMA, inputs);
        const r2 = calculate(WALL_PANEL_SCHEMA, inputs);

        expect(r1.inputHash).toBe(r2.inputHash);
        expect(r1.inputHash).toBeTruthy();
    });
});

// ─── Audit Trail Tests ───────────────────────────────────────────────

describe('Audit Trail', () => {
    it('should record all computation steps', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10',
            height: '8',
            material_type: 'steel',
        });

        expect(result.steps.length).toBe(5);
        expect(result.steps[0].outputKey).toBe('area');
        expect(result.steps[1].outputKey).toBe('material_cost');
        expect(result.steps[4].outputKey).toBe('total');
    });

    it('should include operand details in each step', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10',
            height: '8',
            material_type: 'steel',
        });

        const areaStep = result.steps[0];
        expect(areaStep.operands).toHaveLength(2);
        expect(areaStep.operands[0].key).toBe('width');
        expect(areaStep.operands[0].value).toBe('10');
        expect(areaStep.operands[1].key).toBe('height');
        expect(areaStep.operands[1].value).toBe('8');
    });
});

// ─── Error Handling Tests ────────────────────────────────────────────

describe('Error Handling', () => {
    it('should detect missing required inputs', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10',
            // height missing
            material_type: 'steel',
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].code).toBe('MISSING_REQUIRED_INPUT');
    });

    it('should detect division by zero', () => {
        const divSchema: TemplateSchema = {
            productId: 'test',
            versionId: 'test',
            versionNumber: 1,
            sections: [
                {
                    name: 'Test',
                    orderIndex: 1,
                    fields: [
                        { key: 'a', type: 'number', label: 'A', isRequired: true, isVisible: true },
                        { key: 'b', type: 'number', label: 'B', isRequired: true, isVisible: true },
                    ],
                },
            ],
            formulas: [
                { outputKey: 'result', operationType: 'divide', operands: ['a', 'b'], orderIndex: 1 },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(divSchema, { a: '100', b: '0' });

        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.code === 'DIVISION_BY_ZERO')).toBe(true);
    });

    it('should detect invalid dropdown selection', () => {
        const result = calculate(WALL_PANEL_SCHEMA, {
            width: '10',
            height: '8',
            material_type: 'titanium', // not a valid option
        });

        expect(result.success).toBe(false);
    });
});

// ─── Circular Reference Detection ────────────────────────────────────

describe('Circular Reference Detection', () => {
    it('should detect simple circular reference (A→B→A)', () => {
        const formulas: FormulaDefinition[] = [
            { outputKey: 'a', operationType: 'add', operands: ['b', '1'], orderIndex: 1 },
            { outputKey: 'b', operationType: 'add', operands: ['a', '1'], orderIndex: 2 },
        ];

        const graph = buildDependencyGraph(formulas);
        const errors = detectCircularReferences(graph);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].code).toBe('CIRCULAR_REFERENCE');
    });

    it('should detect transitive circular reference (A→B→C→A)', () => {
        const formulas: FormulaDefinition[] = [
            { outputKey: 'a', operationType: 'add', operands: ['c', '1'], orderIndex: 1 },
            { outputKey: 'b', operationType: 'add', operands: ['a', '1'], orderIndex: 2 },
            { outputKey: 'c', operationType: 'add', operands: ['b', '1'], orderIndex: 3 },
        ];

        const graph = buildDependencyGraph(formulas);
        const errors = detectCircularReferences(graph);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].code).toBe('CIRCULAR_REFERENCE');
    });

    it('should NOT flag valid dependency chain', () => {
        const formulas: FormulaDefinition[] = [
            { outputKey: 'area', operationType: 'multiply', operands: ['width', 'height'], orderIndex: 1 },
            { outputKey: 'cost', operationType: 'multiply', operands: ['area', '100'], orderIndex: 2 },
            { outputKey: 'total', operationType: 'add', operands: ['cost', '500'], orderIndex: 3 },
        ];

        const graph = buildDependencyGraph(formulas);
        const errors = detectCircularReferences(graph);

        expect(errors.length).toBe(0);
    });
});

// ─── Schema Parsing Tests ────────────────────────────────────────────

describe('Schema Parsing', () => {
    it('should parse valid schema without errors', () => {
        const result = parseSchema(WALL_PANEL_SCHEMA);

        expect(result.valid).toBe(true);
        expect(result.fieldMap.size).toBe(5);
        expect(result.formulaMap.size).toBe(5);
        expect(result.sortedFormulas.length).toBe(5);
    });

    it('should detect duplicate field keys', () => {
        const dupSchema: TemplateSchema = {
            ...WALL_PANEL_SCHEMA,
            sections: [
                {
                    name: 'A',
                    orderIndex: 1,
                    fields: [
                        { key: 'width', type: 'number', label: 'W1', isRequired: true, isVisible: true },
                    ],
                },
                {
                    name: 'B',
                    orderIndex: 2,
                    fields: [
                        { key: 'width', type: 'number', label: 'W2', isRequired: true, isVisible: true },
                    ],
                },
            ],
        };

        const result = parseSchema(dupSchema);
        expect(result.errors.some((e) => e.message.includes('Duplicate field key'))).toBe(true);
    });

    it('should sort formulas by order_index', () => {
        const result = parseSchema(WALL_PANEL_SCHEMA);
        for (let i = 1; i < result.sortedFormulas.length; i++) {
            expect(result.sortedFormulas[i].orderIndex).toBeGreaterThanOrEqual(
                result.sortedFormulas[i - 1].orderIndex,
            );
        }
    });
});

// ─── Rounding Tests ─────────────────────────────────────────────────

describe('Rounding Stability', () => {
    it('should handle known rounding edge case (0.1 + 0.2)', () => {
        const schema: TemplateSchema = {
            productId: 'test',
            versionId: 'test',
            versionNumber: 1,
            sections: [
                {
                    name: 'Test',
                    orderIndex: 1,
                    fields: [
                        { key: 'a', type: 'number', label: 'A', isRequired: true, isVisible: true },
                        { key: 'b', type: 'number', label: 'B', isRequired: true, isVisible: true },
                    ],
                },
            ],
            formulas: [
                { outputKey: 'total', operationType: 'add', operands: ['a', 'b'], orderIndex: 1 },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { a: '0.1', b: '0.2' });
        expect(result.success).toBe(true);
        expect(result.total).toBe('0.3'); // NOT 0.30000000000000004
    });

    it('should apply ROUND_HALF_UP correctly', () => {
        const schema: TemplateSchema = {
            productId: 'test',
            versionId: 'test',
            versionNumber: 1,
            sections: [
                {
                    name: 'Test',
                    orderIndex: 1,
                    fields: [
                        { key: 'a', type: 'number', label: 'A', isRequired: true, isVisible: true },
                        { key: 'b', type: 'number', label: 'B', isRequired: true, isVisible: true },
                    ],
                },
            ],
            formulas: [
                { outputKey: 'total', operationType: 'divide', operands: ['a', 'b'], orderIndex: 1 },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { a: '10', b: '3' });
        expect(result.success).toBe(true);
        expect(result.total).toBe('3.33'); // 10/3 = 3.333... → 3.33
    });
});
