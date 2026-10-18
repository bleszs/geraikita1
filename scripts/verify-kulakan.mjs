import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {validateKulakanModel,predictKulakan} from '../server/ml/kulakan-model.mjs';
const a=validateKulakanModel(JSON.parse(readFileSync(process.argv[2],'utf8')));
const fixtures=JSON.parse(readFileSync(process.argv[3],'utf8'));
let maxError=0;
for(const f of fixtures){
  const actual=predictKulakan(a,f.history,f.asOf),error=Math.abs(actual-f.expected);
  assert.ok(error<1e-9*Math.max(1,Math.abs(f.expected)),`Node/Python parity error ${error}`);
  maxError=Math.max(maxError,error);
}
assert.ok(fixtures.length>0);
console.log(JSON.stringify({parityRows:fixtures.length,maxAbsoluteError:maxError}));
