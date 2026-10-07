import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { loadTs } from './load-ts.mjs';
const { freshState, reconcileState } = await loadTs('../lib/app-state.ts');
const { recommend } = await loadTs('../lib/recommend.ts');
const { mergeBackup, mergeBackupState } = await loadTs('../lib/backup.ts');
const { commitWardrobe, getClothes, readMeta, importClothes } = await loadTs('../lib/wardrobe.ts');
const item = (id, category, color='白色', extra={}) => ({id,category,color,photo:new Blob(['photo-'+id],{type:'image/png'}),createdAt:1,...extra});
const clothes=[item('top','上衣'),item('pants','裤子'),item('shoes','鞋子'),item('top2','上衣','黑色')];
const conditions={temperature:22,scenes:['日常'],rain:false,location:'室内'};
test('partial replacement preserves other slots and locks; dirty clothes excluded',()=>{
  const state={...freshState(), selected:{上衣:'top',裤子:'pants',鞋子:'shoes'},locked:{裤子:'pants'}};
  const r=recommend(clothes,state,conditions,'上衣');
  assert.deepEqual(r.selected,{上衣:'top2',裤子:'pants',鞋子:'shoes'});
  assert.equal(recommend(clothes,state,conditions,'裤子').complete,false);
  assert.match(recommend(clothes.map(i=>i.id==='pants'?{...i,dirty:true}:i),state,conditions).reason,/缺少可穿的裤子/);
  assert.match(recommend(clothes,state,conditions,'鞋子').reason,/没有其他/);
});
test('only confirmed attributes affect ranking; missing categories remain explicit',()=>{
  const base=clothes.slice(0,3), preferred=item('other','上衣','红色',{attributes:{confirmed:false,scenes:['日常'],minTemp:10,maxTemp:30}});
  assert.equal(recommend([...base,preferred],freshState(),conditions).selected.上衣,'top');
  preferred.attributes.confirmed=true;
  assert.equal(recommend([...base,preferred],freshState(),conditions).selected.上衣,'other');
  assert.equal(recommend([],freshState(),conditions).complete,false);
});
test('merge deduplicates, remaps conflicting IDs, and retains current favorites',async()=>{
  const incoming=clothes.map(i=>i.id==='top'?{...i,color:'蓝色'}:i);
  const plan=await mergeBackup(clothes,incoming);
  assert.equal(plan.conflicts,1);assert.equal(plan.duplicates,3);assert.equal(plan.additions.length,1);
  assert.notEqual(plan.idMap.top,'top');
  const current={...freshState(),favorites:[['top','pants','shoes']]};
  const merged=mergeBackupState(current,{...freshState(),favorites:[['top','pants','shoes']],selected:{上衣:'top'}},plan.idMap,false);
  assert.equal(merged.favorites.length,2);assert.ok(merged.favorites[1].includes(plan.idMap.top));
  assert.deepEqual(mergeBackupState(current,freshState(),{},true).favorites,[]);
});
test('invalidated favorites and category selections are pruned',()=>{
  const state={...freshState(),favorites:[['top','pants','shoes']],selected:{上衣:'top'},locked:{上衣:'top'}};
  assert.equal(reconcileState(state,clothes.filter(i=>i.id!=='pants')).favorites.length,0);
  const edited=clothes.map(i=>i.id==='top'?{...i,category:'外套'}:i);
  assert.deepEqual(reconcileState(state,edited).selected,{});
  assert.equal(reconcileState(state,edited).favorites.length,0);
});
test('IndexedDB commits metadata and photos; failed replacement and clone roll back',async()=>{
  const state={...freshState(),favorites:[['top','pants','shoes']]};
  await commitWardrobe([],clothes,state);
  assert.equal((await getClothes()).length,4);assert.deepEqual(await readMeta(),state);
  await assert.rejects(importClothes([clothes[0],clothes[0]],true,freshState()));
  assert.equal((await getClothes()).length,4);assert.deepEqual(await readMeta(),state);
  await assert.rejects(commitWardrobe(clothes,[],{bad:()=>{}}));
  assert.equal((await getClothes()).length,4);assert.deepEqual(await readMeta(),state);
  assert.equal(await (await getClothes()).find(i=>i.id==='top').photo.text(),'photo-top');
});
test('coat can be added in warm weather, kept on regeneration, or explicitly omitted',()=>{
  const coat=item('coat','外套'), extra=item('coat2','外套','蓝色');
  const state={...freshState(),selected:{上衣:'top',裤子:'pants',鞋子:'shoes'}};
  const added=recommend([...clothes,coat,extra],state,{...conditions,coat:'wear'},'外套');
  assert.ok(added.selected.外套);
  assert.equal(added.selected.上衣,'top');assert.equal(added.selected.裤子,'pants');assert.equal(added.selected.鞋子,'shoes');
  assert.ok(recommend([...clothes,coat],state,{...conditions,coat:'wear'}).selected.外套);
  const removed=recommend([...clothes,coat],{...state,selected:{...state.selected,外套:'coat'},locked:{外套:'coat'}},{...conditions,temperature:10,coat:'skip'});
  assert.equal(removed.selected.外套,undefined);assert.equal(removed.locked.外套,undefined);
});
