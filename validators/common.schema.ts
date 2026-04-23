import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const sortSchema = z.enum(["popularity", "price_asc", "price_desc", "name_asc"]).default("popularity");

export const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/);

export const phoneSchema = z
  .string()
  .min(10)
  .max(20)
  .regex(/^[\d\s\+\-\(\)]+$/);

export const emailSchema = z.string().email().max(255).optional().or(z.literal(""));
