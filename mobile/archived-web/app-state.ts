import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
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
  const text = Capacitor.isNativePlatform() ? (await Preferences.get({ key: "wardrobe-app-v2" })).value : localStorage.getItem("wardrobe-app-v2");
  return text ? stateSchema.parse(JSON.parse(text)) : freshState();
}
export async function writeAppState(state: AppState) {
  const value = JSON.stringify(stateSchema.parse(state));
  if (Capacitor.isNativePlatform()) await Preferences.set({ key: "wardrobe-app-v2", value });
  else localStorage.setItem("wardrobe-app-v2", value);
}
export function pruneState(state: AppState, ids: Set<string>): AppState {
  return { ...state, selected: Object.fromEntries(Object.entries(state.selected).filter(([,id]) => ids.has(id))), locked: Object.fromEntries(Object.entries(state.locked).filter(([,id]) => ids.has(id))), favorites: state.favorites.filter(set => set.every(id => ids.has(id))), candidates: state.candidates.filter(set => set.ids.every(id => ids.has(id))), history: state.history.map(h => ({ ...h, ids: h.ids.filter(id => ids.has(id)) })) };
}
