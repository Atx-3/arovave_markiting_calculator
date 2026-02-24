/**
 * Cost Block Engine tests.
 * Tests multi-stage cost block execution, aggregation,
 * block activation/deactivation, and backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../src/calculator';
import { buildDependencyGraph, detectCircularReferences } from '../src/resolver';
import type { TemplateSchema, FormulaDefinition } from '../src/types';

// ─── Multi-Stage Signage Cost Schema ─────────────────────────────────

const SIGNAGE_COST_SCHEMA: TemplateSchema = {
    productId: 'signage-cost',
    versionId: 'v1',
    versionNumber: 1,
    sections: [
        {
            name: 'Inputs',
            orderIndex: 1,
            fields: [
                { key: 'ms_pipe_qty', type: 'number', label: 'MS Pipe Qty', isRequired: true, isVisible: true },
                { key: 'ms_pipe_rate', type: 'fixed', label: 'MS Pipe Rate', isRequired: false, isVisible: true, defaultValue: '85' },
                { key: 'bl_qty', type: 'number', label: 'BL Qty', isRequired: true, isVisible: true },
                { key: 'bl_rate', type: 'fixed', label: 'BL Rate', isRequired: false, isVisible: true, defaultValue: '120' },
                { key: 'recce_charge', type: 'fixed', label: 'Recce', isRequired: false, isVisible: true, defaultValue: '2500' },
                { key: 'area', type: 'number', label: 'Area', isRequired: true, isVisible: true },
                { key: 'install_rate', type: 'fixed', label: 'Install Rate', isRequired: false, isVisible: true, defaultValue: '45' },
                { key: 'transport_flat', type: 'fixed', label: 'Transport', isRequired: false, isVisible: true, defaultValue: '3500' },
                { key: 'profit_pct', type: 'fixed', label: 'Profit %', isRequired: false, isVisible: false, defaultValue: '15' },
            ],
        },
    ],
    costBlocks: [
        {
            key: 'pipe_cost_block',
            label: 'MS Pipe Cost',
            orderIndex: 1,
            blockType: 'per-piece',
            isActive: true,
            isOptional: false,
            outputKey: 'pipe_cost',
            formulas: [
                { outputKey: 'pipe_cost', operationType: 'multiply', operands: ['ms_pipe_qty', 'ms_pipe_rate'], orderIndex: 1 },
            ],
        },
        {
            key: 'bl_cost_block',
            label: 'MS BL Cost',
            orderIndex: 2,
            blockType: 'per-piece',
            isActive: true,
            isOptional: false,
            outputKey: 'bl_cost',
            formulas: [
                { outputKey: 'bl_cost', operationType: 'multiply', operands: ['bl_qty', 'bl_rate'], orderIndex: 2 },
            ],
        },
        {
            key: 'recce_block',
            label: 'Recce Cost',
            orderIndex: 3,
            blockType: 'fixed-rate',
            isActive: true,
            isOptional: true,
            outputKey: 'recce_cost',
            formulas: [
                { outputKey: 'recce_cost', operationType: 'add', operands: ['recce_charge', '0'], orderIndex: 3 },
            ],
        },
        {
            key: 'material_total_block',
            label: 'Material Total',
            orderIndex: 4,
            blockType: 'aggregation',
            isActive: true,
            isOptional: false,
            outputKey: 'material_total',
            formulas: [
                { outputKey: 'material_total', operationType: 'sum', operands: ['pipe_cost', 'bl_cost', 'recce_cost'], orderIndex: 4 },
            ],
        },
        {
            key: 'cost_per_sqft_block',
            label: 'Cost Per Sqft',
            orderIndex: 5,
            blockType: 'area-based',
            isActive: true,
            isOptional: false,
            outputKey: 'cost_per_sqft',
            formulas: [
                { outputKey: 'cost_per_sqft', operationType: 'divide', operands: ['material_total', 'area'], orderIndex: 5 },
            ],
        },
        {
            key: 'installation_block',
            label: 'Installation',
            orderIndex: 6,
            blockType: 'area-based',
            isActive: true,
            isOptional: false,
            outputKey: 'installation_total',
            formulas: [
                { outputKey: 'installation_total', operationType: 'multiply', operands: ['area', 'install_rate'], orderIndex: 6 },
            ],
        },
        {
            key: 'transport_block',
            label: 'Transport',
            orderIndex: 7,
            blockType: 'fixed-rate',
            isActive: true,
            isOptional: true,
            outputKey: 'transport_total',
            formulas: [
                { outputKey: 'transport_total', operationType: 'add', operands: ['transport_flat', '0'], orderIndex: 7 },
            ],
        },
        {
            key: 'final_block',
            label: 'Final Total',
            orderIndex: 8,
            blockType: 'aggregation',
            isActive: true,
            isOptional: false,
            outputKey: 'total',
            formulas: [
                { outputKey: 'subtotal', operationType: 'sum', operands: ['material_total', 'installation_total', 'transport_total'], orderIndex: 8 },
                { outputKey: 'profit_amount', operationType: 'multiply', operands: ['subtotal', 'profit_pct', '0.01'], orderIndex: 9 },
                { outputKey: 'total', operationType: 'add', operands: ['subtotal', 'profit_amount'], orderIndex: 10 },
            ],
        },
    ],
    formulas: [],
    rounding: { mode: 'ROUND_HALF_UP', decimals: 2, intermediateDecimals: 4 },
};

// ─── Multi-Stage Execution Tests ─────────────────────────────────────

describe('Multi-Stage Cost Block Execution', () => {
    it('should execute full 9-step signage pipeline correctly', () => {
        const result = calculate(SIGNAGE_COST_SCHEMA, {
            ms_pipe_qty: '20',
            bl_qty: '15',
            area: '100',
        });

        expect(result.success).toBe(true);

        // Block 1: pipe_cost = 20 × 85 = 1700
        expect(result.outputs.pipe_cost).toBe('1700');

        // Block 2: bl_cost = 15 × 120 = 1800
        expect(result.outputs.bl_cost).toBe('1800');

        // Block 3: recce_cost = 2500 + 0 = 2500
        expect(result.outputs.recce_cost).toBe('2500');

        // Block 4: material_total = sum(1700, 1800, 2500) = 6000
        expect(result.outputs.material_total).toBe('6000');

        // Block 5: cost_per_sqft = 6000 / 100 = 60
        expect(result.outputs.cost_per_sqft).toBe('60');

        // Block 6: installation_total = 100 × 45 = 4500
        expect(result.outputs.installation_total).toBe('4500');

        // Block 7: transport_total = 3500 + 0 = 3500
        expect(result.outputs.transport_total).toBe('3500');

        // Block 8: subtotal = sum(6000, 4500, 3500) = 14000
        expect(result.outputs.subtotal).toBe('14000');

        // profit_amount = 14000 × 15 × 0.01 = 2100
        expect(result.outputs.profit_amount).toBe('2100');

        // total = 14000 + 2100 = 16100
        expect(result.total).toBe('16100');
    });

    it('should record audit trail for every step', () => {
        const result = calculate(SIGNAGE_COST_SCHEMA, {
            ms_pipe_qty: '20',
            bl_qty: '15',
            area: '100',
        });

        expect(result.steps.length).toBe(10); // 10 formulas across 8 blocks
        expect(result.steps[0].outputKey).toBe('pipe_cost');
        expect(result.steps[9].outputKey).toBe('total');
    });
});

// ─── Block Output Breakdown Tests ────────────────────────────────────

describe('Block Output Breakdown', () => {
    it('should return blockOutputs for each active block', () => {
        const result = calculate(SIGNAGE_COST_SCHEMA, {
            ms_pipe_qty: '20',
            bl_qty: '15',
            area: '100',
        });

        expect(result.blockOutputs).toBeDefined();
        expect(result.blockOutputs!.length).toBe(8);

        // Check first block
        const pipeBlock = result.blockOutputs!.find((b) => b.blockKey === 'pipe_cost_block');
        expect(pipeBlock).toBeDefined();
        expect(pipeBlock!.label).toBe('MS Pipe Cost');
        expect(pipeBlock!.blockType).toBe('per-piece');
        expect(pipeBlock!.value).toBe('1700');
        expect(pipeBlock!.isActive).toBe(true);

        // Check aggregation block
        const materialBlock = result.blockOutputs!.find((b) => b.blockKey === 'material_total_block');
        expect(materialBlock).toBeDefined();
        expect(materialBlock!.value).toBe('6000');
        expect(materialBlock!.blockType).toBe('aggregation');

        // Check final block
        const finalBlock = result.blockOutputs!.find((b) => b.blockKey === 'final_block');
        expect(finalBlock).toBeDefined();
        expect(finalBlock!.value).toBe('16100');
    });
});

// ─── Block Deactivation Tests ────────────────────────────────────────

describe('Block Deactivation via Runtime Overrides', () => {
    it('should skip deactivated optional blocks', () => {
        // Deactivate recce and transport blocks
        const result = calculate(SIGNAGE_COST_SCHEMA, {
            ms_pipe_qty: '20',
            bl_qty: '15',
            area: '100',
        }, {
            recce_block: false,
            transport_block: false,
        });

        // recce_cost and transport_total should NOT be in outputs
        expect(result.outputs.recce_cost).toBeUndefined();
        expect(result.outputs.transport_total).toBeUndefined();
    });

    it('should exclude deactivated blocks from blockOutputs', () => {
        const result = calculate(SIGNAGE_COST_SCHEMA, {
            ms_pipe_qty: '20',
            bl_qty: '15',
            area: '100',
        }, {
            transport_block: false,
        });

        expect(result.blockOutputs).toBeDefined();
        const transportBlock = result.blockOutputs!.find((b) => b.blockKey === 'transport_block');
        expect(transportBlock).toBeUndefined();
    });
});

// ─── Sum Operation Tests ─────────────────────────────────────────────

describe('Sum Aggregation Operation', () => {
    it('should sum two operands', () => {
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
                { outputKey: 'total', operationType: 'sum', operands: ['a', 'b'], orderIndex: 1 },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { a: '100', b: '200' });
        expect(result.success).toBe(true);
        expect(result.total).toBe('300');
    });

    it('should sum five operands', () => {
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
                        { key: 'c', type: 'number', label: 'C', isRequired: true, isVisible: true },
                        { key: 'd', type: 'number', label: 'D', isRequired: true, isVisible: true },
                        { key: 'e', type: 'number', label: 'E', isRequired: true, isVisible: true },
                    ],
                },
            ],
            formulas: [
                { outputKey: 'total', operationType: 'sum', operands: ['a', 'b', 'c', 'd', 'e'], orderIndex: 1 },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { a: '10', b: '20', c: '30', d: '40', e: '50' });
        expect(result.success).toBe(true);
        expect(result.total).toBe('150');
    });
});

// ─── Backward Compatibility Tests ────────────────────────────────────

describe('Backward Compatibility', () => {
    it('should work with standalone formulas only (no costBlocks)', () => {
        const schema: TemplateSchema = {
            productId: 'old-style',
            versionId: 'v1',
            versionNumber: 1,
            sections: [
                {
                    name: 'Dimensions',
                    orderIndex: 1,
                    fields: [
                        { key: 'width', type: 'number', label: 'Width', isRequired: true, isVisible: true },
                        { key: 'height', type: 'number', label: 'Height', isRequired: true, isVisible: true },
                        { key: 'rate', type: 'fixed', label: 'Rate', isRequired: false, isVisible: true, defaultValue: '100' },
                    ],
                },
            ],
            formulas: [
                { outputKey: 'area', operationType: 'multiply', operands: ['width', 'height'], orderIndex: 1 },
                { outputKey: 'total', operationType: 'multiply', operands: ['area', 'rate'], orderIndex: 2 },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { width: '10', height: '8' });
        expect(result.success).toBe(true);
        expect(result.outputs.area).toBe('80');
        expect(result.total).toBe('8000');
        expect(result.blockOutputs).toBeUndefined(); // No blocks = no blockOutputs
    });

    it('should handle mixed formulas + costBlocks', () => {
        const schema: TemplateSchema = {
            productId: 'mixed',
            versionId: 'v1',
            versionNumber: 1,
            sections: [
                {
                    name: 'Test',
                    orderIndex: 1,
                    fields: [
                        { key: 'qty', type: 'number', label: 'Qty', isRequired: true, isVisible: true },
                        { key: 'rate', type: 'fixed', label: 'Rate', isRequired: false, isVisible: true, defaultValue: '50' },
                        { key: 'tax_rate', type: 'fixed', label: 'Tax', isRequired: false, isVisible: false, defaultValue: '0.18' },
                    ],
                },
            ],
            // Standalone formula for base_cost
            formulas: [
                { outputKey: 'base_cost', operationType: 'multiply', operands: ['qty', 'rate'], orderIndex: 1 },
            ],
            // Cost block that references the standalone formula output
            costBlocks: [
                {
                    key: 'tax_block',
                    label: 'Tax',
                    orderIndex: 2,
                    blockType: 'aggregation',
                    isActive: true,
                    isOptional: false,
                    outputKey: 'total',
                    formulas: [
                        { outputKey: 'tax_amount', operationType: 'multiply', operands: ['base_cost', 'tax_rate'], orderIndex: 2 },
                        { outputKey: 'total', operationType: 'add', operands: ['base_cost', 'tax_amount'], orderIndex: 3 },
                    ],
                },
            ],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { qty: '10' });
        expect(result.success).toBe(true);
        // base_cost = 10 × 50 = 500
        expect(result.outputs.base_cost).toBe('500');
        // tax_amount = 500 × 0.18 = 90
        expect(result.outputs.tax_amount).toBe('90');
        // total = 500 + 90 = 590
        expect(result.total).toBe('590');
        // Block output should exist
        expect(result.blockOutputs).toBeDefined();
        expect(result.blockOutputs!.length).toBe(1);
        expect(result.blockOutputs![0].blockKey).toBe('tax_block');
    });
});

// ─── Circular Reference Across Blocks ────────────────────────────────

describe('Circular Reference Detection Across Blocks', () => {
    it('should detect circular reference between cost blocks', () => {
        const schema: TemplateSchema = {
            productId: 'circular-test',
            versionId: 'v1',
            versionNumber: 1,
            sections: [
                {
                    name: 'Test',
                    orderIndex: 1,
                    fields: [
                        { key: 'input', type: 'number', label: 'Input', isRequired: true, isVisible: true },
                    ],
                },
            ],
            costBlocks: [
                {
                    key: 'block_a',
                    label: 'Block A',
                    orderIndex: 1,
                    blockType: 'per-piece',
                    isActive: true,
                    isOptional: false,
                    outputKey: 'a_output',
                    formulas: [
                        { outputKey: 'a_output', operationType: 'add', operands: ['b_output', '1'], orderIndex: 1 },
                    ],
                },
                {
                    key: 'block_b',
                    label: 'Block B',
                    orderIndex: 2,
                    blockType: 'per-piece',
                    isActive: true,
                    isOptional: false,
                    outputKey: 'b_output',
                    formulas: [
                        { outputKey: 'b_output', operationType: 'add', operands: ['a_output', '1'], orderIndex: 2 },
                    ],
                },
            ],
            formulas: [],
            rounding: { mode: 'ROUND_HALF_UP', decimals: 2 },
        };

        const result = calculate(schema, { input: '10' });
        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.code === 'CIRCULAR_REFERENCE')).toBe(true);
    });
});

// ─── Determinism Test for Cost Blocks ────────────────────────────────

describe('Cost Block Determinism', () => {
    it('same inputs + same schema = identical output (100 iterations)', () => {
        const inputs = { ms_pipe_qty: '20', bl_qty: '15', area: '100' };
        const firstResult = calculate(SIGNAGE_COST_SCHEMA, inputs);

        for (let i = 0; i < 100; i++) {
            const result = calculate(SIGNAGE_COST_SCHEMA, inputs);
            expect(result.total).toBe(firstResult.total);
            expect(result.outputs).toEqual(firstResult.outputs);
            expect(result.blockOutputs).toEqual(firstResult.blockOutputs);
        }
    });
});
