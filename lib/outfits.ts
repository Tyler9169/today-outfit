import type { Category, Clothing } from "./wardrobe";
export type Outfit = Partial<Record<Category, string>>;
export type OutfitState = { selected: Outfit; locked: Outfit };
export const slots: Category[] = ["上衣", "裤子", "鞋子", "外套"];
export const emptyOutfit = (): OutfitState => ({ selected: {}, locked: {} });
export function cleanOutfit(state: OutfitState, items: Clothing[]): OutfitState {
  const clean = (outfit: Outfit) => Object.fromEntries(Object.entries(outfit).filter(([cat, id]) => items.some(i => i.id === id && i.category === cat))) as Outfit;
  return { selected: clean(state.selected), locked: clean(state.locked) };
}
function neutral(color: string) { return /^(黑|白|米白|灰|深灰|浅灰|米|米黄|藏蓝|深蓝)(色)?$/.test(color.trim()); }
function score(item: Clothing, selected: Clothing[]) { return (neutral(item.color) ? 2 : 0) + selected.filter(i => i.color.trim() === item.color.trim()).length * 3; }
export function chooseOutfit(items: Clothing[], state: OutfitState, only?: Category): { state: OutfitState; message: string } {
  const current = cleanOutfit(state, items);
  if (only && current.locked[only]) return { state: current, message: "请先取消该单品的固定。" };
  const selected = { ...current.selected, ...current.locked };
  const active = only ? [only] : slots.filter(cat => cat !== "外套" || selected[cat]);
  let changed = false;
  for (const category of active) {
    if (current.locked[category]) continue;
    const options = items.filter(i => i.category === category && i.id !== selected[category]);
    if (!options.length) continue;
    const peers = items.filter(i => Object.values(selected).includes(i.id));
    const ranked = options.map(item => ({ item, rank: score(item, peers), tie: Math.random() })).sort((a,b) => b.rank-a.rank || a.tie-b.tie);
    selected[category] = ranked[0].item.id; changed = true;
  }
  const missing = slots.slice(0,3).filter(cat => !selected[cat]);
  return { state: { ...current, selected }, message: missing.length ? `还缺少${missing.join("、")}，添加后可组成完整搭配。` : changed ? "已更新搭配，固定单品保持不变。" : "没有其他可替换的单品。" };
}
export function outfitReason(items: Clothing[]) {
  if (!items.length) return "先添加衣服，再生成一套搭配。";
  const colors = items.map(i => i.color);
  return `本套包含${items.map(i => `${i.color}${i.category}`).join("、")}。` + (colors.some((c,i) => colors.indexOf(c) !== i) ? "有相同录入颜色的单品呼应。" : items.some(i => neutral(i.color)) ? "优先选用了中性色单品。" : "按已有类别补齐搭配，请根据实际效果调整。");
}
