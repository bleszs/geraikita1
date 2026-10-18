import http from 'node:http';
import {deploymentConfig} from './deployment.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import {createIdentity} from './identity.mjs';
import {createDisplayAccess} from './display-access.mjs';
import {authorize,staffBootstrap} from './roles.mjs';
import { createService } from './service.mjs';
import { createExtractor,parseOrder } from './extractor.mjs';
import {createPlans} from './plans.mjs';
import {localTranscriber,MAX_AUDIO_BODY} from './transcriber.mjs';
import { ApiError, requireValue } from './common.mjs';
const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
async function readBody(request, limit=65536) {
  requireValue(request.headers['content-type']?.startsWith('application/json'), 'Gunakan JSON.', 415);
  requireValue(!request.headers['content-length'] || Number(request.headers['content-length'])<=limit, 'Permintaan terlalu besar.', 413);
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; requireValue(size <= limit, 'Permintaan terlalu besar.', 413); chunks.push(chunk); }
  try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requireValue(body && typeof body === 'object' && !Array.isArray(body), 'JSON harus berupa objek.'); return body; } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'JSON tidak valid.'); }
}
export function createApp({ filename = process.env.DATABASE_PATH || 'data/gerai-kita-live.sqlite', extractor = createExtractor(),transcriber=localTranscriber, deployment=deploymentConfig(),planOptions } = {}) {
  const store = createStore(filename); const service = createService(store),identity=createIdentity(store);
  const displays=createDisplayAccess(store);
  const plans=createPlans(store,planOptions);
  const failures=new Map();
  const kitchenStreams=new Set();
  const stateOf=async s=>s.role==='owner'?({...service.bootstrap(s),plan:plans.snapshot(s),displays:displays.list(s),staff:identity.staff(s),staffInvites:identity.staffInvites(s),account:identity.details(s),ai:await extractor.status(),speech:await transcriber.status()}):({...staffBootstrap(store,service,s,identity.details(s)),ai:s.role==='cashier'?await extractor.status():undefined,speech:await transcriber.status()});
  const server = http.createServer(async (request, response) => {
    const json = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(value)); };
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      deployment.checkHost(request,pathname);
      if(deployment.publicMode)response.setHeader('Strict-Transport-Security','max-age=31536000');
      const staffClient=pathname.match(/^\/api\/staff-client\/([a-z][a-z-]*\.js)$/);
      if(request.method==='GET'&&(pathname==='/api/staff/screen'||staffClient)){
        const file=staffClient?staffClient[1]:'index.html';let content=await readFile(path.join(root,file));
        if(!staffClient)content=Buffer.from(content.toString('utf8').replace('src="/app.js"','src="/api/staff-client/app.js"'));
        response.writeHead(200,{'Content-Type':staffClient?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});response.end(content);return;
      }
      if(pathname==='/api/display/screen'&&request.method==='GET'){
        const content=await readFile(path.join(root,'display-screen.html'));
        response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"});response.end(content);return;
      }
      if(['/api/display/snapshot','/api/display/events'].includes(pathname)){
        requireValue(request.method==='GET','Layar pelanggan hanya dapat membaca status.',405);
        const access=displays.resolve(request.headers.authorization);
        if(pathname.endsWith('/snapshot'))return json(displays.snapshot(access));
        response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Connection':'keep-alive','X-Accel-Buffering':'no'});
        kitchenStreams.add(response);let fingerprint='',lastSent=0;
        const tick=()=>{try{
          const active=displays.resolve(request.headers.authorization),data=displays.snapshot(active),next=JSON.stringify([data.orders,data.hasMore]);
          if(next!==fingerprint||Date.now()-lastSent>=5000){fingerprint=next;lastSent=Date.now();response.write(`data: ${JSON.stringify(data)}\n\n`);}
        }catch{response.write('event: revoked\ndata: {}\n\n');response.end();}};
        const interval=setInterval(tick,1000);response.once('close',()=>{clearInterval(interval);kitchenStreams.delete(response);});tick();return;
      }
      if(pathname==='/api/catalog/screen'&&request.method==='GET'){
        const content=await readFile(path.join(root,'catalog-screen.html'));
        response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"});response.end(content);return;
      }
      const catalogRequest=pathname.match(/^\/api\/catalog\/requests(?:\/([a-zA-Z0-9-]+))?$/);
      if(['/api/catalog/snapshot','/api/catalog/events'].includes(pathname)||catalogRequest){
        // Public catalog links carry no session: only the bearer token scoped to kind 'catalog'.
        const submitting=catalogRequest&&!catalogRequest[1];
        requireValue(request.method===(submitting?'POST':'GET'),submitting?'Kirim permintaan dengan POST.':'Katalog hanya dapat dibaca.',405);
        if(submitting)deployment.checkOrigin(request);
        const body=submitting?await readBody(request,16384):null,access=displays.resolve(request.headers.authorization,'catalog');
        if(submitting)return json(service.requests.submit(access,body),201);
        if(catalogRequest)return json(service.requests.status(access,catalogRequest[1]));
        if(pathname.endsWith('/snapshot'))return json(service.requests.catalog(access));
        response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Connection':'keep-alive','X-Accel-Buffering':'no'});
        kitchenStreams.add(response);let fingerprint='',lastSent=0;
        const tick=()=>{try{
          const data=service.requests.catalog(displays.resolve(request.headers.authorization,'catalog')),next=JSON.stringify(data.menus);
          if(next!==fingerprint||Date.now()-lastSent>=5000){fingerprint=next;lastSent=Date.now();response.write(`data: ${JSON.stringify(data)}\n\n`);}
        }catch{response.write('event: revoked\ndata: {}\n\n');response.end();}};
        const interval=setInterval(tick,1000);response.once('close',()=>{clearInterval(interval);kitchenStreams.delete(response);});tick();return;
      }
      // API prefix intentionally bypasses every legacy shell worker, including
      // versions whose startup error has no working update control.
      if(request.method==='GET' && ['/api/recovery','/api/recovery.js'].includes(pathname)){
        const script=pathname.endsWith('.js');
        const content=await readFile(path.join(root,script?'recovery.js':'recovery.html'));
        response.writeHead(200,{'Content-Type':script?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'"});response.end(content);return;
      }
      if (pathname.startsWith('/api/')) {
        const mutating = !['GET', 'HEAD'].includes(request.method);
        if (mutating) { deployment.checkOrigin(request); requireValue(request.method === 'POST', 'Metode tidak didukung.', 405); }
        const cookie = request.headers.cookie?.match(/(?:^|;\s*)gerai_session=([a-f0-9]{64})(?:;|$)/)?.[1];
        let session=identity.resolve(cookie);
        if(pathname==='/api/transcriptions')requireValue(session,'Masuk ke akun untuk memakai pencatatan suara.',401);
        const body=mutating ? await readBody(request,pathname==='/api/transcriptions'?MAX_AUDIO_BODY:65536) : null;
        // A role/session may be revoked while a request body is still arriving.
        session=identity.resolve(cookie);
        if(pathname==='/api/health' && request.method==='GET')return json({storage:'sqlite',mode:'live',ai:await extractor.status(),speech:await transcriber.status()});
        if(['/api/auth/register','/api/auth/login'].includes(pathname) && mutating){
          requireValue(!session,'Keluar dari akun aktif sebelum masuk dengan akun lain.',409);
          const key=deployment.clientAddress(request)+':'+String(body.email || '').trim().toLowerCase();const failed=failures.get(key);
          requireValue(!failed || failed.until<Date.now() || failed.count<8,'Terlalu banyak percobaan. Coba lagi dalam 10 menit.',429);
          try{session=pathname.endsWith('/register') ? identity.register(body) : identity.login(body);failures.delete(key);}catch(error){const old=failed && failed.until>Date.now() ? failed : {count:0,until:Date.now()+600000};failures.set(key,{...old,count:old.count+1});throw error;}
          response.setHeader('Set-Cookie',deployment.sessionCookie(session.id));
          return json(await stateOf(session),pathname.endsWith('/register') ? 201 : 200);
        }
        if(pathname==='/api/auth/staff-code'&&mutating){
          requireValue(!session,'Keluar dari akun aktif sebelum masuk sebagai staf.',409);
          const key='staff-code:'+deployment.clientAddress(request),failed=failures.get(key),current=failed&&failed.until>Date.now()?failed:{count:0,until:Date.now()+600000};
          requireValue(current.count<8,'Terlalu banyak percobaan kode. Coba lagi dalam 10 menit.',429);
          try{session=identity.loginStaffCode(body);}catch(error){if(error.status===400||error.status===401)failures.set(key,{...current,count:current.count+1});throw error;}
          response.setHeader('Set-Cookie',deployment.sessionCookie(session.id));
          return json(await stateOf(session));
        }
        if(pathname==='/api/auth/recover'&&mutating){
          requireValue(!session,'Keluar dari akun aktif sebelum memulihkan kata sandi.',409);
          const key='recover:'+deployment.clientAddress(request)+':'+String(body.email||'').trim().toLowerCase(),failed=failures.get(key),current=failed&&failed.until>Date.now()?failed:{count:0,until:Date.now()+600000};
          requireValue(current.count<8,'Terlalu banyak percobaan pemulihan. Coba lagi dalam 10 menit.',429);
          let result;try{result=identity.recover(body);failures.delete(key);}catch(error){if(error.status===401||error.status===400)failures.set(key,{...current,count:current.count+1});throw error;}
          session=result.session;
          response.setHeader('Set-Cookie',deployment.sessionCookie(session.id));
          return json(await stateOf(session));
        }
        requireValue(session, 'Masuk ke akun untuk membuka catatan usaha.', 401);
        if (mutating) requireValue(body.csrf === session.csrf, 'Sesi berubah. Muat ulang halaman.', 403);
        authorize(session,pathname,request.method,body);
        if(pathname==='/api/staff'&&mutating)return json(body.code?identity.createStaffAccess(session,body):identity.createStaff(session,body),201);
        if(pathname==='/api/staff-access'&&mutating)return json(identity.createStaffAccess(session,body),201);
        if(pathname==='/api/staff-invites')return json(mutating?identity.createStaffInvite(session,body):identity.staffInvites(session),mutating?201:200);
        const inviteRevoke=pathname.match(/^\/api\/staff-invites\/([a-zA-Z0-9-]+)\/revoke$/);
        if(inviteRevoke&&mutating)return json(identity.revokeStaffInvite(session,inviteRevoke[1],body));
        const staffMatch=pathname.match(/^\/api\/staff\/([a-zA-Z0-9-]+)$/);
        if(staffMatch&&mutating)return json(identity.updateStaff(session,staffMatch[1],body));
        const staffDelete=pathname.match(/^\/api\/staff\/([a-zA-Z0-9-]+)\/delete$/);
        if(staffDelete&&mutating)return json(identity.deleteStaff(session,staffDelete[1],body));
        if(pathname==='/api/displays'&&mutating)return json(displays.create(session,body),201);
        const displayMatch=pathname.match(/^\/api\/displays\/([a-zA-Z0-9-]+)\/revoke$/);
        if(displayMatch&&mutating)return json(displays.revoke(session,displayMatch[1]));
        if(pathname==='/api/kitchen/events'&&request.method==='GET'){
          response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
          kitchenStreams.add(response);let revision='';
          const tick=()=>{try{
            const active=identity.resolve(cookie);
            if(!active||active.workspace_id!==session.workspace_id||active.business_id!==session.business_id){response.end();return;}
            const next=service.kitchen.snapshot(active).revision;
            revision=next;response.write(`data: ${JSON.stringify({revision})}\n\n`);
          }catch{response.end();}};
          const interval=setInterval(tick,1000);response.once('close',()=>{clearInterval(interval);kitchenStreams.delete(response);});tick();return;
        }
        if(pathname==='/api/kitchen'&&request.method==='GET')return json(session.role==='owner'?service.kitchen.snapshot(session):staffBootstrap(store,service,session,identity.details(session)).kitchen);
        if(pathname==='/api/kitchen/orders'&&mutating)return json(service.kitchen.create(session,body),201);
        const requestMatch=pathname.match(/^\/api\/order-requests\/([a-zA-Z0-9-]+)\/decision$/);
        if(requestMatch&&mutating)return json(service.requests.decide(session,requestMatch[1],body));
        if(pathname==='/api/kitchen/stations'&&mutating)return json(service.kitchen.saveStation(session,body));
        if(pathname==='/api/kitchen/commands'&&mutating)return json(service.kitchen.command(session,body));
        const kitchenMatch=pathname.match(/^\/api\/kitchen\/orders\/([a-zA-Z0-9-]+)\/actions$/);
        if(kitchenMatch&&mutating)return json(service.kitchen.change(session,kitchenMatch[1],body));
        if (pathname === '/api/bootstrap' && request.method === 'GET') return json(await stateOf(session));
        if (pathname === '/api/usage-reviews' && mutating) return json(service.saveUsageReview(session,body),201);
        if(pathname==='/api/transcriptions' && mutating){
          const reservation=plans.reserve(session,'speech');let succeeded=false;
          const controller=new AbortController();
          const disconnected=()=>{if(!response.writableEnded)controller.abort();};
          response.once('close',disconnected);
          try{const result=await transcriber.transcribe(body,{signal:controller.signal});const active=identity.resolve(cookie);requireValue(active&&active.account_id===session.account_id&&active.role_revision===session.role_revision,'Sesi berubah. Masuk kembali.',401);succeeded=true;return json(result);}
          finally{plans.finish(reservation,succeeded);response.removeListener('close',disconnected);}
        }
        if(pathname==='/api/account/plan'&&request.method==='GET')return json(plans.snapshot(session));
        if(pathname==='/api/account/plan-interest'&&mutating)return json(plans.interest(session,body));
        if(pathname==='/api/account/profile' && mutating)return json(identity.saveBusiness(session,body));
        if(pathname==='/api/community/settings' && mutating)return json(identity.saveCommunity(session,body));
        if(pathname==='/api/community/invite' && mutating)return json(identity.rotateInvite(session,body));
        if(pathname==='/api/account/password' && mutating){
          const key='password:'+session.account_id,failed=failures.get(key);
          requireValue(!failed || failed.until<Date.now() || failed.count<8,'Terlalu banyak percobaan. Coba lagi dalam 10 menit.',429);
          try{const result=identity.changePassword(session,body);failures.delete(key);return json(result);}catch(error){if(error.code==='incorrect_password'){const old=failed && failed.until>Date.now()?failed:{count:0,until:Date.now()+600000};failures.set(key,{...old,count:old.count+1});}throw error;}
        }
        if(pathname==='/api/account/recovery-codes' && mutating)return json(identity.generateRecoveryCodes(session,body),201);

        if (['/api/extractions','/api/kitchen/extractions'].includes(pathname) && mutating) {
          const catalogRevision = store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?', session.workspace_id, session.business_id).catalog_revision;
          const menu=store.menus(session).map(({id,name,aliases})=>({id,name,aliases}));
          if(pathname==='/api/kitchen/extractions')requireValue(body.catalogRevision===catalogRevision,'Katalog berubah. Perbarui data lalu periksa pesanan kembali.',409,'catalog_changed');
          let reservation,result;
          try{reservation=plans.reserve(session,'text');}catch(error){
            if(error.code!=='ai_quota_exhausted')throw error;
            result={items:parseOrder(body.text,menu),mode:'rules',reason:'Kuota AI bulan ini habis. Parser lokal membantu mengisi; periksa semua rincian atau isi manual.'};
          }
          let accepted=false;
          try{
            if(reservation)result=await extractor.extract(body.text,menu);
            const active=identity.resolve(cookie);
            requireValue(active&&active.account_id===session.account_id&&active.role_revision===session.role_revision,'Sesi berubah. Masuk kembali.',401);
            requireValue(store.get('SELECT catalog_revision FROM business_state WHERE workspace_id=? AND business_id=?',session.workspace_id,session.business_id).catalog_revision===catalogRevision,'Katalog berubah saat AI memproses. Perbarui data lalu periksa pesanan kembali.',409,'catalog_changed');
            accepted=true;return json({...result,catalogRevision});
          }finally{if(reservation)plans.finish(reservation,accepted&&result?.mode==='ollama');}
        }
        if (pathname === '/api/transactions' && mutating) return json(service.transaction(session, body), 201);
        if (pathname === '/api/withdrawals' && mutating) return json(service.withdraw(session, body), 201);
        if (pathname === '/api/stock-receipts' && mutating) return json(service.receive(session, body), 201);
        if (pathname === '/api/menus' && mutating) return json(service.saveMenu(session, null, body), 201);
        if (pathname === '/api/ingredients' && mutating) return json(service.saveIngredient(session,null,body),201);
        if (pathname === '/api/offers' && mutating) return json(service.createOffer(session,body),201);
        if (pathname === '/api/demand-consents' && mutating) return json(service.demand(session, body));
        if (pathname === '/api/proposal/approval' && mutating) return json(service.approval(session, body));
        if (pathname === '/api/collective-orders' && mutating) return json(service.finalizeCollective(session,body),201);
        if (pathname === '/api/collective-cycles/next' && mutating) return json(service.nextCycle(session,body));
        if(pathname==='/api/auth/logout' && mutating){store.run('DELETE FROM sessions WHERE id=?',session.id);response.setHeader('Set-Cookie',deployment.sessionCookie(null,true));return json({signedOut:true});}
        if(pathname==='/api/community/quote' && mutating)return json(service.saveQuote(session,body));
        let match;
        if ((match=pathname.match(/^\/api\/collective-orders\/([a-zA-Z0-9-]+)\/receipts\/([a-zA-Z0-9-]+)\/cancel$/)) && mutating) return json(service.cancelCollectiveReceipt(session,match[1],match[2],body));
        if ((match=pathname.match(/^\/api\/ingredients\/([a-zA-Z0-9-]+)$/)) && mutating) return json(service.saveIngredient(session,match[1],body));
        if ((match = pathname.match(/^\/api\/collective-orders\/([a-zA-Z0-9-]+)\/(receipts|cancel)$/)) && mutating) return json(match[2] === 'receipts' ? service.receiveCollective(session,match[1],body) : service.cancelCollective(session,match[1]),match[2] === 'receipts' ? 201 : 200);
        if ((match = pathname.match(/^\/api\/stock-receipts\/([a-zA-Z0-9-]+)\/cancel$/)) && mutating) return json(service.cancelReceipt(session, match[1], body));
        if ((match = pathname.match(/^\/api\/menus\/([a-zA-Z0-9-]+)$/)) && mutating) return json(service.saveMenu(session, match[1], body));
        if ((match = pathname.match(/^\/api\/transactions\/([a-zA-Z0-9-]+)\/cancel$/)) && mutating) return json(service.cancelSale(session, match[1]));
        if ((match = pathname.match(/^\/api\/offers\/([a-zA-Z0-9-]+)\/request$/)) && mutating) return json(service.requestTransfer(session, match[1], body), 201);
        if ((match = pathname.match(/^\/api\/offers\/([a-zA-Z0-9-]+)\/withdraw$/)) && mutating) return json(service.withdrawOffer(session,match[1]));
        if ((match = pathname.match(/^\/api\/transfers\/([a-zA-Z0-9-]+)\/(approval|cancel)$/)) && mutating) return json(service.transferDecision(session, match[1], match[2] === 'approval'));
        throw new ApiError(404, 'Endpoint tidak ditemukan.');
      }
      requireValue(request.method === 'GET' || request.method === 'HEAD', 'Metode tidak didukung.', 405);
      const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      requireValue(filename.startsWith(root + path.sep), 'Akses tidak diizinkan.', 403);
      let content; try { content = await readFile(filename); } catch { throw new ApiError(404, 'Halaman tidak ditemukan.'); }
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) { if (!(error instanceof ApiError)) console.error(error); json({ error: error instanceof ApiError ? error.message : 'Terjadi kesalahan penyimpanan. Coba lagi.', code: error.code || 'server_error' }, error.status || 500); }
  });
  return { server, store, service, close: () => new Promise(resolve => {for(const stream of kitchenStreams)stream.end();server.close(() => { store.close(); resolve(); });server.closeIdleConnections();}) };
}
