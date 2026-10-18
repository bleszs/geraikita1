import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ApiError} from './common.mjs';
import {createTranscriber,runSpeechProcess} from './transcriber.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const speechProfiles=Object.freeze(Object.fromEntries([
  ['tiny-current','tiny',null],['tiny-pinned','tiny','1'],['base-pinned','base','1'],['base-orders','base','1']
].map(([id,model,openblasThreads])=>[id,Object.freeze({id,model,openblasThreads})])));
export function speechProfile(id){
  if(!Object.hasOwn(speechProfiles,id))throw new Error('Profil suara tidak didukung.');
  return speechProfiles[id];
}
export function profileRunner(id,{spawnProcess=spawn}={}){
  const profile=speechProfile(id);
  return async(audio,options={})=>{
    const result=await runSpeechProcess(audio,{...options,spawnProcess(exe,args,settings){
      const env={...settings.env,...(profile.openblasThreads?{OPENBLAS_NUM_THREADS:profile.openblasThreads}:{})};
      return spawnProcess(exe,[path.join(root,id==='base-orders'?'server/ml/transcribe-orders.py':'server/ml/transcribe-profile.py'),id,...args.slice(1)],{...settings,env});
    }});
    if(result.profile!==id||result.model!=='whisper-'+profile.model||(profile.openblasThreads&&result.openblasThreads!==profile.openblasThreads))throw new ApiError(503,'Konfigurasi model suara tidak sesuai profil yang diminta.');
    return result;
  };
}
export async function verifySpeechProfile(id){
  const profile=speechProfile(id),lock=JSON.parse(await readFile(path.join(root,'models',profile.model==='tiny'?'speech-source.json':'speech-base-source.json'),'utf8'));
  for(const item of lock.files){
    const bytes=await readFile(path.join(root,'models/speech','whisper-'+profile.model,item.name));
    if(bytes.length!==item.size)throw Error('Model size mismatch.');
    const hash=item.sha256?createHash('sha256').update(bytes).digest('hex'):createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if(hash!==(item.sha256||item.gitBlobSha1))throw Error('Model checksum mismatch.');
  }
}
/** Explicit opt-in factory only; default HTTP/worker imports remain unchanged. */
export function createProfileTranscriber(id,{runner,verifyFiles,disabled=process.env.SPEECH_PROVIDER==='disabled'}={}){
  const profile=speechProfile(id),engine=createTranscriber({runner:runner??profileRunner(id),verifyFiles:verifyFiles??(()=>verifySpeechProfile(id)),disabled});
  return {transcribe:engine.transcribe,async status(){return {...await engine.status(),profile:id,model:'whisper-'+profile.model,openblasThreads:profile.openblasThreads};}};
}
