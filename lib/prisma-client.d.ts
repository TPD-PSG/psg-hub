import type { PrismaClient, Prisma } from "@prisma/client";
export function createPrismaClient(options?: Omit<Prisma.PrismaClientOptions, "adapter">): PrismaClient;
export function databaseUrl(): string;
