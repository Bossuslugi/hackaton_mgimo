import { PrismaClient } from '@prisma/client';

/** Единственный экземпляр PrismaClient (переживает hot reload в dev). */
const g = globalThis as typeof globalThis & { __orbitaPrisma?: PrismaClient };

export const prisma = g.__orbitaPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') g.__orbitaPrisma = prisma;
