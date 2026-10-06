import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import type { Clothing } from "./wardrobe";
type Stored = Omit<Clothing, "photo"> & { path: string; mime: string };
const pointer = "wardrobe-native-snapshot-v1";
let queue: Promise<unknown> = Promise.resolve();
async function records(): Promise<Stored[]> {
  const { value } = await Preferences.get({ key: pointer });
  if (!value) return [];
  const file = await Filesystem.readFile({ path: value, directory: Directory.Data, encoding: Encoding.UTF8 });
  const parsed = JSON.parse(String(file.data));
  if (!Array.isArray(parsed)) throw new Error("衣橱索引损坏，请导入备份恢复");
  return parsed;
}
export async function nativeRead(): Promise<Clothing[]> {
  const list = await records();
  const items: Clothing[] = [];
  for (const { path, mime, ...item } of list) {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    const photo = typeof file.data === "string" ? new Blob([Uint8Array.from(atob(file.data), c => c.charCodeAt(0))], { type: mime }) : file.data;
    items.push({ ...item, photo });
  }
  return items.sort((a,b) => b.createdAt-a.createdAt);
}
export function nativeChange(change: (items: Clothing[]) => Clothing[]) {
  const operation = queue.then(async () => {
    const previous = await records();
    const current = await nativeRead();
    const next = change(current);
    const version = crypto.randomUUID();
    const folder = `wardrobe/${version}`;
    const saved: Stored[] = [];
    // Immutable photos and snapshot are staged first. A single Preferences pointer commits.
    for (let index=0; index<next.length; index++) {
      const { photo, ...item } = next[index];
      const oldIndex = current.findIndex(i => i.id === item.id && i.photo === photo);
      const old = oldIndex >= 0 ? previous.find(i => i.id === item.id) : undefined;
      const path = old?.path ?? `${folder}/${index}.photo`;
      if (!old) {
        const data = await new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.onerror = () => reject(r.error); r.readAsDataURL(photo); });
        await Filesystem.writeFile({ path, directory: Directory.Data, recursive: true, data });
      }
      saved.push({ ...item, path, mime: photo.type });
    }
    const path = `${folder}/index.json`;
    const data = JSON.stringify(saved);
    await Filesystem.writeFile({ path, directory: Directory.Data, recursive: true, encoding: Encoding.UTF8, data });
    const verify = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
    if (verify.data !== data) throw new Error("衣橱写入验证失败");
    await Preferences.set({ key: pointer, value: path });
    // Older generations are retained for crash safety; never remove active photos on failure.
  });
  queue = operation.catch(() => {});
  return operation;
}
