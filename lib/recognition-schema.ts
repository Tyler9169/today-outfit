import { z } from "zod";
export const recognitionSchema = z.object({
  category: z.enum(["上衣", "裤子", "鞋子", "外套"]).nullable(),
  color: z.string().trim().min(1).max(30).nullable(),
  needsConfirmation: z.boolean().default(false),
});
export type Recognition = z.infer<typeof recognitionSchema>;
