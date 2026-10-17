import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {createTranscriber,decodeAudioBody,MAX_AUDIO_BYTES,runSpeechProcess} from '../server/transcriber.mjs';
import {createApp} from '../server/http.mjs';
import {createExtractor} from '../server/extractor.mjs';
const payload={audio:Buffer.from('isolated audio transport fixture').toString('base64'),mimeType:'audio/webm;codecs=opus'};
const result={text:'Hasil transport uji',durationSeconds:2,model:'whisper-tiny',pretrained:true};
const ready={verifyFiles:async()=>{},runner:async(_,{check}={})=>check?{ready:true}:result};

test('audio transport validates MIME, canonical base64 and byte limits without trusting a file path',()=>{
  assert.equal(decodeAudioBody(payload).toString(),'isolated audio transport fixture');
  for(const body of [{...payload,mimeType:'video/mp4'},{...payload,audio:'file:///x'},{...payload,audio:'Zg=='+'\n'},{...payload,audio:'Zh=='},{...payload,audio:''},{...payload,audio:Buffer.alloc(MAX_AUDIO_BYTES+1).toString('base64')}])assert.throws(()=>decodeAudioBody(body));
  assert.equal(decodeAudioBody({...payload,audio:Buffer.alloc(MAX_AUDIO_BYTES).toString('base64')}).length,MAX_AUDIO_BYTES);
});

test('missing, disabled or damaged speech model reports unavailable and never returns an invented transcript',async()=>{
  for(const engine of [createTranscriber({disabled:true}),createTranscriber({...ready,verifyFiles:async()=>{throw Error('checksum');}})]){
    assert.equal((await engine.status()).available,false);await assert.rejects(engine.transcribe(payload),e=>e.status===503);
  }
});

test('local transcription admits one CPU task at a time and releases its gate after failure',async()=>{
  let rejectRun,calls=0;const engine=createTranscriber({...ready,runner:async(_,{check})=>{if(check)return {ready:true};calls++;return new Promise((_,reject)=>rejectRun=reject);}});
  await engine.status();const first=engine.transcribe(payload);await new Promise(r=>setImmediate(r));
  await assert.rejects(engine.transcribe(payload),e=>e.status===429);assert.equal(calls,1);rejectRun(Error('isolated failure'));await assert.rejects(first,/isolated failure/);
  const next=engine.transcribe(payload);await new Promise(r=>setImmediate(r));assert.equal(calls,2);rejectRun(Error('second failure'));await assert.rejects(next,/second failure/);
});

function processFixture(){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kills=0;child.kill=()=>{child.kills++;};return child;}
test('speech child timeout, browser cancellation and bounded output terminate subprocesses',async()=>{
  const slow=processFixture();await assert.rejects(runSpeechProcess(Buffer.from('x'),{spawnProcess:()=>slow,timeoutMs:15}),e=>e.status===504);assert.equal(slow.kills,1);
  const cancelled=processFixture(),controller=new AbortController();const pending=runSpeechProcess(Buffer.from('x'),{spawnProcess:()=>cancelled,signal:controller.signal});controller.abort();await assert.rejects(pending,e=>e.status===499);assert.equal(cancelled.kills,1);
  const huge=processFixture();const large=runSpeechProcess(Buffer.from('x'),{spawnProcess:()=>huge});huge.stdout.write('x'.repeat(17000));await assert.rejects(large,e=>e.status===503);assert.equal(huge.kills,1);
});

test('speech child propagates silence/invalid audio safely and rejects malformed model output',async()=>{
  for(const [output,status] of [[JSON.stringify({error:'no_speech'}),422],['not JSON',503],[JSON.stringify({...result,text:''}),503],[JSON.stringify({...result,durationSeconds:31}),503]]){
    const child=processFixture(),pending=runSpeechProcess(Buffer.from('x'),{spawnProcess:()=>child});child.stdout.end(output);child.emit('close',0);await assert.rejects(pending,e=>e.status===status);
  }
  const child=processFixture(),pending=runSpeechProcess(Buffer.from('x'),{spawnProcess:()=>child});child.stdout.end(JSON.stringify(result));child.emit('close',0);assert.deepEqual(await pending,result);
});

test('speech API requires login, same origin and CSRF before inference; large bodies cannot widen other API limits',async t=>{
  let calls=0;const app=createApp({filename:':memory:',extractor:createExtractor({provider:'rules'}),transcriber:createTranscriber({...ready,runner:async(_,{check})=>check?{ready:true}:(calls++,result)})});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  async function post(url,body,headers={}){return fetch(base+url,{method:'POST',headers:{'content-type':'application/json',origin:base,...headers},body:JSON.stringify(body)});}
  assert.equal((await post('/api/transcriptions',payload)).status,401);
  const registration=await post('/api/auth/register',{email:randomUUID()+'@example.test',password:'A-long-voice-test-password',businessName:'Usaha uji suara',communityName:'Kelompok uji'});
  assert.equal(registration.status,201);const cookie=registration.headers.get('set-cookie').split(';')[0],state=await registration.json();
  assert.equal((await post('/api/transcriptions',payload,{cookie})).status,403);
  assert.equal((await post('/api/transcriptions',{...payload,csrf:state.csrf},{cookie,origin:'https://other.test'})).status,403);
  assert.equal(calls,0);
  assert.equal((await post('/api/transcriptions',{...payload,csrf:state.csrf,audio:'x'.repeat(1405000)},{cookie})).status,413);
  assert.equal((await post('/api/extractions',{text:'x'.repeat(66000),csrf:state.csrf},{cookie})).status,413);assert.equal(calls,0);
  const tables=app.store.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'ai_usage_events' ORDER BY name").map(x=>x.name);
  const snapshot=()=>tables.map(name=>app.store.all('SELECT * FROM "'+name+'"'));
  const before=snapshot();const response=await post('/api/transcriptions',{...payload,csrf:state.csrf},{cookie});assert.equal(response.status,200);assert.deepEqual(await response.json(),result);assert.equal(calls,1);assert.deepEqual(snapshot(),before);assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ai_usage_events WHERE feature='speech' AND status='succeeded'").n,1);
});

test('model status is checked once and never downloads during inference',async()=>{
  let checks=0,verifies=0;const engine=createTranscriber({verifyFiles:async()=>{verifies++;},runner:async(_,{check})=>check?(checks++,{ready:true}):result});
  const statuses=await Promise.all([engine.status(),engine.status()]);assert.equal(statuses[0].available,true);assert.equal(checks,1);assert.equal(verifies,1);assert.deepEqual(await engine.transcribe(payload),result);assert.equal(checks,1);
});
