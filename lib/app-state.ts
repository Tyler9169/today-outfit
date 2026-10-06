import { readMeta, writeMeta } from "./wardrobe";
import { z } from "zod";
export const scenes = ["日常", "通勤", "约会", "聚会", "运动"] as const;
export type Scene = typeof scenes[number];
export const stateSchema = z.object({
  selected: z.record(z.string()).default({}), locked: z.record(z.string()).default({}),
  favorites: z.array(z.array(z.string())).default([]),
  history: z.array(z.object({ date: z.string(), ids: z.array(z.string()) })).default([]),
  candidates: z.array(z.object({ scene: z.enum(scenes), ids: z.array(z.string()), reason: z.string() })).default([]),
  preparedAt: z.string().optional(),
});
export type AppState = z.infer<typeof stateSchema>;
export const freshState = (): AppState => stateSchema.parse({});
export async function readAppState(): Promise<AppState> {
  const value = await readMeta();
  if (value) return stateSchema.parse(value);
  const legacy = localStorage.getItem("wardrobe-app-v2");
  if (legacy) return stateSchema.parse(JSON.parse(legacy));
  const outfit = localStorage.getItem("wardrobe-outfit-v1");
  if (outfit) return stateSchema.parse(JSON.parse(outfit));
  return freshState();
}
export async function writeAppState(state: AppState) {
  await writeMeta(stateSchema.parse(state));
}
export function pruneState(state: AppState, ids: Set<string>): AppState {
  return { ...state, selected: Object.fromEntries(Object.entries(state.selected).filter(([,id]) => ids.has(id))), locked: Object.fromEntries(Object.entries(state.locked).filter(([,id]) => ids.has(id))), favorites: state.favorites.filter(set => set.every(id => ids.has(id))), candidates: state.candidates.filter(set => set.ids.every(id => ids.has(id))), history: state.history.map(h => ({ ...h, ids: h.ids.filter(id => ids.has(id)) })) };
}

export function reconcileState(state: AppState, items: import("./wardrobe").Clothing[]): AppState {
  const valid = pruneState(state, new Set(items.map(i => i.id)));
  const clean = (values: Record<string,string>) => Object.fromEntries(Object.entries(values).filter(([cat,id]) => items.some(i => i.id === id && i.category === cat && !i.dirty)));
  return { ...valid, selected: clean(valid.selected), locked: clean(valid.locked), candidates: [] };
}
