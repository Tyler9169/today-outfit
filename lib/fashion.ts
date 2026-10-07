import { z } from "zod";
import { fits, styles } from "./clothing-features";
import type { Clothing } from "./wardrobe";
export const ageGroups = ["不填写", "18–24", "25–34", "35–49", "50–64", "65岁及以上"] as const;
export const profileSchema = z.object({
  age: z.enum(ageGroups).default("不填写"),
  style: z.union([z.literal("不限"),z.enum(styles)]).default("不限"),
  fit: z.union([z.literal("不限"),z.enum(fits)]).default("不限"),
  priority: z.enum(["均衡", "行走舒适", "通勤整洁"]).default("均衡"),
  inspiration: z.enum(["日常基础", "柔和通勤", "比例对比"]).default("日常基础"),
});
export type StyleProfile = z.infer<typeof profileSchema>;
export const trendSource = { checkedAt:"2026-10-07", title:"Vogue · 2026 秋冬趋势（9月28日）", url:"https://www.vogue.com/article/fall-winter-2026-fashion-trends" };
export const ageNotes: Record<StyleProfile["age"],string> = {
  "不填写":"不用填写年龄也能获得完整推荐。风格和活动需求比年龄更直接。",
  "18–24":"日常与初入职场可共用基础单品；想表达个性时，可以选择比例对比或喜欢的图案。",
  "25–34":"日常与通勤切换时，可以保留一件喜欢的单品，再按当天着装要求调整外层和鞋子。",
  "35–49":"需要兼顾工作与日常时，可以先固定常穿的版型，再尝试配色或叠穿变化。",
  "50–64":"可以从自己喜欢的经典单品出发，加入一处新配色或比例变化；无需为了年龄放弃偏爱的风格。",
  "65岁及以上":"外出走动多时，可选择行走舒适优先，并亲自确认鞋底、活动余量与穿脱方便程度。",
};
// Editorial inspiration, not demographic rules or a trained model. Age never scores garments.
export function fashionScore(item: Clothing, peers: Clothing[], profile: StyleProfile): number {
  const a=item.attributes; let score=0;
  if(a?.confirmed && profile.priority==="行走舒适") score += ((a.comfort??3)-3)*2;
  if(!a?.featuresConfirmed) return score;
  if(profile.style!=="不限" && a.style===profile.style) score+=5;
  if(profile.fit!=="不限" && a.fit===profile.fit) score+=2;
  if(profile.priority==="通勤整洁" && ["通勤","商务","简约"].includes(a.style??"")) score+=2;
  if(profile.inspiration==="柔和通勤" && ["合身","宽松"].includes(a.fit??"") && ["通勤","简约"].includes(a.style??"")) score+=2;
  if(profile.inspiration==="比例对比" && ["上衣","裤子"].includes(item.category)) {
    const opposite=peers.find(p=>p.category===(item.category==="上衣"?"裤子":"上衣"));
    if(opposite?.attributes?.featuresConfirmed && a.fit && opposite.attributes.fit &&
      (a.fit==="宽松") !== (opposite.attributes.fit==="宽松")) score+=2;
  }
  if(profile.style === "简约" && a.pattern === "纯色" && peers.some(p=>p.attributes?.featuresConfirmed && p.attributes.pattern && p.attributes.pattern!=="纯色")) score+=2;
  return score;
}
export function fashionAdvice(chosen: Clothing[], profile: StyleProfile): string[] {
  const result:string[]=[];
  if(profile.style!=="不限") result.push(`偏好${profile.style}风格：${chosen.some(i=>i.attributes?.featuresConfirmed&&i.attributes.style===profile.style)?"已优先考虑匹配单品":"没有已确认的匹配单品，本次使用现有衣橱"}`);
  if(profile.fit!=="不限") result.push(`版型偏好为${profile.fit}，版型标签不能证明穿在你身上的合身程度`);
  if(profile.priority==="行走舒适") result.push("优先考虑你确认的舒适度；鞋底防滑与实际脚感仍需试穿确认");
  if(profile.priority==="通勤整洁") result.push("优先考虑已确认的通勤、商务与简约风格；请另行核对工作场合着装要求");
  if(profile.inspiration==="柔和通勤") result.push("柔和通勤灵感：用合身或宽松的简约、通勤单品组合，温差大时考虑可脱卸外层");
  if(profile.inspiration==="比例对比") result.push("比例对比灵感：尝试宽松与较贴合的上下装搭配；这是可选审美，不是身材矫正要求");
  const materials=chosen.filter(i=>i.attributes?.materialConfirmed&&i.attributes.material?.trim()).map(i=>`${i.category}：${i.attributes!.material}`);
  if(materials.length) result.push(`已核对材质（${materials.join("；")}）；成分本身不能确定保暖、透气或防雨性能`);
  if(profile.age!=="不填写") result.push(`年龄段参考（${profile.age}）：${ageNotes[profile.age]}`);
  return result;
}
