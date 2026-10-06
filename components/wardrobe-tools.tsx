"use client";
import { useEffect, useRef, useState } from "react";
import { exportBackup, mergeBackup, parseBackup } from "@/lib/backup";
import { importClothes, type Clothing } from "@/lib/wardrobe";
import { chooseOutfit, cleanOutfit, emptyOutfit, outfitReason, slots, type OutfitState } from "@/lib/outfits";
import { Photo } from "./wardrobe-photo";

export function BackupTools({ items, reload, disabled }: { items: Clothing[]; reload: () => Promise<void>; disabled: boolean }) {
  const [pending, setPending] = useState<Clothing[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  async function exportAll() {
    setBusy(true);
    try { const text = await exportBackup(items); const url = URL.createObjectURL(new Blob([text], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `wardrobe-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); setMessage("备份已生成，请保存下载的文件。"); }
    catch { setMessage("导出失败，请重试；衣橱未改变。"); } finally { setBusy(false); }
  }
  async function preview(file?: File) {
    if (!file) return;
    setBusy(true); setPending(null);
    try {
      if (file.size > 200 * 1024 * 1024) throw new Error("备份超过 200 MB，请拆分后导入。");
      const incoming = await parseBackup(await file.text()); const plan = await mergeBackup(items, incoming);
      setPending(incoming); setMessage(`共 ${incoming.length} 件：新增 ${plan.additions.length}，重复 ${plan.duplicates}，ID 冲突 ${plan.conflicts}（将另存，不覆盖）。`);
    } catch (e) { setMessage(e instanceof Error ? `导入失败：${e.message}` : "备份无法读取。"); } finally { setBusy(false); }
  }
  async function commit(replace: boolean) {
    if (!pending || guard.current) return;
    if (replace && !window.confirm(`将删除当前 ${items.length} 件衣服，并用备份替换全部数据。建议先导出备份。确定继续？`)) return;
    guard.current = true; setBusy(true);
    try {
      const plan = await mergeBackup(replace ? [] : items, pending);
      await importClothes(plan.additions, replace); await reload(); setPending(null); setMessage(`导入完成：${plan.additions.length} 件，跳过 ${plan.duplicates} 件重复记录。`);
    } catch { setMessage("导入失败，事务已回滚，原衣橱仍保留。请检查可用空间后重试。"); }
    finally { guard.current = false; setBusy(false); }
  }
  return <section className="tool-panel"><h2>备份与迁移</h2><p className="hint">包含照片与信息，文件不会上传。Mac 和手机可互相导入。</p><fieldset disabled={disabled || busy} className="flex flex-wrap gap-3 mt-3"><button className="small-button" onClick={() => void exportAll()}>导出衣橱</button><label className="small-button cursor-pointer">选择备份<input className="block max-w-full text-xs mt-2" type="file" accept="application/json,.json" onChange={e => { void preview(e.target.files?.[0]); e.target.value = ""; }} /></label>{pending && <><button className="small-button" onClick={() => void commit(false)}>合并导入</button><button className="small-button" onClick={() => void commit(true)}>替换全部…</button><button className="small-button" onClick={() => { setPending(null); setMessage("已取消导入。"); }}>取消</button></>}</fieldset><p role="status" className="hint mt-3">{busy ? "正在处理，请稍候…" : message}</p></section>;
}

export function OutfitTools({ items, anchor }: { items: Clothing[]; anchor: Clothing | null }) {
  const [state, setState] = useState<OutfitState>(emptyOutfit);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let restored = emptyOutfit();
    try { const value = JSON.parse(localStorage.getItem("wardrobe-outfit-v1") ?? "null"); if (value?.selected && value?.locked) restored = cleanOutfit(value, items); } catch { /* malformed saved choices do not affect clothes */ }
    // Load preferences after hydration; wardrobe is already loaded by parent.
    queueMicrotask(() => { setState(restored); setReady(true); });
  // Load once; subsequent wardrobe edits are reconciled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const valid = cleanOutfit(state, items);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("wardrobe-outfit-v1", JSON.stringify(cleanOutfit(state, items))); }
    catch { queueMicrotask(() => setMessage("搭配选择无法持久保存，衣橱数据不受影响。")); }
  }, [state, items, ready]);
  useEffect(() => {
    if (!anchor) return;
    queueMicrotask(() => setState(previous => chooseOutfit(items, { selected: { ...previous.selected, [anchor.category]: anchor.id }, locked: { ...previous.locked, [anchor.category]: anchor.id } }).state));
  }, [anchor, items]);
  const chosen = slots.map(cat => items.find(i => i.id === valid.selected[cat])).filter((i): i is Clothing => Boolean(i));
  return <section className="tool-panel"><div className="flex justify-between items-center gap-3"><h2>今天穿什么</h2><button disabled={!ready} className="small-button" onClick={() => { const next = chooseOutfit(items, valid); setState(next.state); setMessage(next.message); }}>换一套</button></div><p className="hint mt-2">一次一套 · 固定喜欢的单品，再替换其余部分</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">{slots.filter(cat => cat !== "外套" || valid.selected[cat]).map(cat => { const item = items.find(i => i.id === valid.selected[cat]); return <div key={cat} className="rounded-xl border border-[#dce2d8] p-3"><p className="text-sm mb-2">{cat}</p>{item ? <><Photo photo={item.photo} alt={`${item.color}${cat}`} className="w-full aspect-square object-contain rounded-lg bg-[#edf0e7]" /><p className="text-sm break-words mt-2">{item.color}</p><div className="flex flex-wrap gap-2"><button className="small-button" aria-pressed={Boolean(valid.locked[cat])} onClick={() => { const locked = { ...valid.locked }; if (locked[cat]) delete locked[cat]; else locked[cat] = item.id; setState({ ...valid, locked }); }}>{valid.locked[cat] ? "已固定 · 解锁" : "固定"}</button><button disabled={Boolean(valid.locked[cat])} className="small-button" onClick={() => { const result = chooseOutfit(items, valid, cat); setState(result.state); setMessage(result.message); }}>替换</button></div></> : <p className="hint">尚未选择{cat}</p>}</div>; })}</div><p className="hint mt-4">{outfitReason(chosen)}</p><p role="status" className="hint mt-2">{message}</p></section>;
}
