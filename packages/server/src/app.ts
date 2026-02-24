/**
 * Fastify server — main entry point.
 * Configures CORS, registers routes, connects to DB.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { productRoutes } from './routes/products.js';
import { calculateRoutes } from './routes/calculate.js';
import { quoteRoutes } from './routes/quotes.js';
import { prisma } from './lib/prisma.js';

const server = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
            process.env.NODE_ENV !== 'production'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
    },
});

// ─── Plugins ─────────────────────────────────────────────────────────

await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
});

await server.register(sensible);

// ─── Routes ──────────────────────────────────────────────────────────

await server.register(productRoutes, { prefix: '/api/products' });
await server.register(calculateRoutes, { prefix: '/api' });
await server.register(quoteRoutes, { prefix: '/api/quotes' });

// ─── Health Check ────────────────────────────────────────────────────

server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// ─── Shutdown ────────────────────────────────────────────────────────

const gracefulShutdown = async () => {
    server.log.info('Shutting down gracefully...');
    await prisma.$disconnect();
    await server.close();
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ─── Start ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Server running at http://${HOST}:${PORT}`);
} catch (err) {
    server.log.error(err);
    process.exit(1);
}

export default server;
