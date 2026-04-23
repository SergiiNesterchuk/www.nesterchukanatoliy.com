import { z } from "zod";
import { paginationSchema, sortSchema } from "./common.schema";

export const productQuerySchema = paginationSchema.extend({
  sort: sortSchema,
  category: z.string().optional(),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;
