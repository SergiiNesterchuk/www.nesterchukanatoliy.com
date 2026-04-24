import { z } from "zod";
import { phoneSchema } from "./common.schema";

export const checkoutSchema = z.object({
  customerName: z.string().min(2, "Вкажіть ім'я").max(100),
  customerPhone: phoneSchema,
  customerEmail: z.string().email("Невірний email").max(255).optional().or(z.literal("")),
  deliveryMethod: z.enum(["nova_poshta_branch", "nova_poshta_courier"]),
  deliveryCity: z.string().min(1, "Вкажіть місто").max(200),
  deliveryAddress: z.string().max(500).optional(),
  deliveryBranchRef: z.string().max(200).optional(),
  deliveryBranchName: z.string().max(500).optional(),
  comment: z.string().max(1000).optional(),
  paymentMethod: z.enum(["card_online"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1, "Кошик порожній"),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  idempotencyKey: z.string().min(1).max(100),
  agreedToTerms: z.boolean().optional().default(true),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
