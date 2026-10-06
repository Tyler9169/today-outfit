import type { Category, Clothing } from "./wardrobe";
import { type AppState, type Scene, scenes } from "./app-state";
export type Conditions = { scenes: Scene[]; temperature: number; rain: boolean; location: "室内" | "室外" | "都有" };
export function parseScenes(text: string): Scene[] {
  const found: Scene[] = [];
  const words: Record<Scene, RegExp> = { 日常: /日常|买菜|逛街|散步|休闲/, 通勤: /上班|工作|办公室|通勤|开会/, 约会: /约会|恋人|对象|情侣/, 聚会: /聚会|聚餐|朋友|吃饭|晚宴|派对/, 运动: /运动|跑步|健身|打球|锻炼/ };
  for (const scene of scenes) if (words[scene].test(text)) found.push(scene);
  return found;
}
function neutral(color: string) { return /^(黑|白|灰|米白|米|深蓝|藏蓝|浅灰|深灰)(色)?$/.test(color.trim()); }
export function recommend(items: Clothing[], state: AppState, conditions: Conditions, only?: Category) {
  const available = items.filter(i => !i.dirty);
  const selected = { ...state.selected };
  const locked = { ...state.locked };
  for (const cat of Object.keys(selected)) if (!available.some(i => i.id === selected[cat] && i.category === cat)) { delete selected[cat]; delete locked[cat]; }
  if (only && locked[only]) return { selected, locked, reason: "请先解锁该位置。", complete: false };
  const missing = (["上衣","裤子","鞋子"] as Category[]).filter(cat => !available.some(i => i.category === cat));
  if (missing.length) return { selected, locked, reason: `缺少可穿的${missing.join("、")}；请添加单品或取消待洗标记。`, complete: false };
  const recent = new Set(state.history.slice(-3).flatMap(h => h.ids));
  const slotList: Category[] = only ? [only] : ["上衣","裤子","鞋子", ...(conditions.temperature < 18 || locked["外套"] ? ["外套" as Category] : [])];
  if (!only && conditions.temperature >= 18 && !locked["外套"]) delete selected["外套"];
  let changed = false;
  for (const cat of slotList) {
    if (locked[cat] && available.some(i => i.id === locked[cat])) { selected[cat] = locked[cat]; continue; }
    const candidates = available.filter(i => i.category === cat);
    const alternatives = candidates.filter(i => i.id !== selected[cat]);
    const pool = alternatives.length ? alternatives : candidates;
    const score = (i: Clothing) => {
      const a = i.attributes;
      let result = neutral(i.color) ? 2 : 0;
      if (recent.has(i.id)) result -= 4;
      if (a?.confirmed) {
        result += conditions.scenes.filter(s => a.scenes?.includes(s)).length * 6;
        if (a.minTemp !== undefined && a.maxTemp !== undefined) result += conditions.temperature >= a.minTemp && conditions.temperature <= a.maxTemp ? 8 : -12;
        if (conditions.rain && conditions.location !== "室内") result += a.rainSuitable === true ? 4 : a.rainSuitable === false ? -5 : 0;
        result += (a.comfort ?? 3) - 3;
      }
      if (available.some(peer => Object.values(selected).includes(peer.id) && peer.id !== i.id && peer.color === i.color)) result += 2;
      return result;
    };
    pool.sort((a,b) => score(b)-score(a) || a.id.localeCompare(b.id));
    if (pool[0]) { changed ||= selected[cat] !== pool[0].id; selected[cat] = pool[0].id; }
  }
  const chosen = available.filter(i => Object.values(selected).includes(i.id));
  const warnings: string[] = [];
  if (conditions.scenes.length > 1) warnings.push(`兼顾${conditions.scenes.join("与")}，场景评分综合取舍`);
  if (chosen.some(i => !i.attributes?.confirmed)) warnings.push("部分属性待确认，不能保证温度与场景适合");
  if (chosen.some(i => i.attributes?.confirmed && ((i.attributes.minTemp !== undefined && conditions.temperature < i.attributes.minTemp) || (i.attributes.maxTemp !== undefined && conditions.temperature > i.attributes.maxTemp)))) warnings.push("有单品超出你确认的温度范围，请调整或增加衣物");
  if (conditions.temperature < 18 && !selected["外套"]) warnings.push("气温偏低且没有可用外套，请自行评估保暖");
  if (conditions.rain && conditions.location !== "室内") warnings.push(chosen.some(i => i.attributes?.confirmed && i.attributes.rainSuitable) ? "优先考虑了你标记的雨天适用单品" : "雨天适用信息不足，请自行确认防雨");
  return { selected, locked, complete: true, reason: `${changed ? "" : "没有其他可替换单品。"}${conditions.temperature}℃ · ${conditions.location} · ${conditions.scenes.join("、")}。选用${chosen.map(i => `${i.color}${i.category}`).join("、")}。${warnings.join("；")}。优先考虑已确认属性，并降低最近穿过单品的优先级。` };
}
export function candidatesFor(items: Clothing[], state: AppState) {
  return scenes.flatMap(scene => { const r = recommend(items, { ...state, selected: {}, locked: {} }, { scenes: [scene], temperature: 22, rain: false, location: "室内" }); return r.complete ? [{ scene, ids: Object.values(r.selected), reason: r.reason }] : []; });
}
