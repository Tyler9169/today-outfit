"use client";

import { useEffect, useRef, useState } from "react";
import { Shirt } from "lucide-react";
import { BatchUpload } from "@/components/batch-upload";
import { ClothingFields, type Fields } from "@/components/clothing-fields";
import { ConfirmAction } from "@/components/confirm-action";
import { Photo } from "@/components/wardrobe-photo";
import { BackupTools, OutfitTools } from "@/components/wardrobe-tools";
import { SiteLifecycle } from "@/components/site-lifecycle";
import { attributesSchema } from "@/lib/backup";
import { freshState, readAppState, reconcileState, type AppState } from "@/lib/app-state";
import { commitWardrobe, getClothes, type Clothing } from "@/lib/wardrobe";

export type Snapshot = { items: Clothing[]; state: AppState };
export type Change = (current: Snapshot) => Snapshot | Promise<Snapshot>;
export type Mutate = (change: Change) => Promise<void>;

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ items: [], state: freshState() });
  const current = useRef(snapshot), writing = useRef(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [removeTarget,setRemoveTarget] = useState<Clothing | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({ category: "", color: "" });
  const upload = useRef<HTMLDivElement>(null);
  async function load() {
    setLoading(true); setLoadFailed(false); setError("");
    try {
      const items = await getClothes();
      const state = reconcileState(await readAppState(), items);
      current.current = { items, state }; setSnapshot(current.current);
    } catch { setLoadFailed(true); setError("衣橱或搭配信息读取失败。原数据未修改，请允许浏览器存储后重试。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const mutate: Mutate = async change => {
    if (writing.current) throw new Error("正在保存，请稍后重试。");
    writing.current = true; setBusy(true);
    try {
      const before = current.current;
      const next = await change(before);
      next.state = reconcileState(next.state, next.items);
      await commitWardrobe(before.items, next.items, next.state);
      current.current = next; setSnapshot(next);
    } finally { writing.current = false; setBusy(false); }
  };
  async function changeItem(item: Clothing, remove = false) {
    setError(""); setNotice("");
    try {
      await mutate(s => ({ ...s, items: remove ? s.items.filter(i => i.id !== item.id) : s.items.map(i => i.id === item.id ? item : i) }));
      setEditing(null); setNotice(remove ? "已删除衣服及失效搭配。" : "已更新衣服信息。");
    } catch { setError("保存失败，原数据仍保留，请重试。"); }
  }
  const { items, state } = snapshot;
  return <main className="wardrobe"><SiteLifecycle/><ConfirmAction open={!!removeTarget} close={()=>setRemoveTarget(null)} title="删除衣服" description={`删除${removeTarget?.color ?? ""}${removeTarget?.category ?? ""}？包含它的收藏搭配也会移除。`} confirm={()=>{if(removeTarget)void changeItem(removeTarget,true);}}/><header className="site-header"><Shirt aria-hidden="true"/><div><h1>今天穿什么</h1><p className="hint">从自己的衣橱，选一套喜欢的搭配</p></div></header>
    <div className="workspace"><p role="alert" className="error">{error}</p><p role="status" className="feedback">{notice}</p>
      {loading ? <p role="status">正在打开衣橱…</p> : loadFailed ? <button onClick={()=>void load()}>重新读取衣橱</button> : <>
        <OutfitTools items={items} state={state} mutate={mutate} disabled={busy}/>
        <div ref={upload}><BatchUpload disabled={busy} save={async item => { await mutate(s => ({ ...s, items: s.items.some(i=>i.id===item.id) ? s.items : [item,...s.items] })); }}/></div>
        <section className="panel" aria-labelledby="wardrobe-title"><div className="section-heading"><h2 id="wardrobe-title">我的衣橱</h2><span className="badge">{items.length} 件</span></div>
          {!items.length ? <div className="empty"><Shirt size={40}/><p>先添加一件衣服，慢慢收齐你的衣橱。</p><button onClick={()=>upload.current?.querySelector("input")?.click()}>添加第一件衣服</button></div> : <ul className="clothes-grid">{items.map(item=><li className="clothes-card" key={item.id}><Photo photo={item.photo} alt={`${item.color}${item.category}`} className="clothes-photo"/><div className="card-body"><p className="hint">{item.category}{item.dirty ? " · 待洗" : ""}</p><h3>{item.color}</h3>
            {editing===item.id ? <><ClothingFields value={fields} change={setFields}/><div className="action-row"><button disabled={busy} onClick={()=>{ if(!fields.category || !fields.color.trim() || (fields.attributes && !attributesSchema.safeParse(fields.attributes).success)) {setError("请检查类别、颜色与温度范围。");return;} void changeItem({...item,category:fields.category,color:fields.color.trim(),attributes:fields.attributes}); }}>保存修改</button><button onClick={()=>setEditing(null)}>取消</button></div></> : <div className="action-row"><button disabled={busy||item.dirty} onClick={()=>{void mutate(s=>({...s,state:{...s.state,selected:{...s.state.selected,[item.category]:item.id},locked:{...s.state.locked,[item.category]:item.id}}})).then(()=>{document.getElementById("outfit-title")?.scrollIntoView({behavior:"smooth"});setNotice("已固定这件衣服，点击生成搭配补齐其余部分。");}).catch(()=>setError("固定失败，请重试。"));}}>围绕这件搭配</button><button disabled={busy} onClick={()=>{setEditing(item.id);setFields(item);}}>编辑</button><button disabled={busy} onClick={()=>void changeItem({...item,dirty:!item.dirty})}>{item.dirty?"恢复可穿":"标记待洗"}</button><button disabled={busy} onClick={()=>setRemoveTarget(item)}>删除</button></div>}
          </div></li>)}</ul>}
        </section>
        <BackupTools items={items} state={state} mutate={mutate} disabled={busy}/>
      </>}
      <footer className="hint">衣橱与照片保存在当前浏览器，不会自动同步。换设备或清理浏览器前，请导出含照片的备份。联网识别时会发送压缩照片，未配置时可手动录入。</footer>
    </div></main>;
}
