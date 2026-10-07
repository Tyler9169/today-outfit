"use client";
import { useEffect, useRef, useState } from "react";
import { exportBackup, mergeBackup, mergeBackupState, parseBackupBundle } from "@/lib/backup";
import { type Clothing } from "@/lib/wardrobe";
import { type AppState, type Scene } from "@/lib/app-state";
import { recommend, type Conditions } from "@/lib/recommend";
import { slots } from "@/lib/outfits";
import type { Mutate } from "@/app/page";
import { BriefcaseBusiness, Heart, Coffee, Users, Dumbbell } from "lucide-react";
import { WeatherPicker } from "./weather-picker";
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
export function OutfitTools({ items, state, mutate, disabled, mode="today", name="", upload, showOutfit, resetToken=0 }: Props & {mode?:"today"|"favorites";name?:string;upload?:()=>void;showOutfit?:()=>void;resetToken?:number}) {
  const [sceneChosen,setSceneChosen]=useState(false);
  const [hasResult,setHasResult]=useState(false);
  const [fromFavorite,setFromFavorite]=useState(false);
  useEffect(()=>{setSceneChosen(false);},[resetToken]);
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
  function generate(only?: typeof slots[number], scene?:Scene) {
    const temp = Number(temperature);
    if(!temperature.trim() || !Number.isFinite(temp) || temp < -50 || temp > 60 || !conditions.scenes.length) {setMessage("请选择至少一个场景，并填写 -50 至 60℃ 的温度。");return;}
    if(conditions.weather && Date.now()-conditions.weather.fetchedAt>30*60*1000){setMessage("已应用的天气超过30分钟，请重新获取，或手动修改气温切回手动条件。");return;}
    setFromFavorite(false);
    let reason = "";
    void action(s=>{const result=recommend(s.items,s.state,{...conditions,scenes:scene?[scene]:conditions.scenes,temperature:temp},only);reason=result.reason;setHasResult(result.complete);return {...s,state:{...s.state,selected:result.selected,locked:result.locked}};}).then(ok=>{if(ok && reason) setMessage(reason);});
  }
  return <section className={`panel outfit-panel ${!sceneChosen&&mode==="today"?"scene-start":""}`} aria-labelledby={mode==="today"?"outfit-title":undefined} aria-label={mode==="favorites"?"收藏搭配":undefined}>{mode==="today"&&<><div className="scene-intro"><p className="hint">{name}，你好</p><h2 id="outfit-title">{sceneChosen?(fromFavorite?"收藏的这一套":`${conditions.scenes.join(" · ")}，这样穿`):"今天去哪里？"}</h2><p className="hint">{sceneChosen?"从自己的衣橱，搭出今天的心情。":"选一个场景，开始今天的搭配。"}</p></div>
    {!sceneChosen?<><div className="scene-cards">{([{scene:"通勤",description:"利落自在，开启工作日",icon:BriefcaseBusiness},{scene:"日常",description:"轻松出门，舒服做自己",icon:Coffee},{scene:"约会",description:"为相见，多一点心意",icon:Heart},{scene:"聚会",description:"和朋友，留下好心情",icon:Users},{scene:"运动",description:"舒展身体，自在行动",icon:Dumbbell}] as const).map(({scene,description,icon:Icon})=><button key={scene} disabled={disabled} onClick={()=>{setConditions(c=>({...c,scenes:[scene]}));setSceneChosen(true);setMessage("");generate(undefined,scene);}}><Icon aria-hidden="true"/><span><strong>{scene}</strong><small>{description}</small></span></button>)}</div>{items.length===0&&<button className="empty-wardrobe-link" onClick={upload}>衣橱还是空的 · 先上传衣服</button>}</>:<><button className="change-scene" onClick={()=>setSceneChosen(false)}>重新选择场景</button>
    <details className="outfit-settings"><summary>天气与出门条件 · {temperature}℃{conditions.rain?" · 雨天":""}</summary><WeatherPicker disabled={disabled} apply={weather=>{setTemperature(String(weather.low));setConditions(c=>({...c,rain:weather.rainProbability>=40,weather}));}}/><fieldset disabled={disabled}>
      <div className="conditions"><label>体感气温 ℃<input type="number" min="-50" max="60" value={temperature} onChange={e=>{setTemperature(e.target.value);setConditions(c=>({...c,weather:undefined}));}}/></label><label>活动地点<select value={conditions.location} onChange={e=>setConditions({...conditions,location:e.target.value as Conditions["location"]})}><option>都有</option><option>室内</option><option>室外</option></select></label><label className="check-row"><input type="checkbox" checked={conditions.rain} onChange={e=>setConditions({...conditions,rain:e.target.checked,weather:undefined})}/>雨天</label></div>
    </fieldset></details><fieldset disabled={disabled}>
      <div className="action-row"><button className="primary" onClick={()=>generate()}>生成搭配 / 换一套</button><button hidden={!hasResult} disabled={!complete} aria-pressed={favorite} onClick={()=>void action(s=>{const ids=slots.map(cat=>s.state.selected[cat]).filter(Boolean); const exists=s.state.favorites.some(f=>signature(f)===signature(ids));return {...s,state:{...s.state,favorites:exists?s.state.favorites.filter(f=>signature(f)!==signature(ids)):[...s.state.favorites,ids]}};},favorite?"已取消收藏。":"已收藏这套搭配。")}>{favorite?"已收藏 · 取消":"收藏这套"}</button><button hidden={!hasResult} disabled={!complete} onClick={()=>void action(s=>({...s,state:{...s.state,history:[...s.state.history,{date:new Date().toLocaleDateString("sv-SE"),ids:chosen.map(i=>i.id)}].slice(-100)}}),"已记下今天穿过的搭配，下次会优先考虑其他衣服。")}>今天就穿这套</button></div>
      <div className="outfit-grid" hidden={!hasResult}>{slots.filter(cat=>cat!=="外套"||state.selected[cat]).map(cat=>{const item=chosen.find(i=>i.category===cat);return <article className="outfit-card" key={cat}><h3>{cat}</h3>{item?<><Photo photo={item.photo} alt={`${item.color}${cat}`} className="outfit-photo"/><p>{item.color}</p><div className="action-row"><button aria-pressed={!!state.locked[cat]} onClick={()=>void action(s=>{const locked={...s.state.locked};if(locked[cat])delete locked[cat];else locked[cat]=item.id;return {...s,state:{...s.state,locked}};})}>{state.locked[cat]?"已固定 · 解锁":"固定"}</button><button disabled={!!state.locked[cat]} onClick={()=>generate(cat)}>替换{cat}</button></div></>:<div className="slot-empty">{items.some(i=>i.category===cat&&!i.dirty)?"等待搭配":"请添加可穿的"+cat}</div>}</article>;})}</div>
    </fieldset><p role="status" className="feedback">{message}</p>{!hasResult&&<button onClick={upload}>去上传衣服</button>}<p className="hint">使用衣橱中的类别、颜色和你确认的适用条件推荐；未确认的保暖与场景信息不会当作事实。</p>
    </>}</>}
    <div className="favorites" hidden={mode!=="favorites"}><p role="status" className="feedback">{message}</p><h3>收藏的搭配 <span className="hint">{state.favorites.length} 套</span></h3>{!state.favorites.length?<p className="hint">找到喜欢的一套后，点“收藏这套”。</p>:<div className="favorite-grid">{state.favorites.map((ids,index)=>{const clothes=ids.map(id=>items.find(i=>i.id===id)).filter((i):i is Clothing=>!!i);const unavailable=clothes.some(i=>i.dirty);return <article className="favorite-card" key={signature(ids)}><div className="favorite-photos">{clothes.map(i=><Photo key={i.id} photo={i.photo} alt={`${i.color}${i.category}`} className="favorite-photo"/>)}</div><p>搭配 {index+1}{unavailable?" · 有待洗衣服":""}</p><p className="hint">{clothes.map(i=>i.color+i.category).join("、")}</p><div className="action-row"><button disabled={disabled||unavailable} onClick={()=>void action(s=>({...s,state:{...s.state,selected:Object.fromEntries(clothes.map(i=>[i.category,i.id])),locked:{}}}),"已应用收藏，可以继续固定或局部替换。").then(ok=>{if(ok){setFromFavorite(true);setSceneChosen(true);setHasResult(true);showOutfit?.();}})}>应用搭配</button><button disabled={disabled} onClick={()=>void action(s=>({...s,state:{...s.state,favorites:s.state.favorites.filter(f=>signature(f)!==signature(ids))}}),"已取消收藏。")}>取消收藏</button></div></article>;})}</div>}</div>
  </section>;
}
