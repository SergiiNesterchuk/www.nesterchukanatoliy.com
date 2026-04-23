import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Return a proxy that throws on actual DB access but allows build to pass
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === "then" || prop === "$connect" || prop === "$disconnect") {
          return undefined;
        }
        throw new Error(
          `DATABASE_URL is not set. Cannot access prisma.${String(prop)}`
        );
      },
    });
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
