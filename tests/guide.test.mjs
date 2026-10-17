import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_TOPICS,PAGE_TOPICS,findTopic,guideHelpHTML,GUIDE_VERSION} from '../public/guide-content.js';
import {guideKey,emptyGuideProgress,validateGuideProgress,readGuideProgress,writeGuideProgress} from '../public/guide-state.js';
import {guideLayout} from '../public/guide-layout.js';

test('every shipped page has a short replayable guide, with unique topics/steps and actual route targets',()=>{
  const routes=new Set(['dapur','layanan','ringkasan','stok','pesanan','restock','kelompok','staf','riwayat','pengaturan','panduan']);
  assert.deepEqual(new Set(Object.keys(PAGE_TOPICS)),routes);
  assert.equal(new Set(GUIDE_TOPICS.map(t=>t.id)).size,GUIDE_TOPICS.length);
  for(const topic of GUIDE_TOPICS){
    assert.ok(topic.title&&topic.description);assert.ok(topic.steps.length>=3&&topic.steps.length<=(topic.id==='mulai'?11:7));
    assert.equal(new Set(topic.steps.map(s=>s.id)).size,topic.steps.length);
    for(const step of topic.steps){assert.ok(step.title&&step.text);assert.ok(step.route===null||routes.has(step.route));assert.equal(typeof step.target,'string');for(const control of step.controls)assert.ok(control.length===2&&control.every(Boolean));}
  }
  assert.ok(Object.values(PAGE_TOPICS).every(id=>findTopic(id)));
});

test('all named application actions have a documented topic, including conditional stock/voice/group actions',()=>{
  const source=readFileSync('public/live-views.js','utf8')+readFileSync('public/app.js','utf8');
  const documented=new Set(GUIDE_TOPICS.flatMap(t=>t.actions));
  const actions=new Set([...source.matchAll(/button\('([a-z-]+)'/g),...source.matchAll(/(?<![.\w])action==='([a-z-]+)'/g)].map(m=>m[1]));
  const missing=[...actions].filter(action=>!documented.has(action));assert.deepEqual(missing,[],'Application actions need guide coverage');
  for(const label of ['Simpan bahan','Simpan barang masuk','Simpan menu dan resep','Susun rincian pesanan','Bagikan / perbarui kebutuhan','Simpan penawaran pemasok','Catat penerimaan bagianku','Terbitkan tawaran','Minta transfer','Konfirmasi pembatalan','Simpan kata sandi baru','Ganti kode undangan'])
    assert.ok(JSON.stringify(GUIDE_TOPICS).includes(label),label);
});

test('storage preserves only validated progress fields and separates guest/account/epoch keys',()=>{
  const values=new Map(),storage=()=>({getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)});
  const progress={version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'menu',step:1,autoPageGuides:true,seenPages:['dapur','stok','<script>'],password:'must not persist',businessName:'must not persist'};
  assert.equal(writeGuideProgress(storage,'workspace:epoch:owner',progress),true);
  assert.deepEqual(readGuideProgress(storage,'workspace:epoch:owner').progress,{version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'menu',step:1,autoPageGuides:true,seenPages:['dapur','stok']});
  assert.deepEqual(readGuideProgress(storage,'workspace:epoch:member').progress,emptyGuideProgress());
  assert.notEqual(guideKey('guest'),guideKey('workspace:epoch:owner'));assert.notEqual(guideKey('workspace:epoch:owner'),guideKey('workspace:new-epoch:owner'));
  assert.equal([...values.values()][0].includes('must not persist'),false);
});

test('corrupt, unknown and out-of-range saved progress never drives navigation or injection',()=>{
  for(const value of [null,[],{}, {version:99}, {version:GUIDE_VERSION,welcomeSeen:'true',status:'paused'},
    {version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'<script>',step:0},
    {version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'menu',step:99},
    {version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'menu',step:-1},
    {version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'menu',step:0.5},
    {version:GUIDE_VERSION,welcomeSeen:true,status:'paused',topicId:'menu',step:0,autoPageGuides:'yes',seenPages:[]}])assert.deepEqual(validateGuideProgress(value),emptyGuideProgress());
  assert.deepEqual(readGuideProgress(()=>({getItem:()=>'{broken'}),'guest').progress,emptyGuideProgress());
});

test('storage refusals are recoverable and all guide completion states round-trip',()=>{
  const denied=()=>{throw new Error('Storage blocked');};
  assert.equal(readGuideProgress(denied,'guest').available,false);assert.equal(writeGuideProgress(denied,'guest',emptyGuideProgress()),false);
  for(const status of ['in_progress','paused','skipped','completed']){
    const value={version:GUIDE_VERSION,welcomeSeen:true,status,topicId:'mulai',step:2,autoPageGuides:false,seenPages:[]};assert.deepEqual(validateGuideProgress(value),value);
  }
});

test('help catalogue and offline shell expose the complete guide without remote libraries',()=>{
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const html=guideHelpHTML(escape);assert.equal((html.match(/data-guide-result=/g)||[]).length,GUIDE_TOPICS.length);
  assert.match(html,/Cari fitur atau tombol/);assert.match(html,/fitur usaha dibuka setelah masuk/);
  const shell=readFileSync('public/sw.js','utf8');for(const name of ['guide.js','guide-state.js','guide-content.js','guide-layout.js'])assert.ok(shell.includes('/'+name));
  const controller=readFileSync('public/guide.js','utf8');assert.doesNotMatch(controller,/fetch\(|\.request\(|requestSubmit\(|\.submit\(|\.click\(/);
});

test('callout stays outside the spotlight and arrow endpoints stay on the actual visible target',()=>{
  for(const [viewport,target] of [
    [{width:1440,height:1000},{left:280,top:140,right:440,bottom:184}],
    [{width:1440,height:1000},{left:1200,top:20,right:1240,bottom:64}],
    [{width:320,height:900},{left:16,top:120,right:304,bottom:164}],
    [{width:320,height:900},{left:16,top:650,right:304,bottom:694}],
    [{width:320,height:900},{left:0,top:830,right:320,bottom:900}]
  ]){
    const result=guideLayout(target,{width:400,height:340},{...viewport,topInset:82,bottomInset:88});
    assert.ok(result.arrow);assert.ok(result.x>=0&&result.x+result.width<=viewport.width);
    const h=Math.min(340,result.maxHeight);assert.ok(result.y>=82&&result.y+h<=viewport.height-88);
    const p={left:result.x,right:result.x+result.width,top:result.y,bottom:result.y+h};
    assert.equal(p.left<target.right&&p.right>target.left&&p.top<target.bottom&&p.bottom>target.top,false);
    assert.ok(result.arrow.end.x>=target.left-6&&result.arrow.end.x<=target.right+6);
    assert.ok(result.arrow.end.y>=target.top-6&&result.arrow.end.y<=target.bottom+6);
    assert.equal(result.arrow.d.includes('NaN'),false);
  }
});

test('missing/offscreen targets never get a fabricated arrow and old progress is safely distinguished',()=>{
  for(const target of [null,{left:0,top:-100,right:100,bottom:-10},{left:0,top:1000,right:100,bottom:1200}]){
    const result=guideLayout(target,{width:400,height:340},{width:320,height:900});assert.equal(result.arrow,null);assert.equal(result.focus,null);assert.ok(result.width<=296);
  }
  assert.deepEqual(validateGuideProgress({version:1,welcomeSeen:true,status:'completed',topicId:'mulai',step:2}),emptyGuideProgress());
  assert.equal(findTopic('mulai').steps[0].title,'Selamat datang di Gerai Kita');
});
