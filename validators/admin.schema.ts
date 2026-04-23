import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9._-]+$/, "Slug: тільки a-z, 0-9, крапка, дефіс"),
  sku: z.string().min(1, "SKU обов'язковий").max(50),
  shortDescription: z.string().max(1000).optional().default(""),
  description: z.string().max(50000).optional().default(""),
  price: z.coerce.number().int().min(1, "Ціна має бути > 0"),
  compareAtPrice: z.coerce.number().int().min(0).optional().nullable(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "preorder"]).default("in_stock"),
  quantity: z.coerce.number().int().min(0).optional().nullable(),
  categoryId: z.string().min(1, "Оберіть категорію"),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  metaTitle: z.string().max(200).optional().default(""),
  metaDesc: z.string().max(500).optional().default(""),
});

export const productUpdateSchema = productCreateSchema.partial();

export const categorySchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9._-]+$/, "Slug: тільки a-z, 0-9, крапка, дефіс"),
  description: z.string().max(2000).optional().default(""),
  imageUrl: z.string().max(500).optional().default(""),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  metaTitle: z.string().max(200).optional().default(""),
  metaDesc: z.string().max(500).optional().default(""),
});

export const pageSchema = z.object({
  title: z.string().min(1, "Заголовок обов'язковий").max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9._-]+$/, "Slug: тільки a-z, 0-9, крапка, дефіс"),
  content: z.string().min(1, "Контент обов'язковий").max(100000),
  isActive: z.coerce.boolean().default(true),
  showInNav: z.coerce.boolean().default(true),
  displayOnHome: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  metaTitle: z.string().max(200).optional().default(""),
  metaDesc: z.string().max(500).optional().default(""),
});

export const settingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(5000),
});

export const redirectSchema = z.object({
  fromPath: z.string().min(1, "Шлях обов'язковий").max(500).startsWith("/", "Має починатися з /"),
  toPath: z.string().min(1, "Ціль обов'язкова").max(500),
  statusCode: z.coerce.number().int().refine((v) => v === 301 || v === 302, "Тільки 301 або 302").default(301),
  isActive: z.coerce.boolean().default(true),
});

export const bannerSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional().default(""),
  imageUrl: z.string().min(1, "Зображення обов'язкове").max(500),
  mobileImageUrl: z.string().max(500).optional().default(""),
  linkUrl: z.string().max(500).optional().default(""),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type PageInput = z.infer<typeof pageSchema>;
export type SettingInput = z.infer<typeof settingSchema>;
export type RedirectInput = z.infer<typeof redirectSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
