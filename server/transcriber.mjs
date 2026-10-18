import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ApiError,requireValue} from './common.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const MAX_AUDIO_BYTES=1048576;
export const MAX_AUDIO_BODY=1400000+4096;
const formats=new Set(['audio/webm','audio/webm;codecs=opus','audio/ogg','audio/ogg;codecs=opus','audio/mp4','audio/wav','audio/x-wav']);
export function decodeAudioBody(body){
  requireValue(formats.has(body.mimeType),'Format rekaman belum didukung. Gunakan WebM, Ogg, MP4 atau WAV.');
  const text=body.audio;
  requireValue(typeof text==='string' && text.length>0 && text.length<=Math.ceil(MAX_AUDIO_BYTES/3)*4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text),'Rekaman tidak valid atau terlalu besar.');
  const audio=Buffer.from(text,'base64');
  requireValue(audio.length>0 && audio.length<=MAX_AUDIO_BYTES && audio.toString('base64')===text,'Rekaman tidak valid atau terlalu besar.');
  return audio;
}
const messages={unreliable_speech:'Hasil ucapan berulang atau kurang jelas. Dekatkan mikrofon, ucapkan nama menu dan jumlah dengan jeda, lalu rekam ulang. Kamu juga bisa mengetik pesanan.',invalid_audio:'Rekaman tidak dapat dibaca. Rekam ulang atau ketik pesanan.',too_long:'Rekaman melebihi 30 detik. Rekam pesanan yang lebih singkat.',too_short:'Rekaman terlalu singkat. Ucapkan pesanan lalu hentikan rekaman.',no_speech:'Ucapan belum terdengar jelas. Dekatkan mikrofon lalu rekam ulang, atau ketik pesanan.',too_much_text:'Hasil suara terlalu panjang. Rekam pesanan yang lebih singkat.'};
export function runSpeechProcess(audio,{check=false,signal,timeoutMs=90000,spawnProcess=spawn}={}){
  return new Promise((resolve,reject)=>{
    const python=path.join(root,'.venv-voice',process.platform==='win32'?'Scripts/python.exe':'bin/python');
    const child=spawnProcess(python,[path.join(root,'server/ml/transcribe.py'),...(check?['--check']:[])],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',PYTHONUTF8:'1'}});
    let output='',size=0,settled=false;
    const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);err?reject(err):resolve(result);};
    const abort=()=>{child.kill();finish(new ApiError(499,'Pemrosesan suara dibatalkan.'));};
    const timer=setTimeout(()=>{child.kill();finish(new ApiError(504,'Pemrosesan suara terlalu lama. Coba rekaman lebih singkat atau ketik pesanan.'));},timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    child.on('error',()=>finish(new ApiError(503,'Model suara belum siap. Ketik pesanan atau jalankan pemasangan suara.')));
    child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>16384){child.kill();finish(new ApiError(503,'Hasil model suara tidak valid. Ketik pesanan atau coba lagi.'));}else output+=chunk.toString('utf8');});
    child.on('close',()=>{try{const result=JSON.parse(output);if(result.error)throw new ApiError(messages[result.error]?422:503,messages[result.error]||'Model suara belum siap. Ketik pesanan atau periksa pemasangan suara.');if(check){requireValue(result.ready===true,'Model suara belum siap.',503);}else requireValue(typeof result.text==='string'&&result.text.trim()&&result.text.length<=2000&&Number.isFinite(result.durationSeconds)&&result.durationSeconds>0&&result.durationSeconds<=30,'Hasil model suara tidak valid.',503);finish(null,result);}catch(err){finish(err instanceof ApiError?err:new ApiError(503,'Model suara belum siap. Ketik pesanan atau periksa pemasangan suara.'));}});
    if(signal?.aborted)abort();else child.stdin.end(audio||Buffer.alloc(0));
  });
}
export function createTranscriber({runner=runSpeechProcess,verifyFiles,disabled=process.env.SPEECH_PROVIDER==='disabled'}={}){
  let busy=false,statusPromise;
  async function verify(){
    const lock=JSON.parse(await readFile(path.join(root,'models/speech-source.json'),'utf8'));
    for(const item of lock.files){const data=await readFile(path.join(root,'models/speech/whisper-tiny',item.name));if(data.length!==item.size)throw Error('size');const digest=item.sha256?createHash('sha256').update(data).digest('hex'):createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');if(digest!==(item.sha256||item.gitBlobSha1))throw Error('checksum');}
  }
  async function status(){
    if(disabled)return {available:false,model:'whisper-tiny',reason:'Pencatatan suara dinonaktifkan pada server ini.'};
    return statusPromise??=(async()=>{try{await (verifyFiles||verify)();await runner(null,{check:true,timeoutMs:30000});return {available:true,model:'whisper-tiny',engine:'faster-whisper',compute:'cpu-int8',pretrained:true,language:'id',maxSeconds:30,maxBytes:MAX_AUDIO_BYTES,reason:'Ucapan diproses oleh layanan suara aplikasi. Rekaman tidak disimpan.'};}catch{return {available:false,model:'whisper-tiny',reason:'Model suara belum siap. Ketik pesanan; jalankan npm run voice:setup lalu muat ulang server.'};}})();
  }
  return {status,async transcribe(body,{signal}={}){
    const audio=decodeAudioBody(body);
    requireValue(!busy,'Pemrosesan suara sedang dipakai. Tunggu sebentar lalu rekam ulang.',429);
    requireValue((await status()).available,'Model suara belum siap. Ketik pesanan atau periksa pemasangan suara.',503);
    requireValue(!busy,'Pemrosesan suara sedang dipakai. Tunggu sebentar lalu rekam ulang.',429);
    busy=true;try{return await runner(audio,{signal});}finally{busy=false;}
  }};
}
export const localTranscriber=createTranscriber();
