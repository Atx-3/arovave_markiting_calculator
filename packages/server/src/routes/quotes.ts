/**
 * Quote routes — immutable quote creation and retrieval.
 * Quotes store full input/output snapshots and can never be modified.
 */

import type { FastifyInstance } from 'fastify';
import { Decimal } from 'decimal.js';
import { calculate } from '@arovave/engine';
import type { TemplateSchema, InputValues } from '@arovave/engine';
import { prisma } from '../lib/prisma.js';

export async function quoteRoutes(server: FastifyInstance) {
    // Create immutable quote
    server.post<{
        Body: {
            versionId: string;
            inputs: InputValues;
            temporaryItems?: Array<{ name: string; rate: string; quantity: number }>;
        };
    }>('/', async (request, reply) => {
        const { versionId, inputs, temporaryItems } = request.body;

        if (!versionId || !inputs) {
            return reply.badRequest('versionId and inputs are required');
        }

        // Fetch version
        const version = await prisma.productVersion.findUnique({
            where: { id: versionId },
        });

        if (!version) {
            return reply.notFound('Version not found');
        }

        const schema = version.schemaJson as unknown as TemplateSchema;
        schema.versionId = version.id;
        schema.productId = version.productId;
        schema.versionNumber = version.versionNumber;

        // Recalculate to ensure consistency
        const result = calculate(schema, inputs);

        if (!result.success) {
            return reply.code(422).send({
                error: 'CALCULATION_ERROR',
                details: result.errors,
            });
        }

        // Add temporary items to total if present
        let finalTotal = new Decimal(result.total);
        if (temporaryItems && temporaryItems.length > 0) {
            for (const item of temporaryItems) {
                const itemTotal = new Decimal(item.rate).times(item.quantity);
                finalTotal = finalTotal.plus(itemTotal);
            }
        }

        // Create immutable quote
        const quote = await prisma.quote.create({
            data: {
                productVersionId: versionId,
                inputSnapshotJson: JSON.parse(JSON.stringify({
                    inputs,
                    temporaryItems: temporaryItems ?? [],
                    schemaSnapshot: schema,
                })),
                outputSnapshotJson: JSON.parse(JSON.stringify({
                    outputs: result.outputs,
                    steps: result.steps,
                    total: result.total,
                    temporaryItemsTotal: finalTotal.minus(result.total).toString(),
                })),
                inputHash: result.inputHash ?? '',
                totalAmountDecimal: finalTotal.toNumber(),
            },
        });

        return reply.code(201).send({ data: quote });
    });

    // List quotes
    server.get('/', async (_request, _reply) => {
        const quotes = await prisma.quote.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                productVersion: {
                    include: { product: true },
                },
            },
        });

        return { data: quotes };
    });

    // Get single quote
    server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const quote = await prisma.quote.findUnique({
            where: { id: request.params.id },
            include: {
                productVersion: {
                    include: { product: true },
                },
            },
        });

        if (!quote) {
            return reply.notFound('Quote not found');
        }

        return { data: quote };
    });
}
