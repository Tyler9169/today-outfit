import { z } from "zod";
export const fits=["修身","合身","宽松"] as const;
export const patterns=["纯色","条纹","格纹","印花","其他"] as const;
export const styles=["简约","休闲","通勤","商务","运动","街头","浪漫","复古"] as const;
export const featureShape={
  fit:z.enum(fits).optional(), pattern:z.enum(patterns).optional(), style:z.enum(styles).optional(),
  neckline:z.string().max(60).optional(), sleeve:z.string().max(60).optional(), length:z.string().max(60).optional(),
};
export const photoFeaturesSchema=z.object(featureShape);
export const labelSchema=z.object({labelText:z.string().max(2000),composition:z.string().max(300).nullable(),needsConfirmation:z.boolean().default(true)});
export type PhotoFeatures=z.infer<typeof photoFeaturesSchema>;
