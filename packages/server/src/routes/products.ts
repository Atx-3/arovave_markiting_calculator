/**
 * Product routes — CRUD operations for products and versions.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function productRoutes(server: FastifyInstance) {
    // List all products
    server.get('/', async (_request, _reply) => {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                versions: {
                    where: { isActive: true },
                    take: 1,
                },
            },
        });
        return { data: products };
    });

    // Get product by ID with active version
    server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const product = await prisma.product.findUnique({
            where: { id: request.params.id },
            include: {
                versions: {
                    orderBy: { versionNumber: 'desc' },
                },
            },
        });

        if (!product) {
            return reply.notFound('Product not found');
        }

        return { data: product };
    });

    // Create product
    server.post<{ Body: { name: string; slug: string } }>('/', async (request, reply) => {
        const { name, slug } = request.body;

        const existing = await prisma.product.findUnique({ where: { slug } });
        if (existing) {
            return reply.conflict('Product with this slug already exists');
        }

        const product = await prisma.product.create({
            data: { name, slug },
        });

        return reply.code(201).send({ data: product });
    });

    // Get product versions
    server.get<{ Params: { id: string } }>('/:id/versions', async (request, _reply) => {
        const versions = await prisma.productVersion.findMany({
            where: { productId: request.params.id },
            orderBy: { versionNumber: 'desc' },
        });

        return { data: versions };
    });

    // Create new version (draft)
    server.post<{ Params: { id: string }; Body: { schemaJson: unknown } }>(
        '/:id/versions',
        async (request, reply) => {
            const { id } = request.params;
            const { schemaJson } = request.body;

            // Get next version number
            const latestVersion = await prisma.productVersion.findFirst({
                where: { productId: id },
                orderBy: { versionNumber: 'desc' },
            });

            const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

            const version = await prisma.productVersion.create({
                data: {
                    productId: id,
                    versionNumber: nextVersion,
                    schemaJson: schemaJson as object,
                    isActive: false,
                },
            });

            return reply.code(201).send({ data: version });
        },
    );

    // Get version schema
    server.get<{ Params: { versionId: string } }>(
        '/versions/:versionId/schema',
        async (request, reply) => {
            const version = await prisma.productVersion.findUnique({
                where: { id: request.params.versionId },
            });

            if (!version) {
                return reply.notFound('Version not found');
            }

            return { data: version.schemaJson };
        },
    );

    // Publish version (makes it active, deactivates others)
    server.put<{ Params: { versionId: string } }>(
        '/versions/:versionId/publish',
        async (request, reply) => {
            const version = await prisma.productVersion.findUnique({
                where: { id: request.params.versionId },
            });

            if (!version) {
                return reply.notFound('Version not found');
            }

            // Deactivate all other versions for this product
            await prisma.productVersion.updateMany({
                where: { productId: version.productId },
                data: { isActive: false },
            });

            // Activate this version
            const updated = await prisma.productVersion.update({
                where: { id: version.id },
                data: { isActive: true },
            });

            // Update product status and current version
            await prisma.product.update({
                where: { id: version.productId },
                data: {
                    status: 'PUBLISHED',
                    currentVersionId: version.id,
                },
            });

            return { data: updated };
        },
    );
}
