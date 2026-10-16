import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
const compile=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8').replace(/^import .*;\s*$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function budget(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_shocking_harpoon.sql',import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)},async run(){return sql.prepare(query).run(...args)}}}}}};
 const context={exports:{},crypto:webcrypto,Date};vm.createContext(context);vm.runInContext(compile('../lib/recognition-budget.ts'),context);
 return {db,sql,...context.exports};
}
test('durable quota SQL: concurrent reservations, per-minute/day/global ceilings and lease recovery',async()=>{
 const b=budget(),now=Date.now();
 try{
  const ids=await Promise.all(Array.from({length:12},()=>b.reserveRecognition(b.db,'one',now)));assert.equal(ids.filter(Boolean).length,2);
  for(const id of ids.filter(Boolean))await b.finishRecognition(b.db,id);
  for(let i=0;i<4;i++){const id=await b.reserveRecognition(b.db,'one',now);assert.ok(id);await b.finishRecognition(b.db,id)}
  assert.equal(await b.reserveRecognition(b.db,'one',now),null);
  for(let i=6;i<20;i++){const id=await b.reserveRecognition(b.db,'one',now+i*61000);assert.ok(id);await b.finishRecognition(b.db,id)}
  assert.equal(await b.reserveRecognition(b.db,'one',now+21*61000),null);
  for(let i=20;i<50;i++){const id=await b.reserveRecognition(b.db,'user-'+i,now+22*61000);assert.ok(id);await b.finishRecognition(b.db,id)}
  assert.equal(await b.reserveRecognition(b.db,'extra',now+23*61000),null);
  b.sql.exec('DELETE FROM recognition_requests');
  assert.ok(await b.reserveRecognition(b.db,'a',now));assert.ok(await b.reserveRecognition(b.db,'b',now));assert.equal(await b.reserveRecognition(b.db,'c',now),null);assert.ok(await b.reserveRecognition(b.db,'c',now+90001));
 }finally{b.sql.close()}
});
test('route rejects anonymous and failed quota service before model; releases quota after failure',async()=>{
 const b=budget();let user=null,calls=0,fail=false;
 const context={exports:{},env:{DB:b.db,VISION_API_KEY:'fixture',VISION_API_URL:'https://example.invalid',VISION_MODEL:'fixture'},Response,TextDecoder,URL,getChatGPTUser:async()=>user,VisionError:class extends Error{},reserveRecognition:b.reserveRecognition,finishRecognition:b.finishRecognition,recognize:async()=>{calls++;if(fail)throw Error('fixture');return {ok:true}}};
 vm.createContext(context);vm.runInContext(compile('../app/api/recognize/route.ts'),context);
 const request=(origin)=>new Request('https://test.invalid/api/recognize',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({image:'data:image/jpeg;base64,YQ=='})});
 try{
  const anonymous=await Promise.all(Array.from({length:12},()=>context.exports.POST(request())));assert.ok(anonymous.every(r=>r.status===401));assert.equal(calls,0);
  user={userId:'fixture-owner'};assert.equal((await context.exports.POST(request('https://evil.invalid'))).status,403);
  assert.equal((await context.exports.POST(request())).status,200);assert.equal(calls,1);
  fail=true;assert.equal((await context.exports.POST(request())).status,502);assert.equal(b.sql.prepare('SELECT COUNT(*) n FROM recognition_requests WHERE finished=0').get().n,0);
  context.env.DB={prepare(){throw Error('offline')}};assert.equal((await context.exports.POST(request())).status,503);assert.equal(calls,2);
 }finally{b.sql.close()}
});
