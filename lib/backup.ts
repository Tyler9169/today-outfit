import { z } from "zod";
import { categories, type Clothing } from "./wardrobe";
import { freshState, stateSchema, type AppState } from "./app-state";
export const attributesSchema = z.object({ confirmed: z.boolean(), fit: z.string().max(100).optional(), style: z.string().max(100).optional(), thickness: z.string().max(100).optional(), warmth: z.string().max(100).optional(), minTemp: z.number().min(-50).max(60).optional(), maxTemp: z.number().min(-50).max(60).optional(), comfort: z.number().min(1).max(5).optional(), rainSuitable: z.boolean().optional(), scenes: z.array(z.string().max(30)).max(10).optional() }).refine(a => a.minTemp === undefined || a.maxTemp === undefined || a.minTemp <= a.maxTemp, "最低温度不能高于最高温度");
const record = z.object({ id: z.string().min(1).max(200), category: z.enum(categories), color: z.string().trim().min(1).max(30), createdAt: z.number().finite().nonnegative(), photo: z.string().startsWith("data:image/"), dirty: z.boolean().optional(), attributes: attributesSchema.optional() });
const schema = z.object({ format: z.literal("my-wardrobe"), version: z.union([z.literal(1), z.literal(2)]), items: z.array(record).max(5000), state: stateSchema.optional() });
export async function exportBackup(items: Clothing[], state?: AppState) {
  const records = [];
  for (const item of items) records.push({ ...item, photo: await new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(item.photo); }) });
  return JSON.stringify({ format: "my-wardrobe", version: 2, items: records, state: state ?? freshState() });
}
export async function parseBackupBundle(text: string): Promise<{ items: Clothing[]; state: AppState }> {
  const backup = schema.parse(JSON.parse(text));
  const items: Clothing[] = [], ids = new Set<string>();
  for (const item of backup.items) {
    if (ids.has(item.id)) throw new Error("备份内包含重复 ID，请检查文件");
    ids.add(item.id);
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(item.photo);
    if (!match || match[2].length > 28_000_000) throw new Error("备份包含无效或过大的图片");
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    const photo = new Blob([bytes], { type: match[1] });
    const url = URL.createObjectURL(photo);
    try { const image = new Image(); image.src = url; await image.decode(); }
    catch { throw new Error("备份中有无法读取的照片，未导入任何内容"); }
    finally { URL.revokeObjectURL(url); }
    items.push({ ...item, photo });
  }
  return { items, state: backup.state ?? freshState() };
}
export async function parseBackup(text: string) { return (await parseBackupBundle(text)).items; }
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ":" + stable(v)).join(",") + "}";
  return JSON.stringify(value);
}
export async function fingerprint(item: Clothing) {
  const digest = await crypto.subtle.digest("SHA-256", await item.photo.arrayBuffer());
  return `${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,"0")).join("")}|${item.category}|${item.color.normalize("NFKC").trim().toLowerCase().replace(/\s/g,"")}|${Boolean(item.dirty)}|${stable(item.attributes ?? null)}`;
}
export async function mergeBackup(existing: Clothing[], incoming: Clothing[]) {
  const fingerprints = new Map<string,string>();
  for (const item of existing) fingerprints.set(await fingerprint(item), item.id);
  const ids = new Set(existing.map(i => i.id)), idMap: Record<string,string> = Object.create(null);
  const additions: Clothing[] = []; let duplicates = 0, conflicts = 0;
  for (const item of incoming) {
    const key = await fingerprint(item), duplicateId = fingerprints.get(key);
    if (duplicateId) { duplicates++; idMap[item.id] = duplicateId; continue; }
    let id = item.id;
    if (ids.has(id)) { conflicts++; do { id = crypto.randomUUID(); } while (ids.has(id)); }
    ids.add(id); fingerprints.set(key,id); idMap[item.id] = id; additions.push({ ...item,id });
  }
  return { additions, duplicates, conflicts, idMap };
}
export function mergeBackupState(current: AppState, incoming: AppState, idMap: Record<string,string>, replace: boolean): AppState {
  const mapIds = (ids: string[]) => ids.map(id => idMap[id]).filter(Boolean);
  const mapped: AppState = { ...incoming, selected: Object.fromEntries(Object.entries(incoming.selected).filter(([,id]) => idMap[id]).map(([cat,id]) => [cat,idMap[id]])), locked: Object.fromEntries(Object.entries(incoming.locked).filter(([,id]) => idMap[id]).map(([cat,id]) => [cat,idMap[id]])), favorites: incoming.favorites.filter(ids => ids.every(id => idMap[id])).map(ids => [...new Set(mapIds(ids))]).filter(ids => ids.length >= 3), history: incoming.history.map(h => ({ ...h, ids: mapIds(h.ids) })), candidates: [] };
  const base = replace ? freshState() : current;
  const favorites = [...new Map([...base.favorites, ...mapped.favorites].map(ids => [[...ids].sort().join("|"),ids])).values()];
  const history = [...new Map([...base.history,...mapped.history].map(h => [h.date + [...h.ids].sort().join("|"),h])).values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-100);
  return { ...(replace ? mapped : base), favorites, history, candidates: [] };
}
