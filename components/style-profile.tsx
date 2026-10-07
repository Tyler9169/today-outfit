"use client";
import { ageGroups, ageNotes, trendSource, type StyleProfile } from "@/lib/fashion";
import { fits, styles } from "@/lib/clothing-features";
export function StyleProfileFields({value,change,disabled}:{value:StyleProfile;change:(value:StyleProfile)=>void;disabled:boolean}) {
  return <details className="style-profile"><summary>我的风格与穿着需求</summary><fieldset disabled={disabled}><div className="field-grid">
    <label>年龄段（可选）<select value={value.age} onChange={e=>change({...value,age:e.target.value as StyleProfile["age"]})}>{ageGroups.map(s=><option key={s}>{s}</option>)}</select></label>
    <label>喜欢的风格<select value={value.style} onChange={e=>change({...value,style:e.target.value as StyleProfile["style"]})}>{["不限",...styles].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>喜欢的版型<select value={value.fit} onChange={e=>change({...value,fit:e.target.value as StyleProfile["fit"]})}>{["不限",...fits].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>穿着需求<select value={value.priority} onChange={e=>change({...value,priority:e.target.value as StyleProfile["priority"]})}>{["均衡","行走舒适","通勤整洁"].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>本次搭配灵感<select value={value.inspiration} onChange={e=>change({...value,inspiration:e.target.value as StyleProfile["inspiration"]})}>{["日常基础","柔和通勤","比例对比"].map(s=><option key={s}>{s}</option>)}</select></label>
  </div></fieldset><p className="hint">{ageNotes[value.age]} 年龄只调整提示，不筛掉任何衣服；以上选项均可自行选择。设置保存在当前浏览器，并随备份迁移。</p><p className="hint">趋势资料核对于 {trendSource.checkedAt}：<a href={trendSource.url} target="_blank" rel="noreferrer">{trendSource.title}</a>。柔和剪裁、比例变化和叠穿来自该季秀场观察；这里转化为适合现有衣橱的可选规则，不代表所有人或所有气候。不是实时趋势服务或自动训练模型。</p></details>;
}
