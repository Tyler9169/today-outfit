import { z } from "zod";
const series = z.array(z.number().finite().nullable());
export const forecastSchema = z.object({ timezone: z.string().refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}}, "无效时区"), hourly: z.object({ time:z.array(z.number().finite()), apparent_temperature:series, precipitation_probability:series, wind_speed_10m:series }) });
export type Forecast = z.infer<typeof forecastSchema>;
export type WeatherSummary = { low:number; high:number; rainProbability:number; wind:number; start:number; end:number; timezone:string; fetchedAt:number; place:string };
export function summarizeWeather(data: Forecast, hours: number, place:string, now=Date.now()): WeatherSummary {
  if(![3,6,12].includes(hours)) throw new Error("不支持的预报时段");
  const indexes=data.hourly.time.map((time,i)=>({time,i})).filter(x=>x.time>=Math.floor(now/3600000)*3600 && x.time<now/1000+hours*3600).slice(0,hours);
  if(indexes.length<hours) throw new Error("预报时段不完整，请稍后重试或手动填写天气。");
  const values=(key:"apparent_temperature"|"precipitation_probability"|"wind_speed_10m")=>indexes.map(({i})=>data.hourly[key][i]);
  const temperatures=values("apparent_temperature"), rain=values("precipitation_probability"), wind=values("wind_speed_10m");
  if([...temperatures,...rain,...wind].some(n=>n===null||n===undefined||!Number.isFinite(n))) throw new Error("天气数据缺失，请手动填写。");
  if((rain as number[]).some(n=>n<0||n>100)||(wind as number[]).some(n=>n<0)||indexes.some((x,i)=>i>0&&x.time-indexes[i-1].time!==3600)) throw new Error("天气数据异常，请手动填写。");
  return {low:Math.round(Math.min(...temperatures as number[])),high:Math.round(Math.max(...temperatures as number[])),rainProbability:Math.max(...rain as number[]),wind:Math.max(...wind as number[]),start:indexes[0].time,end:indexes.at(-1)!.time+3600,timezone:data.timezone,fetchedAt:now,place};
}
export const citiesSchema=z.object({results:z.array(z.object({id:z.number(),name:z.string(),latitude:z.number(),longitude:z.number(),country:z.string().optional(),admin1:z.string().optional()})).optional()});
export type City=NonNullable<z.infer<typeof citiesSchema>["results"]>[number];
export async function weatherJson(url:string, signal:AbortSignal) {
  const controller=new AbortController(), cancel=()=>controller.abort();
  signal.addEventListener("abort",cancel,{once:true}); if(signal.aborted) cancel();
  const timer=setTimeout(cancel,15000);
  try {const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error("天气服务暂不可用，请稍后重试或手动填写。");return await response.json();}
  finally {clearTimeout(timer);signal.removeEventListener("abort",cancel);}
}
export function forecastUrl(lat:number,lon:number) {
  // City-scale precision; exact device coordinates are never persisted or sent.
  const params=new URLSearchParams({latitude:lat.toFixed(2),longitude:lon.toFixed(2),hourly:"apparent_temperature,precipitation_probability,wind_speed_10m",forecast_days:"2",timezone:"auto",timeformat:"unixtime"});
  return "https://api.open-meteo.com/v1/forecast?"+params;
}
