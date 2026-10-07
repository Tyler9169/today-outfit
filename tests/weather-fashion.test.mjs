import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {summarizeWeather,forecastSchema,forecastUrl,weatherJson}=await loadTs('../lib/weather.ts');
const {freshState,stateSchema}=await loadTs('../lib/app-state.ts');
const {fashionScore,profileSchema,ageGroups}=await loadTs('../lib/fashion.ts');
const {recommend}=await loadTs('../lib/recommend.ts');
const {attributesSchema,mergeBackupState}=await loadTs('../lib/backup.ts');
const {recognize}=await loadTs('../lib/vision.ts');
const now=Date.UTC(2026,9,7,2,20),start=Math.floor(now/3600000)*3600;
const weather={timezone:'Asia/Shanghai',hourly:{time:Array.from({length:12},(_,i)=>start+i*3600),apparent_temperature:[18,19,22,24,25,26,26,26,25,24,22,20],precipitation_probability:Array(12).fill(45),wind_speed_10m:Array(12).fill(12)}};
test('forecast selects actual period and timezone; incomplete and corrupt values rejected',()=>{
  const w=summarizeWeather(weather,6,'测试城市',now);
  assert.equal(w.low,18);assert.equal(w.high,26);assert.equal(w.start,start);assert.equal(w.end,start+21600);assert.equal(w.rainProbability,45);
  assert.throws(()=>summarizeWeather(weather,2,'测试',now));
  assert.throws(()=>summarizeWeather({...weather,hourly:{...weather.hourly,time:[]}},6,'测试',now));
  assert.throws(()=>summarizeWeather({...weather,hourly:{...weather.hourly,apparent_temperature:[null]}},6,'测试',now));
  assert.throws(()=>summarizeWeather({...weather,hourly:{...weather.hourly,precipitation_probability:Array(12).fill(101)}},6,'测试',now));
  assert.equal(forecastSchema.safeParse({...weather,timezone:'not/a/timezone'}).success,false);
  const url=new URL(forecastUrl(30.274123,120.155123));assert.equal(url.searchParams.get('latitude'),'30.27');assert.equal(url.searchParams.get('longitude'),'120.16');
});
test('weather failure and cancellation remain errors for manual fallback',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response('',{status:500});await assert.rejects(weatherJson('https://example.com',new AbortController().signal));
 globalThis.fetch=async(_,options)=>{options.signal.throwIfAborted();};await assert.rejects(weatherJson('https://example.com',AbortSignal.abort()),{name:'AbortError'});
 }finally{globalThis.fetch=original;}
});
const profile=profileSchema.parse({style:'通勤',fit:'合身',inspiration:'柔和通勤'});
const top={id:'top',category:'上衣',color:'红色',attributes:{confirmed:false,style:'通勤',fit:'合身',featuresConfirmed:false}};
test('unconfirmed features do not score; chosen style scores; age never excludes or ranks clothes',()=>{
 assert.equal(fashionScore(top,[],profile),0);
 const confirmed={...top,attributes:{...top.attributes,featuresConfirmed:true}};
 assert.equal(fashionScore(confirmed,[],profile),9);
 for(const age of ageGroups)assert.equal(fashionScore(confirmed,[],{...profile,age}),9);
 const clothes=[confirmed,{id:'neutral',category:'上衣',color:'白色'},{id:'pants',category:'裤子',color:'黑色'},{id:'shoes',category:'鞋子',color:'白色'}];
 const conditions={temperature:22,scenes:['通勤'],rain:false,location:'室外'};
 assert.equal(recommend(clothes,{...freshState(),profile},conditions).selected.上衣,'top');
 confirmed.attributes={...confirmed.attributes,confirmed:true,minTemp:0,maxTemp:10};
 assert.equal(recommend(clothes,{...freshState(),profile},conditions).selected.上衣,'neutral');
 assert.match(recommend(clothes,{...freshState(),profile,locked:{上衣:'top'}},conditions).reason,/超出/);
});
test('old state defaults and new profile/material survive backup schema and replacement',()=>{
 assert.equal(stateSchema.parse({selected:{}}).profile.age,'不填写');
 const attributes={confirmed:false,featuresConfirmed:true,fit:'宽松',pattern:'条纹',material:'棉80%，聚酯纤维20%',materialSource:'label',materialConfirmed:true,labelText:'棉 80% 聚酯纤维20%'};
 assert.deepEqual(attributesSchema.parse(attributes),attributes);
 const current=freshState(),incoming={...freshState(),profile};
 assert.deepEqual(mergeBackupState(current,incoming,{},true).profile,profile);
 assert.deepEqual(mergeBackupState(current,incoming,{},false).profile,current.profile);
});
test('photo feature and label responses validate separately; unknown material cannot become truth',async()=>{
 const original=globalThis.fetch;const config={key:'test',url:'https://example.com',model:'test'};
 try{
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({category:'上衣',color:'白色',features:{fit:'宽松',style:'通勤',material:'silk'}})}}]});
 const garment=await recognize('photo',config);assert.deepEqual(garment.features,{fit:'宽松',style:'通勤'});
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({labelText:'字迹不清',composition:null})}}]});
 assert.equal((await recognize('photo',config,undefined,'label')).composition,null);
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'{"composition":"棉"}'}}]});
 await assert.rejects(recognize('photo',config,undefined,'label'),{status:502});
 }finally{globalThis.fetch=original;}
});
test('full outfit keeps temperature-suitable current clothes over an unsuitable alternative',()=>{
 const current={...top,attributes:{confirmed:true,minTemp:18,maxTemp:30}};
 const cold={...top,id:'cold',attributes:{confirmed:true,minTemp:0,maxTemp:12,featuresConfirmed:true,style:'通勤',fit:'合身'}};
 const items=[current,cold,{id:'pants',category:'裤子',color:'黑色'},{id:'shoes',category:'鞋子',color:'白色'}];
 assert.equal(recommend(items,{...freshState(),profile,selected:{上衣:'top'}},{temperature:22,scenes:['通勤'],rain:false,location:'室外'}).selected.上衣,'top');
});
