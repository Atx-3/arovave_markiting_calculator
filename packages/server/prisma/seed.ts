/**
 * Database seed script — creates one hardcoded product with a template schema
 * for testing the calculation engine (Phase 1/2 validation).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_SCHEMA = {
    productId: '', // will be set after product creation
    versionId: '', // will be set after version creation
    versionNumber: 1,
    sections: [
        {
            name: 'Dimensions',
            orderIndex: 1,
            fields: [
                {
                    key: 'width',
                    type: 'number',
                    label: 'Width (ft)',
                    isRequired: true,
                    isVisible: true,
                    defaultValue: '10',
                },
                {
                    key: 'height',
                    type: 'number',
                    label: 'Height (ft)',
                    isRequired: true,
                    isVisible: true,
                    defaultValue: '8',
                },
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
                        { label: 'Wood', value: 'wood', rate: '85.0000' },
                    ],
                },
            ],
        },
        {
            name: 'Additional Costs',
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
        {
            outputKey: 'area',
            operationType: 'multiply',
            operands: ['width', 'height'],
            orderIndex: 1,
            label: 'Area = Width × Height',
        },
        {
            outputKey: 'material_cost',
            operationType: 'multiply',
            operands: ['area', 'material_type.rate'],
            orderIndex: 2,
            label: 'Material Cost = Area × Material Rate',
        },
        {
            outputKey: 'subtotal',
            operationType: 'add',
            operands: ['material_cost', 'installation_fee'],
            orderIndex: 3,
            label: 'Subtotal = Material Cost + Installation Fee',
        },
        {
            outputKey: 'tax_amount',
            operationType: 'multiply',
            operands: ['subtotal', 'tax_rate'],
            orderIndex: 4,
            label: 'Tax = Subtotal × Tax Rate',
        },
        {
            outputKey: 'total',
            operationType: 'add',
            operands: ['subtotal', 'tax_amount'],
            orderIndex: 5,
            label: 'Total = Subtotal + Tax',
        },
    ],
    rounding: {
        mode: 'ROUND_HALF_UP',
        decimals: 2,
        intermediateDecimals: 4,
    },
};

async function main() {
    console.log('🌱 Seeding database...');

    // Clean existing data
    await prisma.quote.deleteMany();
    await prisma.formula.deleteMany();
    await prisma.fieldOption.deleteMany();
    await prisma.field.deleteMany();
    await prisma.section.deleteMany();
    await prisma.productVersion.deleteMany();
    await prisma.product.deleteMany();

    // Create product
    const product = await prisma.product.create({
        data: {
            name: 'Standard Wall Panel',
            slug: 'standard-wall-panel',
            status: 'PUBLISHED',
        },
    });

    console.log(`✅ Created product: ${product.name} (${product.id})`);

    // Update schema with product ID
    SAMPLE_SCHEMA.productId = product.id;

    // Create version
    const version = await prisma.productVersion.create({
        data: {
            productId: product.id,
            versionNumber: 1,
            schemaJson: SAMPLE_SCHEMA as object,
            isActive: true,
        },
    });

    SAMPLE_SCHEMA.versionId = version.id;

    // Update version with self-referencing schema
    await prisma.productVersion.update({
        where: { id: version.id },
        data: {
            schemaJson: SAMPLE_SCHEMA as object,
        },
    });

    // Update product with current version
    await prisma.product.update({
        where: { id: product.id },
        data: { currentVersionId: version.id },
    });

    console.log(`✅ Created version: v${version.versionNumber} (${version.id})`);

    // Create sections and fields in the relational tables too (for querying)
    for (const sectionDef of SAMPLE_SCHEMA.sections) {
        const section = await prisma.section.create({
            data: {
                versionId: version.id,
                name: sectionDef.name,
                orderIndex: sectionDef.orderIndex,
            },
        });

        for (const fieldDef of sectionDef.fields) {
            const field = await prisma.field.create({
                data: {
                    sectionId: section.id,
                    type: fieldDef.type.toUpperCase() as any,
                    key: fieldDef.key,
                    label: fieldDef.label,
                    isRequired: fieldDef.isRequired,
                    isVisible: fieldDef.isVisible,
                    defaultValue: 'defaultValue' in fieldDef ? fieldDef.defaultValue : undefined,
                },
            });

            if ('options' in fieldDef && fieldDef.options) {
                for (const opt of fieldDef.options) {
                    await prisma.fieldOption.create({
                        data: {
                            fieldId: field.id,
                            label: opt.label,
                            value: opt.value,
                            rate: opt.rate,
                        },
                    });
                }
            }
        }
    }

    // Create formula records
    for (const formulaDef of SAMPLE_SCHEMA.formulas) {
        await prisma.formula.create({
            data: {
                versionId: version.id,
                outputKey: formulaDef.outputKey,
                operationType: formulaDef.operationType,
                operandsJson: formulaDef.operands,
                orderIndex: formulaDef.orderIndex,
            },
        });
    }

    console.log('✅ Created sections, fields, options, and formulas');
    console.log('');
    console.log('📊 Sample calculation:');
    console.log('   Width: 10ft, Height: 8ft, Material: Steel (₹150/sqft)');
    console.log('   Area = 10 × 8 = 80 sqft');
    console.log('   Material Cost = 80 × 150 = ₹12,000.00');
    console.log('   Subtotal = 12,000 + 500 = ₹12,500.00');
    console.log('   Tax = 12,500 × 0.18 = ₹2,250.00');
    console.log('   Total = 12,500 + 2,250 = ₹14,750.00');
    console.log('');
    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
