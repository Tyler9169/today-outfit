"use client";
import { useEffect, useRef, useState } from "react";
import { exportBackup, mergeBackup, mergeBackupState, parseBackupBundle } from "@/lib/backup";
import { type Clothing } from "@/lib/wardrobe";
import { type AppState, scenes } from "@/lib/app-state";
import { recommend, type Conditions } from "@/lib/recommend";
import { slots } from "@/lib/outfits";
import type { Mutate } from "@/app/page";
import { ConfirmAction } from "./confirm-action";
import { Photo } from "./wardrobe-photo";

type Props = { items: Clothing[]; state: AppState; mutate: Mutate; disabled: boolean };
export function BackupTools({ items, state, mutate, disabled }: Props) {
  const [confirmReplace,setConfirmReplace] = useState(false);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof parseBackupBundle>> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);
  async function exportAll() {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      const text = await exportBackup(items, state);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `wardrobe-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setDownloadUrl(url);
      setMessage("备份已生成，包含照片、衣服信息和收藏搭配。请保存下载文件。");
    } catch { setMessage("导出失败，请重试；衣橱未改变。"); }
    finally { guard.current = false; setBusy(false); }
  }
  async function preview(file?: File) {
    if (!file || guard.current) return;
    guard.current = true; setBusy(true); setPending(null);
    try {
      if (file.size > 200 * 1024 * 1024) throw new Error("备份超过 200 MB，暂不能导入。");
      const incoming = await parseBackupBundle(await file.text());
      const plan = await mergeBackup(items, incoming.items);
      setPending(incoming);
      setMessage(`共 ${incoming.items.length} 件、${incoming.state.favorites.length} 套收藏：新增 ${plan.additions.length}，重复 ${plan.duplicates}，ID 冲突 ${plan.conflicts}（将另存，不覆盖）。`);
    } catch (e) { setMessage(e instanceof Error ? `导入失败：${e.message}` : "备份无法读取。"); }
    finally { guard.current = false; setBusy(false); }
  }
  async function commit(replace: boolean) {
    if (!pending || guard.current) return;
    guard.current = true; setBusy(true);
    try {
      let count = 0, duplicates = 0;
      await mutate(async current => {
        const plan = await mergeBackup(replace ? [] : current.items, pending.items);
        count = plan.additions.length; duplicates = plan.duplicates;
        return { items: [...(replace ? [] : current.items), ...plan.additions].sort((a,b)=>b.createdAt-a.createdAt), state: mergeBackupState(current.state, pending.state, plan.idMap, replace) };
      });
      setPending(null); setMessage(`导入完成：${count} 件，跳过 ${duplicates} 件重复记录，收藏已同步处理。`);
    } catch { setMessage("导入失败，原衣橱和收藏仍保留。请检查可用空间后重试。"); }
    finally { guard.current = false; setBusy(false); }
  }
  return <section className="panel"><ConfirmAction open={confirmReplace} close={()=>setConfirmReplace(false)} title="替换全部" description={`将用备份替换当前 ${items.length} 件衣服和全部收藏。建议先导出备份。`} confirm={()=>void commit(true)}/><h2>备份与迁移</h2><p className="hint">包含照片、衣服信息和收藏搭配。备份文件不上传，手机和电脑可互相导入。</p>
    <fieldset disabled={disabled || busy}><div className="action-row"><button onClick={()=>void exportAll()}>导出含照片的备份</button><label className="backup-file">选择备份<input type="file" accept="application/json,.json" onChange={e=>{void preview(e.target.files?.[0]);e.target.value="";}}/></label></div>
      {pending && <div className="action-row"><button className="primary" onClick={()=>void commit(false)}>合并导入</button><button onClick={()=>setConfirmReplace(true)}>替换全部…</button><button onClick={()=>{setPending(null);setMessage("已取消导入。");}}>取消导入</button></div>}
    </fieldset>{downloadUrl && <a className="download-link" href={downloadUrl} download={`wardrobe-${new Date().toISOString().slice(0,10)}.json`}>备份已就绪 · 保存文件</a>}<p role="status" className="feedback">{busy ? "正在处理照片和数据，请稍候…" : message}</p>
  </section>;
}

const signature = (ids: string[]) => [...ids].sort().join("|");
export function OutfitTools({ items, state, mutate, disabled }: Props) {
  const [conditions, setConditions] = useState<Conditions>({ scenes: ["日常"], temperature: 22, rain: false, location: "都有" });
  const [message, setMessage] = useState("");
  const [temperature, setTemperature] = useState("22");
  const chosen = slots.map(cat=>items.find(i=>i.id===state.selected[cat])).filter((i): i is Clothing=>!!i);
  const complete = slots.slice(0,3).every(cat=>chosen.some(i=>i.category===cat && !i.dirty));
  const favorite = state.favorites.some(ids=>signature(ids)===signature(chosen.map(i=>i.id)));
  async function action(change: Parameters<Mutate>[0], success?: string) {
    try { await mutate(change); if(success) setMessage(success); return true; }
    catch { setMessage("保存失败，原搭配与收藏仍保留，请重试。"); return false; }
  }
  function generate(only?: typeof slots[number]) {
    const temp = Number(temperature);
    if(!temperature.trim() || !Number.isFinite(temp) || temp < -50 || temp > 60 || !conditions.scenes.length) {setMessage("请选择至少一个场景，并填写 -50 至 60℃ 的温度。");return;}
    let reason = "";
    void action(s=>{const result=recommend(s.items,s.state,{...conditions,temperature:temp},only);reason=result.reason;return {...s,state:{...s.state,selected:result.selected,locked:result.locked}};}).then(ok=>{if(ok && reason) setMessage(reason);});
  }
  return <section className="panel outfit-panel" aria-labelledby="outfit-title"><div className="section-heading"><h2 id="outfit-title">今天穿什么</h2><span className="badge">一次选一套</span></div>
    <fieldset disabled={disabled}><div className="chips" aria-label="穿着场景">{scenes.map(scene=><button key={scene} aria-pressed={conditions.scenes.includes(scene)} onClick={()=>setConditions(c=>({...c,scenes:c.scenes.includes(scene)?c.scenes.filter(s=>s!==scene):[...c.scenes,scene]}))}>{scene}</button>)}</div>
      <div className="conditions"><label>气温 ℃<input type="number" min="-50" max="60" value={temperature} onChange={e=>setTemperature(e.target.value)}/></label><label>活动地点<select value={conditions.location} onChange={e=>setConditions({...conditions,location:e.target.value as Conditions["location"]})}><option>都有</option><option>室内</option><option>室外</option></select></label><label className="check-row"><input type="checkbox" checked={conditions.rain} onChange={e=>setConditions({...conditions,rain:e.target.checked})}/>雨天</label></div>
      <div className="action-row"><button className="primary" onClick={()=>generate()}>生成搭配 / 换一套</button><button disabled={!complete} aria-pressed={favorite} onClick={()=>void action(s=>{const ids=slots.map(cat=>s.state.selected[cat]).filter(Boolean); const exists=s.state.favorites.some(f=>signature(f)===signature(ids));return {...s,state:{...s.state,favorites:exists?s.state.favorites.filter(f=>signature(f)!==signature(ids)):[...s.state.favorites,ids]}};},favorite?"已取消收藏。":"已收藏这套搭配。")}>{favorite?"已收藏 · 取消":"收藏这套"}</button><button disabled={!complete} onClick={()=>void action(s=>({...s,state:{...s.state,history:[...s.state.history,{date:new Date().toLocaleDateString("sv-SE"),ids:chosen.map(i=>i.id)}].slice(-100)}}),"已记下今天穿过的搭配，下次会优先考虑其他衣服。")}>今天就穿这套</button></div>
      <div className="outfit-grid">{slots.filter(cat=>cat!=="外套"||state.selected[cat]).map(cat=>{const item=chosen.find(i=>i.category===cat);return <article className="outfit-card" key={cat}><h3>{cat}</h3>{item?<><Photo photo={item.photo} alt={`${item.color}${cat}`} className="outfit-photo"/><p>{item.color}</p><div className="action-row"><button aria-pressed={!!state.locked[cat]} onClick={()=>void action(s=>{const locked={...s.state.locked};if(locked[cat])delete locked[cat];else locked[cat]=item.id;return {...s,state:{...s.state,locked}};})}>{state.locked[cat]?"已固定 · 解锁":"固定"}</button><button disabled={!!state.locked[cat]} onClick={()=>generate(cat)}>替换{cat}</button></div></>:<div className="slot-empty">{items.some(i=>i.category===cat&&!i.dirty)?"等待搭配":"请添加可穿的"+cat}</div>}</article>;})}</div>
    </fieldset><p role="status" className="feedback">{message}</p><p className="hint">使用衣橱中的类别、颜色和你确认的适用条件推荐；未确认的保暖与场景信息不会当作事实。</p>
    <div className="favorites"><h3>收藏的搭配 <span className="hint">{state.favorites.length} 套</span></h3>{!state.favorites.length?<p className="hint">找到喜欢的一套后，点“收藏这套”。</p>:<div className="favorite-grid">{state.favorites.map((ids,index)=>{const clothes=ids.map(id=>items.find(i=>i.id===id)).filter((i):i is Clothing=>!!i);const unavailable=clothes.some(i=>i.dirty);return <article className="favorite-card" key={signature(ids)}><div className="favorite-photos">{clothes.map(i=><Photo key={i.id} photo={i.photo} alt={`${i.color}${i.category}`} className="favorite-photo"/>)}</div><p>搭配 {index+1}{unavailable?" · 有待洗衣服":""}</p><p className="hint">{clothes.map(i=>i.color+i.category).join("、")}</p><div className="action-row"><button disabled={disabled||unavailable} onClick={()=>void action(s=>({...s,state:{...s.state,selected:Object.fromEntries(clothes.map(i=>[i.category,i.id])),locked:{}}}),"已应用收藏，可以继续固定或局部替换。")}>应用搭配</button><button disabled={disabled} onClick={()=>void action(s=>({...s,state:{...s.state,favorites:s.state.favorites.filter(f=>signature(f)!==signature(ids))}}),"已取消收藏。")}>取消收藏</button></div></article>;})}</div>}</div>
  </section>;
}
