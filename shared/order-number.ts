import { prisma } from "./db";

/**
 * Generate next sequential public order number.
 * Uses OrderCounter table with atomic increment to prevent duplicates.
 * Format: K-5001, K-5002, K-5003, ...
 */
export async function generatePublicOrderNumber(): Promise<string> {
  // Atomic increment using upsert + increment
  const counter = await prisma.orderCounter.upsert({
    where: { id: "singleton" },
    update: { value: { increment: 1 } },
    create: { id: "singleton", value: 5001 },
  });

  return `K-${counter.value}`;
}
