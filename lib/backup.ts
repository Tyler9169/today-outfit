import { z } from "zod";
import { categories, type Clothing } from "./wardrobe";
const record = z.object({ id: z.string().min(1).max(200), category: z.enum(categories), color: z.string().trim().min(1).max(30), createdAt: z.number().finite().nonnegative(), photo: z.string().startsWith("data:image/") });
const schema = z.object({ format: z.literal("my-wardrobe"), version: z.literal(1), items: z.array(record).max(5000) });
export async function exportBackup(items: Clothing[]) {
  const records = await Promise.all(items.map(async item => ({ ...item, photo: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(item.photo); }) })));
  return JSON.stringify({ format: "my-wardrobe", version: 1, items: records });
}
export async function parseBackup(text: string): Promise<Clothing[]> {
  const backup = schema.parse(JSON.parse(text));
  const items: Clothing[] = [];
  for (const item of backup.items) {
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
  return items;
}
export async function fingerprint(item: Clothing) {
  const digest = await crypto.subtle.digest("SHA-256", await item.photo.arrayBuffer());
  return `${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("")}|${item.category}|${item.color.normalize("NFKC").trim().toLowerCase().replace(/\s/g, "")}`;
}
export async function mergeBackup(existing: Clothing[], incoming: Clothing[]) {
  const fingerprints = new Set(await Promise.all(existing.map(fingerprint)));
  const ids = new Set(existing.map(i => i.id));
  const additions: Clothing[] = [];
  let duplicates = 0, conflicts = 0;
  for (const item of incoming) {
    const key = await fingerprint(item);
    if (fingerprints.has(key)) { duplicates++; continue; }
    let id = item.id;
    if (ids.has(id)) { conflicts++; id = crypto.randomUUID(); }
    ids.add(id); fingerprints.add(key); additions.push({ ...item, id });
  }
  return { additions, duplicates, conflicts };
}
