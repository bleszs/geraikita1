import {prepareFnbDemo} from './fnb-demo.mjs';
import {createApp} from '../server/http.mjs';
import {createRuntimeTranscriber} from '../server/runtime-speech.mjs';
try{
 if(process.argv.length>2)throw Error('Demo F&B memakai folder terpisah dan port 4180.');
 const demo=prepareFnbDemo(),app=createApp({filename:demo.filename,transcriber:createRuntimeTranscriber()});
 app.server.listen(4180,'127.0.0.1',()=>console.log('DEMO F&B: http://127.0.0.1:4180 — jalankan npm run demo:setup untuk melihat akun demo.'));
 app.server.once('error',e=>{console.error(e.message);app.store.close();process.exitCode=1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}catch(e){console.error(e.message);process.exitCode=1;}
