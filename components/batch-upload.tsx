"use client";
import { useEffect, useRef, useState } from "react";
import { recognizePhoto } from "@/lib/recognize-photo";
import { attributesSchema } from "@/lib/backup";
import type { Clothing } from "@/lib/wardrobe";
import { Photo } from "./wardrobe-photo";
import { ClothingFields, type Fields } from "./clothing-fields";
type Draft = Fields & { id: string; photo: File; status: "待处理"|"识别中"|"待确认"|"失败"|"手动录入"|"已保存"|"保存中"; message: string; edited: { category: boolean; color: boolean }; savedId?: string };
export function BatchUpload({ save, disabled = false }: { save: (item: Clothing) => Promise<void>; disabled?: boolean }) {
  const [drafts,setDrafts] = useState<Draft[]>([]);
  const live = useRef(drafts);
  const [configuration,setConfiguration] = useState<{ configured: boolean; missing: string[] } | null>(null);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [adding,setAdding] = useState(false);
  const addLock = useRef(false);
  const [saving,setSaving] = useState<string | null>(null);
  const running = useRef(false), saveLock = useRef(false), controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  function update(id: string, patch: Partial<Draft>) { if (!mounted.current) return; const next = live.current.map(d => d.id === id ? { ...d,...patch } : d); live.current = next; setDrafts(next); }
  useEffect(() => { mounted.current = true; const abort = new AbortController(); void fetch("/api/recognize", { signal: abort.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (mounted.current) setConfiguration(data as { configured: boolean; missing: string[] }); }).catch(() => { if (!abort.signal.aborted) setMessage("无法检查识别服务，可直接手动录入。"); }); return () => { mounted.current = false; abort.abort(); controller.current?.abort(); }; }, []);
  async function add(files: FileList | null) {
    if (!files || addLock.current) return;
    if (files.length > 30 || live.current.length + files.length > 100) { setMessage("每次最多选择 30 张，待处理列表最多 100 张。"); return; }
    addLock.current = true; setAdding(true);
    const next: Draft[] = []; const failures: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") || file.size > 20*1024*1024) { failures.push(`${file.name}：格式无效或超过 20 MB`); continue; }
      const url = URL.createObjectURL(file);
      try { const image = new Image(); image.src = url; await image.decode(); next.push({ id: crypto.randomUUID(),photo:file,category:"",color:"",status:configuration?.configured?"待处理":"手动录入",message:"请确认每张照片只有一件目标衣服。",edited:{category:false,color:false} }); }
      catch { failures.push(`${file.name}：无法预览，请换用 JPG、PNG 或 WebP`); }
      finally { URL.revokeObjectURL(url); }
    }
    addLock.current = false;
    if (!mounted.current) return;
    setAdding(false); live.current = [...live.current,...next]; setDrafts(live.current); setMessage(failures.join("；"));
    if (configuration?.configured) void process(next.map(d => d.id));
  }
  async function process(ids: string[]) {
    if (running.current) return;
    running.current = true; setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      for (const id of ids) {
        if (abort.signal.aborted) break;
        const draft = live.current.find(d => d.id === id);
        if (!draft || draft.status === "已保存" || draft.status === "保存中") continue;
        update(id,{status:"识别中",message:"正在联网识别…"});
        const url = URL.createObjectURL(draft.photo);
        try {
          const image = new Image(); image.src = url; await image.decode();
          if (abort.signal.aborted) break;
          const result = await recognizePhoto(image,abort.signal);
          const current = live.current.find(d => d.id === id);
          if (!current || abort.signal.aborted || current.status === "已保存") continue;
          update(id,{category:current.edited.category ? current.category : result.category ?? "",color:current.edited.color ? current.color : result.color ?? "",status:"待确认",message:result.needsConfirmation || !result.category ? "主体不明确或存在多件衣服：请换成单件照片，或明确填写目标单品。" : "识别结果待你确认；手动修改已保留。"});
        } catch (e) { if (!abort.signal.aborted) update(id,{status:"失败",message:e instanceof Error ? e.message : "识别失败，可手动录入。"}); }
        finally { URL.revokeObjectURL(url); }
      }
    } finally { running.current = false; if (mounted.current) { setBusy(false); live.current = live.current.map(d => d.status === "识别中" ? {...d,status:"手动录入",message:"识别已取消，可手动填写。"} : d); setDrafts(live.current); } }
  }
  async function confirm(draft: Draft) {
    if (saveLock.current || disabled || live.current.find(d=>d.id===draft.id)?.status === "已保存") return;
    if (!draft.category || !draft.color.trim()) { update(draft.id,{message:"请填写类别和颜色后确认保存。"}); return; }
    if (draft.attributes && !attributesSchema.safeParse(draft.attributes).success) { update(draft.id,{message:"请检查温度范围与适用条件。"}); return; }
    saveLock.current = true; setSaving(draft.id);
    try { const id = draft.savedId ?? crypto.randomUUID(); update(draft.id,{savedId:id,status:"保存中"}); await save({id,photo:draft.photo,category:draft.category,color:draft.color.trim(),attributes:draft.attributes,createdAt:Date.now()}); update(draft.id,{status:"已保存",message:"已保存到当前浏览器衣橱。"}); }
    catch { update(draft.id,{status:"手动录入",message:"保存失败，照片和填写内容已保留，请重试。"}); }
    finally { saveLock.current = false; setSaving(null); }
  }
  return <section className="panel"><h2>把衣服收进衣橱</h2><p className="hint">每张照片一件衣服。识别会发送压缩照片至配置的云端服务，结果由你确认。</p><label className="upload-zone">＋ 批量选择照片<input disabled={busy || adding || disabled} type="file" multiple accept="image/*" onChange={e => { void add(e.target.files); e.target.value=""; }}/></label><p className="hint">{configuration ? configuration.configured ? "云端识别已配置；尚不代表本次识别成功。" : `识别未配置：${configuration.missing.join("、")}。可手动录入。` : "正在检查识别服务；可先上传并手动录入。"}</p><p role="status" className="feedback">{message}</p>{drafts.length>0 && <><div className="action-row"><span className="hint">已保存 {drafts.filter(d=>d.status==="已保存").length} / {drafts.length} 件 · 已处理 {drafts.filter(d=>d.status!=="待处理" && d.status!=="识别中").length} 张</span>{busy ? <button onClick={()=>controller.current?.abort()}>停止识别</button> : configuration?.configured && <button onClick={()=>void process(drafts.filter(d=>d.status==="待处理"||d.status==="失败"||d.status==="手动录入").map(d=>d.id))}>处理待识别 / 失败项</button>}</div><div className="draft-grid">{drafts.map(d=><article className="draft-card" key={d.id}><Photo photo={d.photo} alt="待确认的衣服照片" className="draft-photo"/><span className="badge">{d.status}</span><fieldset disabled={disabled||d.status==="已保存"||saving!==null}><ClothingFields value={d} change={v=>update(d.id,{...v,edited:{category:d.edited.category||v.category!==d.category,color:d.edited.color||v.color!==d.color}})}/></fieldset><p role="status" className="hint">{d.message}</p><div className="action-row">{d.status!=="已保存" && <button className="primary" disabled={disabled||saving!==null||d.status==="识别中"} onClick={()=>void confirm(d)}>{saving===d.id?"保存中…":"确认并保存"}</button>}{d.status!=="已保存"&&configuration?.configured&&<button disabled={disabled||busy||saving!==null} onClick={()=>void process([d.id])}>重新识别</button>}<button disabled={saving===d.id} onClick={()=>{live.current=live.current.filter(x=>x.id!==d.id);setDrafts(live.current);}}>{d.status==="已保存"?"收起":"移除此照片"}</button></div></article>)}</div></>}</section>;
}
