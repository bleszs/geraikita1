// Real model acceptance through HTTP. All application writes stay in SQLite memory.
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createApp} from '../server/http.mjs';
import {deploymentConfig} from '../server/deployment.mjs';
import {createExtractor} from '../server/extractor.mjs';
import {createRuntimeTranscriber} from '../server/runtime-speech.mjs';
import {MAX_AUDIO_BYTES} from '../server/transcriber.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');
const {values}=parseArgs({options:{audio:{type:'string'},report:{type:'string'},help:{type:'boolean'}}});
if(values.help){
  console.log('node scripts/verify-ai-runtime.mjs --audio PUBLIC_CLIP.wav [--report NEW_FILE.json]\nUses real configured Qwen/Whisper with a loopback-only memory database. Does not call the production website or seed its database. Exit 0 requires both real inferences; fallback is a failure.');
  process.exit(0);
}
if(!values.audio)throw Error('Supply --audio with a permitted WAV clip (maximum 1 MiB/30 seconds).');
const audio=await readFile(values.audio);
assert(audio.length>0&&audio.length<=MAX_AUDIO_BYTES,'Audio must be 1 byte to 1 MiB.');
assert(audio.subarray(0,4).toString()==='RIFF'&&audio.subarray(8,12).toString()==='WAVE','Supply a WAV clip.');
const model=process.env.OLLAMA_MODEL||'qwen2.5:1.5b';
assert.equal(model,'qwen2.5:1.5b','This acceptance run requires the approved Qwen1.5B model.');
const modelUrl=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
// Explicit local deployment avoids inheriting the production canonical Host.
// Explicit memory filename prevents DATABASE_PATH from opening business data.
const app=createApp({filename:':memory:',deployment:deploymentConfig({}),
  extractor:createExtractor({provider:'ollama',model,url:modelUrl}),transcriber:createRuntimeTranscriber()});
const report={checkedAt:new Date().toISOString(),passed:false,database:':memory:',
  scope:'Runtime acceptance on an already-seen permitted audio clip and ephemeral catalog; not an accuracy benchmark.',
  productionDatabaseOpened:false,productionBusinessDataSeeded:false,ephemeralCatalogOnly:true,model,checks:[]};
let failed=false;
async function check(name,fn){
  const started=performance.now();
  try{const detail=await fn();report.checks.push({name,passed:true,elapsedMs:Math.round(performance.now()-started),...detail});}
  catch(error){failed=true;report.checks.push({name,passed:false,elapsedMs:Math.round(performance.now()-started),reason:error.message});}
}
function snapshot(){
  const tables=app.store.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'ai_usage_events' ORDER BY name");
  return Object.fromEntries(tables.map(({name})=>[name,hash(JSON.stringify(app.store.all('SELECT * FROM "'+name.replaceAll('"','""')+'"').map(r=>JSON.stringify(r)).sort()))]));
}
try{
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+app.server.address().port;
  const request=(route,body,extra={})=>fetch(origin+route,{method:body===undefined?'GET':'POST',
    headers:{'content-type':'application/json',origin,...extra},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
  const registration=await request('/api/auth/register',{email:randomUUID()+'@example.test',password:randomUUID()+'-runtime-check',businessName:'Memory runtime check',communityName:'Memory runtime check'});
  assert.equal(registration.status,201,'Temporary registration failed.');
  const cookie=registration.headers.get('set-cookie').split(';')[0];let state=await registration.json();
  const ingredient=await request('/api/ingredients',{csrf:state.csrf,catalogRevision:state.catalogRevision,name:'Tepung uji runtime',unit:'gram',min:0,storageNote:'Memory only'},{cookie});
  assert.equal(ingredient.status,201,'Temporary ingredient setup failed.');
  state=await (await request('/api/bootstrap',undefined,{cookie})).json();
  const saved=await request('/api/menus',{csrf:state.csrf,catalogRevision:state.catalogRevision,name:'Roti uji runtime',aliases:['roti uji'],price:5000,recipe:{[state.catalog[0].id]:20},preparation:{minutes:2,passiveMinutes:0,station:'runtime'}},{cookie});
  assert.equal(saved.status,201,'Temporary menu setup failed.');
  const received=await request('/api/stock-receipts',{csrf:state.csrf,productId:state.catalog[0].id,qty:100,unitPrice:1,supplier:'Memory only',idempotencyKey:randomUUID()},{cookie});
  assert.equal(received.status,201,'Temporary stock setup failed.');
  state=await (await request('/api/bootstrap',undefined,{cookie})).json();
  const menuId=state.menu[0].id,before=snapshot();let extractedItems;

  await check('installed-model-identity',async()=>{
    const response=await fetch(modelUrl+'/api/tags',{signal:AbortSignal.timeout(5000)});
    assert.equal(response.status,200,'Ollama model inventory unavailable.');
    const entry=(await response.json()).models?.find(m=>m.name===model);
    assert(entry&&/^[a-f0-9]{64}$/.test(entry.digest),'Approved model and digest must be available.');
    return {digest:entry.digest,bytes:entry.size};
  });
  await check('both-model-health',async()=>{
    const response=await request('/api/health'),health=await response.json();assert.equal(response.status,200);
    assert.equal(health.ai.available,true,'Qwen is unavailable.');assert.equal(health.speech.available,true,'Speech is unavailable.');
    return {qwenModel:health.ai.model,speechModel:health.speech.model};
  });
  await check('authorization-and-origin',async()=>{
    const payload={text:'dua roti uji',csrf:state.csrf};
    for(const route of ['/api/extractions','/api/kitchen/extractions','/api/transcriptions']){
      for(const [body,headers,status] of [[payload,{},401],[{text:'dua roti uji'},{cookie},403],[payload,{cookie,origin:'https://other.test'},403]]){
        const response=await request(route,body,headers);await response.arrayBuffer();assert.equal(response.status,status);
      }
    }
    return {unauthenticated:401,missingCsrf:403,foreignOrigin:403,endpoints:3};
  });
  await check('authenticated-qwen-extraction',async()=>{
    const response=await request('/api/kitchen/extractions',{csrf:state.csrf,text:'dua roti uji hangat',catalogRevision:state.catalogRevision},{cookie}),result=await response.json();
    assert.equal(response.status,200,'Extraction request failed.');
    assert.equal(result.mode,'ollama','Extraction fell back to the parser; this does not prove Qwen inference.');
    assert.equal(result.model,model);assert.deepEqual(result.items.map(({id,qty})=>({id,qty})),[{id:menuId,qty:2}]);
    assert.equal(result.items[0].note,'dua roti uji hangat','Unlisted modifier must survive for human review.');
    extractedItems=result.items;
    return {httpStatus:response.status,mode:result.mode,model:result.model,itemsMatched:true,originalModifierPreservedForReview:true};
  });
  await check('authenticated-speech-inference',async()=>{
    const response=await request('/api/transcriptions',{csrf:state.csrf,mimeType:'audio/wav',audio:audio.toString('base64')},{cookie}),result=await response.json();
    assert.equal(response.status,200,'Speech request failed.');assert(typeof result.text==='string'&&result.text.trim(),'Nonempty transcript required.');
    assert(result.durationSeconds>0&&result.durationSeconds<=30);
    return {httpStatus:response.status,model:result.model,durationSeconds:result.durationSeconds,audioSha256:hash(audio),transcriptSha256:hash(result.text)};
  });
  await check('ambiguous-numeric-input-rejected-without-quota-charge',async()=>{
    let rejected=0;
    for(const route of ['/api/extractions','/api/kitchen/extractions'])for(const text of ['roti uji 2 pedas 1 burger','roti uji dua belas','-2 roti uji','roti uji 2 pedas 3']){
      const response=await request(route,{csrf:state.csrf,text,catalogRevision:state.catalogRevision},{cookie});
      assert.equal(response.status,400,'Ambiguous numeric evidence was accepted.');await response.arrayBuffer();rejected++;
    }
    assert.equal(app.store.get("SELECT COUNT(*) AS n FROM ai_usage_events WHERE feature='text'").n,1,'Rejected inputs charged or reserved quota.');
    return {rejectedRequests:rejected,additionalQuotaConsumed:0};
  });
  await check('inference-preserves-business-data-and-meters-ai',async()=>{
    assert.deepEqual(snapshot(),before,'Inference or rejected requests changed application data.');
    const usage=app.store.all("SELECT feature,status FROM ai_usage_events ORDER BY feature");
    assert.deepEqual(usage.map(r=>({...r})),[{feature:'speech',status:'succeeded'},{feature:'text',status:'succeeded'}]);
    return {tablesCompared:Object.keys(before).length,unchanged:true,successfulAiCallsRecorded:usage.length};
  });
  await check('reviewed-kitchen-order-completes-once',async()=>{
    assert(extractedItems,'Real Qwen extraction must pass first.');
    const createBody={csrf:state.csrf,label:'Memory runtime order',channel:'takeaway',items:extractedItems,catalogRevision:state.catalogRevision,idempotencyKey:randomUUID()};
    for(let i=0;i<2;i++)assert.equal((await request('/api/kitchen/orders',createBody,{cookie})).status,201);
    const read=async()=> (await request('/api/bootstrap',undefined,{cookie})).json();
    let current=await read();assert.equal(current.kitchen.orders.length,1);assert.equal(current.transactions.length,0);
    assert.equal(current.kitchen.orders[0].items[0].note,extractedItems[0].note);
    const id=current.kitchen.orders[0].id,taskId=current.kitchen.orders[0].tasks[0].id;
    for(const action of ['start','ready','complete']){
      current=await read();const revision=current.kitchen.orders.find(o=>o.id===id).revision;
      const body={csrf:state.csrf,action,revision,taskId:action==='complete'?undefined:taskId,idempotencyKey:randomUUID()};
      for(let i=0;i<2;i++)assert.equal((await request('/api/kitchen/orders/'+id+'/actions',body,{cookie})).status,200);
    }
    current=await read();assert.equal(current.transactions.length,1);assert.equal(current.stock[state.catalog[0].id],60);
    return {reviewedExplicitly:true,duplicateCreateAndActionsSafe:true,sales:1,stockConsumed:40};
  });
}catch(error){failed=true;report.checks.push({name:'setup',passed:false,reason:error.message});}
finally{await app.close();}
report.passed=!failed;
if(values.report){
  await mkdir(path.dirname(values.report),{recursive:true});
  // Preserve every attempt instead of overwriting an earlier failed run.
  await writeFile(values.report,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify(report,null,2));
if(failed)process.exitCode=1;
