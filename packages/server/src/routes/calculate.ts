/**
 * Calculate route — server-side pricing calculation.
 * Frontend NEVER computes prices. All price math happens here.
 */

import type { FastifyInstance } from 'fastify';
import { calculate } from '@arovave/engine';
import type { TemplateSchema, InputValues } from '@arovave/engine';
import { prisma } from '../lib/prisma.js';

export async function calculateRoutes(server: FastifyInstance) {
    server.post<{
        Body: {
            versionId: string;
            inputs: InputValues;
        };
    }>('/calculate', async (request, reply) => {
        const { versionId, inputs } = request.body;

        if (!versionId) {
            return reply.badRequest('versionId is required');
        }

        if (!inputs || typeof inputs !== 'object') {
            return reply.badRequest('inputs must be an object');
        }

        // Fetch version schema from database
        const version = await prisma.productVersion.findUnique({
            where: { id: versionId },
        });

        if (!version) {
            return reply.notFound('Version not found');
        }

        // Cast stored JSON to TemplateSchema
        const schema = version.schemaJson as unknown as TemplateSchema;

        // Ensure version metadata is set
        schema.versionId = version.id;
        schema.productId = version.productId;
        schema.versionNumber = version.versionNumber;

        // Execute deterministic calculation
        const result = calculate(schema, inputs);

        if (!result.success) {
            return reply.code(422).send({
                error: 'CALCULATION_ERROR',
                details: result.errors,
            });
        }

        return {
            data: result,
        };
    });
}
