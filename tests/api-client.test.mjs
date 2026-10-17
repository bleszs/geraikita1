import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from '../public/api.js';

test('both AI extraction routes allow model processing time while ordinary requests keep their short timeout',async t=>{
  const deadlines=[],sent=[];
  t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return new AbortController().signal;});
  t.mock.method(globalThis,'fetch',async(path,options)=>{sent.push({path,options});return {ok:true,json:async()=>({mode:'ollama'})};});
  for(const path of ['/extractions','/kitchen/extractions','/bootstrap','/kitchen/orders'])await request(path,{text:'Technical transport only'},'csrf-test');
  assert.deepEqual(deadlines,[60000,60000,15000,15000]);
  assert.equal(sent[1].path,'/api/kitchen/extractions');assert.equal(sent[1].options.credentials,'same-origin');
  assert.equal(JSON.parse(sent[1].options.body).csrf,'csrf-test');
});
