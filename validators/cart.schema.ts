import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const cartValidateSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
});

export type CartValidateInput = z.infer<typeof cartValidateSchema>;
