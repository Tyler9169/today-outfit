"use client";
import { useEffect, useRef, useState } from "react";
import { fits, patterns, styles } from "@/lib/clothing-features";
import { recognizeLabel } from "@/lib/recognize-photo";
import type { Attributes } from "@/lib/wardrobe";
export function FeatureFields({value,change}:{value:Attributes;change:(value:Attributes)=>void}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [suggestion,setSuggestion]=useState<{labelText:string;composition:string|null}|null>(null);
  const [preview,setPreview]=useState(""); const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  function feature(key:string,text:string){change({...value,[key]:text||undefined,featuresConfirmed:false});}
  async function label(file?:File){if(!file)return;controller.current?.abort();setSuggestion(null);setMessage("");setPreview("");
    if(!file.type.startsWith("image/")||file.size>20*1024*1024){setMessage("请选择不超过20MB的标签照片。");return;}
    const c=new AbortController();controller.current=c;const url=URL.createObjectURL(file);setPreview(url);setBusy(true);
    try{const image=new Image();image.src=url;await image.decode();const result=await recognizeLabel(image,c.signal);if(!c.signal.aborted){setSuggestion(result);setMessage("标签读取完成，请对照原图核对，再填入并确认。");}}
    catch(e){if(!c.signal.aborted)setMessage(e instanceof Error?e.message:"标签读取失败，可手动填写。");}
    finally{if(controller.current===c)setBusy(false);}
  }
  return <details className="full-row"><summary>照片特征与材质标签</summary><p className="hint">照片特征是待确认建议。材质成分请参考洗标；不会仅凭外观判断保暖、防雨或真实尺码。</p><div className="field-grid">
    {([['fit','版型',fits],['pattern','图案',patterns],['style','风格',styles]] as const).map(([key,title,options])=><label key={key}>{title}<select value={value[key]??""} onChange={e=>feature(key,e.target.value)}><option value="">未确认</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>)}
    {([['neckline','领型'],['sleeve','袖长'],['length','衣长']] as const).map(([key,title])=><label key={key}>{title}<input maxLength={60} value={value[key]??""} onChange={e=>feature(key,e.target.value)}/></label>)}
    </div><label className="check-row"><input type="checkbox" checked={value.featuresConfirmed??false} onChange={e=>change({...value,featuresConfirmed:e.target.checked})}/>以上照片特征由我确认</label>
    <label>上传材质标签照片<input type="file" accept="image/*" disabled={busy} onChange={e=>{void label(e.target.files?.[0]);e.target.value="";}}/></label><p className="hint">点击上传会将压缩标签照片发送到已配置的识别服务；原图仅临时预览，不写入衣橱备份。</p>
    {preview&&<img src={preview} alt="待核对的材质标签" className="label-preview"/>}
    {busy&&<button type="button" onClick={()=>{controller.current?.abort();setBusy(false);setMessage("已取消，可手动填写材质。");}}>取消标签识别</button>}
    {suggestion&&<div className="label-result"><p className="hint">识别原文：{suggestion.labelText||"未读到清晰文字"}</p><p>成分建议：{suggestion.composition||"无法确定"}</p><button type="button" disabled={!suggestion.composition} onClick={()=>change({...value,material:suggestion.composition??undefined,labelText:suggestion.labelText,materialSource:"label",materialConfirmed:false})}>填入待确认材质</button></div>}
    <p role="status" className="hint">{busy?"正在读取标签…":message}</p><label>材质成分（可手填）<input maxLength={300} value={value.material??""} placeholder="例如：棉 80%，聚酯纤维 20%" onChange={e=>change({...value,material:e.target.value,materialSource:"manual",labelText:undefined,materialConfirmed:false})}/></label><label className="check-row"><input type="checkbox" disabled={!value.material?.trim()} checked={!!value.material?.trim()&&!!value.materialConfirmed} onChange={e=>change({...value,materialConfirmed:e.target.checked})}/>材质已核对标签或商品说明</label>
  </details>;
}
