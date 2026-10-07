"use client";
import { useState } from "react";
import { Shirt, UserRound, Cat, Flower2, Sun, Moon } from "lucide-react";
export const avatarIcons = [UserRound, Cat, Flower2, Sun, Moon];
export type Person = { name: string; avatar: number };
export const personKey = "wardrobe-personal-entry-v1";
export const entrySessionKey = "wardrobe-entry-session-v1";
export function readPerson(): Person | null {
  try { const p=JSON.parse(localStorage.getItem(personKey)??"null"); return p && typeof p.name==="string" && p.name.trim() && p.name.length<=24 && Number.isInteger(p.avatar) && p.avatar>=0 && p.avatar<avatarIcons.length ? p : null; } catch { return null; }
}
export function Avatar({person}:{person:Person}) { const Icon=avatarIcons[person.avatar]??UserRound; return <span className={`person-avatar avatar-${person.avatar}`}><Icon aria-hidden="true" size={25}/></span>; }
export function PersonalEntry({initial,enter,editing=false}:{initial:Person|null;enter:(person:Person)=>void;editing?:boolean}) {
  const [name,setName]=useState(initial?.name??""),[avatar,setAvatar]=useState(initial?.avatar??0),[error,setError]=useState("");
  return <div className={editing?"profile-editor":"entry-screen"}><form className="entry-card" onSubmit={e=>{e.preventDefault();if(!name.trim()){setError("先告诉我怎么称呼你。");return;}enter({name:name.trim(),avatar});}}>
    {!editing&&<div className="entry-brand"><Shirt size={28} aria-hidden="true"/><span>今天穿什么</span></div>}
    <h1>{editing?"我的个人资料":"从今天，穿得像自己。"}</h1><p className="entry-subtitle">{editing?"换一个称呼，或一个新头像。":"给自己选个头像，我们就开始。"}</p>
    <fieldset><legend>选择头像</legend><div className="avatar-options">{avatarIcons.map((Icon,index)=><button type="button" aria-label={`头像${["人物","小猫","花朵","太阳","月亮"][index]}`} aria-pressed={avatar===index} key={index} onClick={()=>setAvatar(index)}><span className={`person-avatar avatar-${index}`}><Icon aria-hidden="true" size={27}/></span></button>)}</div></fieldset>
    <label>怎么称呼你<input autoComplete="nickname" maxLength={24} value={name} placeholder="你的昵称" onChange={e=>{setName(e.target.value);setError("");}} required/></label>
    {error&&<p role="alert" className="error">{error}</p>}<button type="submit" className="primary entry-submit">{editing?"保存个人资料":"进入我的衣橱"}</button>
    <p className="hint entry-note">无需密码的个人入口。昵称不会创建账号；这台浏览器中的衣橱保持不变。</p>
  </form></div>;
}
