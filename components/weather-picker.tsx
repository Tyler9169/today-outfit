"use client";
import { useEffect, useRef, useState } from "react";
import { citiesSchema, forecastSchema, forecastUrl, summarizeWeather, weatherJson, type City, type Forecast, type WeatherSummary } from "@/lib/weather";
export function WeatherPicker({apply,disabled}:{apply:(summary:WeatherSummary)=>void;disabled:boolean}) {
  const [query,setQuery]=useState(""),[cities,setCities]=useState<City[]>([]),[hours,setHours]=useState(6);
  const [data,setData]=useState<{forecast:Forecast;place:string;fetchedAt:number}|null>(null);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  function begin(){active.current?.abort();const c=new AbortController();active.current=c;setBusy(true);setMessage("");setData(null);return c;}
  async function getForecast(lat:number,lon:number,place:string,c:AbortController){
    try {const forecast=forecastSchema.parse(await weatherJson(forecastUrl(lat,lon),c.signal)); if(c.signal.aborted)return;setData({forecast,place,fetchedAt:Date.now()});setCities([]);setMessage("天气已获取，核对后点击应用。");}
    catch {if(!c.signal.aborted)setMessage("天气获取失败，可重新尝试或继续手动填写气温和雨天。");}
    finally {if(!c.signal.aborted)setBusy(false);}
  }
  function locate(){const c=begin();if(!navigator.geolocation){setBusy(false);setMessage("浏览器不支持定位，请搜索城市。");return;}
    navigator.geolocation.getCurrentPosition(p=>{if(!c.signal.aborted)void getForecast(p.coords.latitude,p.coords.longitude,"当前位置附近",c);},()=>{if(!c.signal.aborted){setBusy(false);setMessage("未获得位置，请允许浏览器定位或搜索城市。");}},{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
  }
  async function search(){if(query.trim().length<2){setMessage("请填写至少两个字的城市名。");return;}const c=begin();setCities([]);
    try {const result=citiesSchema.parse(await weatherJson("https://geocoding-api.open-meteo.com/v1/search?"+new URLSearchParams({name:query.trim(),count:"5",language:"zh",format:"json"}),c.signal));if(!c.signal.aborted){setCities(result.results??[]);setMessage(result.results?.length?"请选择所在城市。":"没有找到城市，请尝试拼音或其他城市名。");}}
    catch {if(!c.signal.aborted)setMessage("城市搜索暂不可用，请稍后重试或手动填写天气。");}finally{if(!c.signal.aborted)setBusy(false);}
  }
  let summary:WeatherSummary|undefined;try{if(data)summary={...summarizeWeather(data.forecast,hours,data.place),fetchedAt:data.fetchedAt};}catch{}
  const time=(n:number)=>new Intl.DateTimeFormat("zh-CN",{timeZone:summary?.timezone,hour:"2-digit",minute:"2-digit"}).format(n*1000);
  return <details className="weather-picker" open><summary>按所在地天气搭配</summary><p className="hint">点击定位后，将城市级近似坐标发送给 Open-Meteo 获取预报；不保存位置。也可搜索城市。</p><fieldset disabled={disabled||busy}><div className="action-row"><button type="button" onClick={locate}>使用当前位置</button><label>出门时段<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={3}>未来 3 小时</option><option value={6}>未来 6 小时</option><option value={12}>未来 12 小时</option></select></label></div><div className="city-search"><label>城市<input value={query} maxLength={80} placeholder="如：杭州 / Hangzhou" onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void search();}}}/></label><button type="button" onClick={()=>void search()}>搜索城市</button></div><div className="action-row">{cities.map(city=><button key={city.id} onClick={()=>void getForecast(city.latitude,city.longitude,[city.name,city.admin1,city.country].filter(Boolean).join(" · "),begin())}>{[city.name,city.admin1,city.country].filter(Boolean).join(" · ")}</button>)}</div>
    {summary&&<div className="weather-summary"><p>{summary.place} · {time(summary.start)}–{time(summary.end)}（当地时间）</p><p>体感 {summary.low}–{summary.high}℃ · 最高降雨概率 {summary.rainProbability}% · 最大风速 {summary.wind} km/h</p><p className="hint">获取于 {new Date(summary.fetchedAt).toLocaleTimeString("zh-CN")}。按较冷时段搭配；降雨概率 ≥40% 按雨天考虑。</p><button onClick={()=>{if(!summary)return;if(Date.now()-summary.fetchedAt>30*60*1000){setMessage("预报已超过30分钟，请重新获取。");return;}apply(summary);setMessage("已应用天气；手动修改气温或雨天将切回手动条件。");}}>应用天气到推荐</button></div>}
    </fieldset><p role="status" className="hint">{busy?"正在获取…":message}{data&&!summary?" 预报时段数据不完整，请重新获取。":""}</p><a className="hint" href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据：Open-Meteo</a></details>;
}
