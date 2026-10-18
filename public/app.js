import {csvText,salesRows} from './csv.js';
import {newStaffCode} from './staff-pairing.js';
import {staffWorkspace,syncStaffMenuAvailability} from './staff-workspace.js';
import {request} from './api.js';
import {createVoiceCapture} from './voice.js';
import {icon} from './icons.js';
import {routes,authView,guestGuideView,createViews,escape as e,notice} from './live-views.js';
import {createGuideController} from './guide.js';
import {number as n,money as m} from './model.js';
import {receiptUnits,receiptMeasurement} from './receipt-measurement.js';
import {scopeOf,saveSnapshot,readSnapshot,clearSnapshot,readAction,saveAction,clearAction,listDrafts,putDraft,removeDraft,validateDraft,registerPwa} from './offline.js';

let state=null,connected=true,snapshotAt='',pendingAction=null,deviceDrafts=[],busy=false,registration=null,toastTimer,values={};
let kitchenEvents=null,kitchenEventScope='',kitchenVoiceTimer,kitchenRecordingRevisions={},kitchenUpdating=false,kitchenRenderPending=false,kitchenVoiceEpoch=0;
const ui={auth:'register',joining:false,error:'',mobile:false,editor:null,editId:null,review:null,reviewRevision:null,reviewId:null,cancel:null,extractionReason:'',receiptUnits:u=>u?receiptUnits(u):[]};
const voice=createVoiceCapture({onLevel(text){const el=document.querySelector('#voice-level');if(el&&el.textContent!==text)el.textContent=text;},onChange(){ui.voice=voice.state;if(ui.kitchenHandsfree){if(voice.state.phase==='recording')kitchenRecordingRevisions=Object.fromEntries((state?.kitchen?.orders||[]).map(o=>[o.id,o.revision]));if(voice.state.phase==='review')queueMicrotask(runSpokenKitchenCommand);if(voice.state.phase==='error')ui.kitchenHandsfree=false;}if(state)render();const selector=ui.kitchenHandsfree?'[data-action="kitchen-listen"]':voice.state.phase==='recording'?'[data-action="voice-stop"]':voice.state.phase==='review'?'#voice-text':['requesting','processing'].includes(voice.state.phase)?'[data-action="voice-cancel"]':'[data-action="voice-start"]';document.querySelector(selector)?.focus();},onTick(seconds){if(ui.kitchenHandsfree&&seconds>=4)voice.stop();const el=document.querySelector('#voice-elapsed');if(el)el.textContent=String(seconds);},async send(body,signal){
  let response,data;try{response=await fetch('/api/transcriptions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,csrf:state.csrf}),signal:AbortSignal.any([signal,AbortSignal.timeout(95000)])});data=await response.json();}
  catch(error){throw new Error(error.name==='TimeoutError'?'Pemrosesan suara terlalu lama. Rekam lebih singkat atau ketik pesanan.':'Server suara belum terhubung. Periksa server lalu rekam ulang, atau ketik pesanan.');}
  if(!response.ok)throw new Error(data.error||'Suara belum dapat diproses. Ketik pesanan atau coba lagi.');if(state&&!isStaff()){try{state.plan=await request('/account/plan');}catch{}}return data;
}});
ui.voice=voice.state;
function clearVoice(){kitchenVoiceEpoch++;clearTimeout(kitchenVoiceTimer);ui.kitchenHandsfree=false;voice.reset();ui.voice=voice.state;}
const isStaff=()=>!!state?.account?.role&&state.account.role!=='owner';
const kitchenKey=()=>isStaff()?state.account.id+':'+state.account.roleRevision+':'+crypto.randomUUID():crypto.randomUUID();
const route=()=>isStaff()?(location.hash==='#pengaturan'?'pengaturan':'dapur'):routes.some(r=>r[0]===location.hash.slice(1))?location.hash.slice(1):'dapur';
const guide=createGuideController({getContext:()=>({scope:state?scopeOf(state):'guest',signedIn:!!state,role:state?.account?.role||'owner',route:route(),newAccount:Boolean(ui.guideAutoplayRequested)}),consumeNewAccount:()=>{ui.guideAutoplayRequested=false;},navigate:page=>{location.hash=page;},notify,escape:e});
function notify(message){const box=document.querySelector('#toast');box.textContent=message;box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,4000);}
function showUpdatePrompt(){
  if(!registration?.waiting || document.querySelector('[data-action="update-app"]'))return;
  const main=document.querySelector('#main');if(!main)return;
  main.insertAdjacentHTML('afterbegin',`<section class="update-prompt" role="status">${notice('Versi aplikasi baru tersedia. Simpan isian sebelum memuat ulang.')}<button class="text-link" data-action="update-app">Muat ulang aplikasi</button></section>`);
}
function done(a,data){
  const id=a.payload.idempotencyKey;
  if(a.kind==='kitchenCreate')return data.kitchen?.orders.some(o=>o.idem===id);
  if(a.kind==='kitchenChange')return data.kitchen?.recentActions.includes(id);
  if(a.kind==='staffSale')return data.recentSales?.includes(id);
  if(a.kind==='sale')return data.transactions.some(t=>t.idem===id);
  if(['receipt','collectiveReceipt'].includes(a.kind))return data.stockReceipts.some(r=>r.idem===id);
  if(a.kind==='offer')return data.offers.some(o=>o.ownerId===data.business.id&&o.idempotencyKey===id);
  if(['cancelReceipt','cancelCollectiveReceipt'].includes(a.kind))return data.stockReceipts.some(r=>r.id===a.match.id&&r.cancelled_at);
  if(a.kind==='cancelSale')return data.transactions.some(t=>t.id===a.match.id&&t.cancelled_at);
  if(a.kind==='requestTransfer')return data.transfers.some(t=>t.offer_id===a.match.offerId&&t.receiver_id===data.business.id&&!a.match.before.includes(t.id));
  if(a.kind==='transferDecision')return data.transfers.some(t=>t.id===a.match.id&&t.status===a.match.status);
  if(a.kind==='finalize')return data.group.frozen&&data.group.cycle.id===a.match.cycle;
  if(a.kind==='cancelPlan')return data.collectiveHistory.some(h=>h.id===a.match.id&&h.status==='cancelled');
  if(a.kind==='nextCycle')return data.group.cycle.id>a.match.cycle;
  return false;
}
let staffCodeTimer;
function clearStaffCode(){clearTimeout(staffCodeTimer);ui.staffCodeResult=null;}
function clearStaffPairing(){clearStaffCode();ui.staffInviteEpoch=(ui.staffInviteEpoch||0)+1;ui.staffInvitePending=null;ui.staffInviteTarget=null;ui.staffInviteRevoke=null;}
function clearDisplaySecrets(){ui.recoveryCodesResult=null;ui.kitchenExtraction=null;ui.staffReview=null;ui.staffReviewRevision=null;ui.staffReviewReason=null;ui.staffAccessEpoch=(ui.staffAccessEpoch||0)+1;ui.staffAccessResult=null;ui.staffAccessPending=null;ui.staffDelete=null;ui.staffFormOpen=false;clearStaffPairing();ui.staffQueueFilter='all';ui.staffFinanceOpen=false;ui.productionPlan=null;ui.productionPlannerOpen=false;ui.usageZeroOpen=false;ui.usagePanelOpen=false;ui.kulakanModelOpen=false;ui.staffPayOrigin=null;ui.staffRestoreFocus=null;ui.staffCreateKey=null;ui.staffCreateMeta=null;ui.staffEdit=null;ui.staffFocus=null;ui.displayEpoch=(ui.displayEpoch||0)+1;ui.displayLink=null;ui.displayCreatePending=null;ui.displayRevoke=null;ui.displayFocus=null;}
async function adopt(data){
  if(!state)clearDisplaySecrets();
  const before=state&&scopeOf(state);ui.productionPlan=null;state=data;connected=true;snapshotAt=new Date().toISOString();
  if(before&&before!==scopeOf(data)){clearDisplaySecrets();clearVoice();values={};ui.editor=null;ui.review=null;ui.cancel=null;ui.reviewId=null;ui.usageReview=null;ui.pay=null;ui.receipt=null;}
  try{if(isStaff())await clearSnapshot();else await saveSnapshot(data);}catch(err){notify(err.message);}
  pendingAction=null;
  try{
    pendingAction=await readAction(scopeOf(data));
    if(pendingAction&&done(pendingAction,data)){
      await clearAction(scopeOf(data));
      if(pendingAction.kind==='sale'){try{await removeDraft(pendingAction.payload.idempotencyKey,true);}catch{}ui.review=null;ui.reviewId=null;}
      if(pendingAction.kind==='kitchenCreate'){ui.kitchenExtraction=null;ui.kitchenItemCount=1;values['kitchen-new']={};values['kitchen-extract']={};}
      if(['kitchenCreate','staffSale'].includes(pendingAction.kind)){ui.staffReview=null;ui.staffReviewReason=null;values['staff-review']={};values['staff-extract']={};}
      pendingAction=null;ui.cancel=null;ui.editor=null;
    }
  }catch(err){notify(err.message);}
  try{deviceDrafts=(await listDrafts()).filter(d=>d.scope===scopeOf(data));}catch(err){deviceDrafts=[];notify(err.message);}
}
async function refresh(){const before=state&&scopeOf(state);await adopt(await request('/bootstrap'));if(before&&before!==scopeOf(state))throw new Error('Akun atau kelompok berubah. Buka akun asal untuk memeriksa catatan tertunda.');}
async function durable(kind,path,payload,label,match={}){
  if(!connected)throw new Error('Hubungkan ke server sebelum mengirim catatan ini.');
  if(pendingAction)throw new Error('Periksa status catatan sebelumnya terlebih dahulu.');
  const a={scope:scopeOf(state),kind,path,payload,label,match,createdAt:new Date().toISOString()};
  await saveAction(a.scope,a);pendingAction=a;await sendAction(a);
}
async function sendAction(a){
  if(a.scope!==scopeOf(state))throw new Error('Catatan tertunda berasal dari akun lain.');
  let result;
  try{result=await request(a.path,a.payload,state.csrf);}
  catch(err){if(err.status>=400&&err.status<500){await clearAction(a.scope);pendingAction=null;throw err;}throw new Error('Status pengiriman belum pasti. Rincian asal tersimpan. Hubungkan lalu periksa status sebelum membuat catatan baru.');}
  try{await refresh();}catch(err){notify('Server menerima catatan. Hubungkan untuk memperbarui stok dan riwayat.');return;}
  if(!pendingAction){ui.editor=null;ui.cancel=null;values={};if(a.kind==='kitchenCreate'){ui.kitchenExtraction=null;ui.kitchenItemCount=1;}if(a.kind==='sale'){ui.review=null;ui.reviewId=null;}}
  notify(result?.cancelled?'Catatan ditemukan dan sudah dibatalkan. Stok tidak ditambah lagi.':'Catatan tersimpan. Stok dan riwayat mengikuti hasil server.');
}
function pendingPanel(){return !pendingAction?'':`<section class="section-panel pending-action" aria-labelledby="pending-title"><h2 id="pending-title">Ada catatan yang perlu diperiksa</h2><p>${e(pendingAction.label)}</p>${notice('Rincian asal tersimpan dan dikunci. Periksa status sebelum mencatat tindakan yang sama kembali.','warn')}<button class="button" data-action="retry-action" ${connected?'':'disabled'}>Periksa status & ulangi</button><p class="small muted">Tidak ada pengiriman otomatis ketika koneksi kembali.</p></section>`;}
function staffFocusBefore(){
  const el=document.activeElement,shell=el?.closest('.staff-shell');if(!shell)return null;
  const q=v=>CSS.escape(v),task=el.closest('[data-kitchen-task]'),order=el.closest('[data-kitchen-order]');let selector;
  if(el.matches('[data-action]'))selector=`[data-action="${q(el.dataset.action)}"]`+(el.dataset.step?`[data-step="${q(el.dataset.step)}"]`:'');
  else if(el.matches('a[href]'))selector=`a[href="${q(el.getAttribute('href'))}"]`;
  else if(el.matches('[data-guide-open]'))selector='[data-guide-open]';
  else if(el.name&&el.closest('[data-form]'))selector=`[data-form="${q(el.closest('[data-form]').dataset.form)}"] [name="${q(el.name)}"]`;
  if(!selector)return null;
  if(el.dataset.kind)selector+=`[data-kind="${q(el.dataset.kind)}"]`;
  if(el.dataset.method)selector+=`[data-method="${q(el.dataset.method)}"]`;
  if(el.dataset.filter)selector+=`[data-filter="${q(el.dataset.filter)}"]`;
  if(task)selector=`[data-kitchen-task="${q(task.dataset.kitchenTask)}"] `+selector;
  else if(order)selector=`[data-kitchen-order="${q(order.dataset.kitchenOrder)}"] `+selector;
  return {scope:shell.dataset.staffAccount,selector,task:task?.dataset.kitchenTask,order:order?.dataset.kitchenOrder};
}
function restoreStaffFocus(focus){
  if(!focus||focus.scope!==state.account.id+':'+state.account.roleRevision)return;
  const shell=document.querySelector('.staff-shell');let target=shell.querySelector(focus.selector);
  if(!target&&focus.task)target=shell.querySelector(`[data-kitchen-task="${CSS.escape(focus.task)}"] strong`);
  if(!target&&focus.order)target=shell.querySelector(`[data-kitchen-order="${CSS.escape(focus.order)}"] h3`);
  (target||shell.querySelector('#kitchen-queue-title'))?.focus({preventScroll:true});
}
function render(){
  if(!state){syncKitchenEvents();document.title='Gerai Kita · '+(route()==='panduan'?'Panduan penggunaan':'Akun usaha');document.querySelector('#app').innerHTML=route()==='panduan'?guestGuideView():authView(ui,values);showUpdatePrompt();if(busy)document.querySelectorAll('form input,form button').forEach(c=>c.disabled=true);guide.sync();return;}
  if(isStaff()){
    const focused=staffFocusBefore()||ui.staffRestoreFocus,local=!!ui.kitchenFocus;
    document.title='Gerai Kita · '+(state.account.role==='cashier'?'Kasir':'Dapur');
    document.querySelector('#app').innerHTML=staffWorkspace(state,ui,values,connected,pendingPanel(),route(),e,icon);
    syncStaffMenuAvailability(state);lockControls();guide.sync();syncKitchenEvents();restoreKitchenFocus();if(busy)ui.staffRestoreFocus=focused;else{ui.staffRestoreFocus=null;if(!local)restoreStaffFocus(focused);}return;
  }
  if(ui.staffCodeResult){const r=state.staffInvites?.find(i=>i.id===ui.staffCodeResult.id);if(r?.status!=='active'||Date.parse(r.expiresAt)<=Date.now())clearStaffCode();}
  const page=route(),title=routes.find(r=>r[0]===page)[1],view=createViews({state,ui,values,pendingAction,deviceDrafts,connected});document.title='Gerai Kita · '+title;
  document.querySelector('#app').innerHTML=`<div class="app-shell"><aside class="sidebar ${ui.mobile?'is-open':''}" id="sidebar"><a class="brand" href="#ringkasan"><span class="brand-mark"><img src="/assets/logo.svg" alt="" width="48" height="40"></span><span>gerai<span class="brand-light">kita</span><small>Tumbuh bersama.</small></span></a><div class="business-block"><span class="avatar">${e(state.business.letter)}</span><div><strong>${e(state.business.name)}</strong><span>${e(state.community.name)}</span></div></div><nav aria-label="Navigasi utama">${routes.map(([id,label,symbol])=>`<a href="#${id}" ${id===page?'aria-current="page"':''}>${icon(symbol)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-bottom"><button class="button secondary" data-action="logout" ${!connected?'disabled':''}>${icon('logout')}<span>Keluar akun</span></button><span class="sidebar-foot">Catatan milik ${e(state.business.name)}</span></div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-toggle" data-action="menu" aria-label="${ui.mobile?'Tutup':'Buka'} navigasi" aria-expanded="${ui.mobile}" aria-controls="sidebar">${icon(ui.mobile?'close':'menu')}</button><span class="topbar-title">${title}</span><div class="topbar-actions"><button class="icon-button" data-action="refresh" aria-label="Perbarui data">${icon('refresh')}</button><button class="icon-button" data-action="theme" aria-label="Ubah tema">${icon('moon')}</button><span class="active-business"><strong>${e(state.business.name)}</strong></span></div></header><main id="main" tabindex="-1">${!connected?notice(`Server belum terhubung. Data terakhir ${e(new Date(snapshotAt).toLocaleString('id-ID'))}. Tindakan server perlu diperiksa saat tersambung kembali.`,'warn')+`<div class="actions"><button class="button secondary" data-action="reconnect">Hubungkan & muat ulang</button></div>`:''}${registration?notice('Versi aplikasi baru tersedia. Simpan isian sebelum memuat ulang.')+`<button class="text-link" data-action="update-app">Muat ulang aplikasi</button>`:''}${pendingPanel()}<div class="date-line">${e(new Date(state.date+'T12:00:00Z').toLocaleDateString('id-ID',{dateStyle:'full'}))}</div>${view[page]()}<footer class="page-footer"><span>Keputusan usahamu tetap di tanganmu.</span><span>${e(state.community.name)}</span></footer></main><nav class="quick-nav" aria-label="Navigasi cepat">${[['dapur','Dapur','shop'],['pesanan','Catat','plus'],['stok','Stok','box'],['kelompok','Bersama','people']].map(([id,label,sym])=>`<a href="#${id}" ${page===id?'aria-current="page"':''}>${icon(sym)}<span>${label}</span></a>`).join('')}<button data-action="menu" aria-label="Menu navigasi">${icon('menu')}<span>Menu</span></button></nav></div></div>`;
  lockControls();receiptPreview();guide.sync();syncKitchenEvents();restoreKitchenFocus();
  if(ui.staffFocus){const selector=ui.staffFocus;ui.staffFocus=null;document.querySelector(selector)?.focus({preventScroll:true});}
  if(ui.stationFocus){const station=ui.stationFocus;ui.stationFocus=null;Array.from(document.querySelectorAll('[data-form="kitchen-station"]')).find(f=>f.elements.station.value===station)?.querySelector('[name="agingMinutes"]')?.focus({preventScroll:true});}
  if(ui.displayFocus){const selector=ui.displayFocus;ui.displayFocus=null;document.querySelector(selector)?.focus({preventScroll:true});}
}
function lockControls(){
  if(!state)return;document.querySelector('#main')?.setAttribute('aria-busy',String(busy));
  document.querySelectorAll('#main form').forEach(f=>{const localDraft=!connected&&f.dataset.form==='extract';if(busy||pendingAction||!connected)f.querySelectorAll('input,select,textarea,button').forEach(c=>{if(!localDraft||c.tagName==='BUTTON')c.disabled=true;});});
  const readonly=new Set(['staff-filter','staff-code-copy','staff-code-hide','staff-code-cancel','staff-code-cancel-revoke','staff-new-order','staff-queue','display-hide-link','display-copy','display-cancel-revoke','theme','menu','reconnect','refresh','update-app','export-sales','export-receipts','back-order','manual-order','add-order','remove-order','resume-draft','delete-draft','confirm-order','review-catalog','close-editor','close-cancel','copy-invite','close-usage-review','recovery-copy','recovery-hide']);
  document.querySelectorAll('[data-action]').forEach(b=>{if(busy||pendingAction&&!['staff-filter','staff-new-order','staff-queue','theme','menu','reconnect','refresh','retry-action','logout','export-sales','export-receipts','update-app'].includes(b.dataset.action)||!connected&&!readonly.has(b.dataset.action))b.disabled=true;});
  if(pendingAction)document.querySelectorAll('[data-review]').forEach(c=>c.disabled=true);
  if(busy||pendingAction||!connected)document.querySelectorAll('#main [form="staff-review-form"]').forEach(c=>c.disabled=true);
  if(voice.active){document.querySelectorAll('#extract-form button,[data-form="staff-extract"] button,[data-action="manual-order"],[data-action="staff-manual-order"]').forEach(c=>c.disabled=true);}
  if(busy||pendingAction||!connected)document.querySelectorAll('[data-action="voice-start"],[data-action="voice-use"]').forEach(c=>c.disabled=true);
  if(ui.kitchenHandsfree){const stop=document.querySelector('[data-action="kitchen-listen"]');if(stop)stop.disabled=false;}
}
function receiptPreview(){
  const target=document.querySelector('#receipt-preview');if(!target)return;const r=values.receipt||{},p=state.catalog.find(p=>p.id===r.productId);
  if(!p||!r.inputUnit||r.qty===''||r.qty===undefined||r.unitPrice===''||r.unitPrice===undefined){target.textContent='Pilih bahan, satuan, jumlah dan harga untuk melihat hasil penerimaan.';return;}
  try{const x=receiptMeasurement(p.unit,r.inputUnit,Number(r.qty),Number(r.unitPrice));target.textContent=`${n(x.inputQty)} ${x.inputUnit} = ${n(x.qty)} ${p.unit}. Saldo setelah diterima: ${n(state.stock[p.id]+x.qty)} ${p.unit}. Total ${m(x.total)}.`;}catch(err){target.textContent=err.message;}
}
function csv(filename,rows){const url=URL.createObjectURL(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function confirmOrder(){
  validateDraft(ui.review,state.menu);
  if(!connected){const id=ui.reviewId||crypto.randomUUID();await putDraft({id,scope:scopeOf(state),status:'draft',createdAt:new Date().toISOString(),label:ui.review.map(i=>`${i.qty} ${state.menu.find(m=>m.id===i.id).name}`).join(', '),payload:{items:structuredClone(ui.review),catalogRevision:ui.reviewRevision,idempotencyKey:id}});deviceDrafts=(await listDrafts()).filter(d=>d.scope===scopeOf(state));ui.review=null;notify('Draft tersimpan di perangkat. Stok dan penjualan belum berubah.');return;}
  if(ui.reviewRevision!==state.catalogRevision)throw new Error('Perbarui rincian katalog dan periksa harga/resep terlebih dahulu.');
  const id=ui.reviewId||crypto.randomUUID();await durable('sale','/transactions',{items:structuredClone(ui.review),catalogRevision:ui.reviewRevision,idempotencyKey:id},'Pencatatan pesanan: '+ui.review.map(i=>`${i.qty} ${state.menu.find(m=>m.id===i.id).name}`).join(', '));
}
document.addEventListener('input',event=>{
  if(event.target.id==='voice-text'){voice.edit(event.target.value);ui.voice=voice.state;return;}
  if(event.target.dataset.staffReview){const item=ui.staffReview?.[Number(event.target.dataset.index)];if(item)item[event.target.dataset.staffReview]=event.target.dataset.staffReview==='qty'?Number(event.target.value):event.target.value;syncStaffMenuAvailability(state);return;}
  const f=event.target.closest('[data-form]')||event.target.form;if(f?.dataset.form&&event.target.name){const name=f.dataset.form;if(name==='kitchen-station')values['station:'+f.elements.station.value]=Object.fromEntries(new FormData(f));else{values[name]??={};if(event.target.type!=='password'&&!event.target.closest('.password-input-wrap')&&event.target.name!=='code')values[name][event.target.name]=event.target.type==='checkbox'?event.target.checked:event.target.value;}
    if(name==='production-plan'){ui.productionPlan=null;document.querySelector('.production-result')?.remove();}
    if(name==='kitchen-new')syncStaffMenuAvailability(state);
    if(name==='receipt'&&['productId','inputUnit'].includes(event.target.name)){values.receipt.qty='';values.receipt.unitPrice='';if(event.target.name==='productId')values.receipt.inputUnit='';render();}else if(name==='receipt')receiptPreview();
  }
  if(event.target.dataset.review){const item=ui.review[Number(event.target.dataset.index)],key=event.target.dataset.review;item[key]=key==='qty'?Number(event.target.value):event.target.value;ui.reviewId=null;if(key==='id')render();else if(key==='qty'){
    const template=document.createElement('template');template.innerHTML=createViews({state,ui,values,pendingAction,deviceDrafts,connected}).pesanan();
    for(const selector of ['.order-total','.ingredient-list'])document.querySelector(selector)?.replaceWith(template.content.querySelector(selector));
  }}
});
function showFormError(kind,message,station){const target=station?Array.from(document.querySelectorAll('[data-form="kitchen-station"]')).find(f=>f.elements.station.value===station)?.querySelector('.form-error'):document.querySelector(`[data-form="${kind}"] .form-error`);if(target)target.innerHTML=notice(e(message),'warn');else notify(message);}
document.addEventListener('submit',async event=>{
  const f=event.target.closest('[data-form]');if(!f)return;event.preventDefault();if(busy)return;const kind=f.dataset.form,b=Object.fromEntries(new FormData(f));let payload,error='';
  if(kind==='auth'){
    busy=true;f.querySelector('button[type=submit]').disabled=true;
    try{const registering=ui.auth==='register',result=await request(registering?'/auth/register':ui.auth==='staff'?'/auth/staff-code':'/auth/login',b);ui.guideAutoplayRequested=registering;values={};ui.error='';await adopt(result);}catch(err){ui.error=err.message;}finally{busy=false;render();}return;
  }
  if(kind==='recover'){
    busy=true;f.querySelector('button[type=submit]').disabled=true;
    try{if(b.newPassword!==b.repeatPassword)throw new Error('Ulangan kata sandi baru belum sama.');const result=await request('/auth/recover',{email:b.email,code:b.code,newPassword:b.newPassword});ui.guideAutoplayRequested=false;values={};ui.error='';await adopt(result);notify('Kata sandi dipulihkan. Buat kode pemulihan baru dari Pengaturan.');}catch(err){ui.error=err.message;}finally{busy=false;render();}return;
  }
  if(!state||!connected||pendingAction||(['extract','staff-extract'].includes(kind)&&voice.active))return;busy=true;lockControls();
  try{
    if(kind==='staff-code-create'||kind==='staff-code-existing'){
      if(b.confirmed!=='on')throw new Error('Periksa nama dan hak akses staf lalu konfirmasi.');
      const target=ui.staffInviteTarget;
      if(kind==='staff-code-existing'&&!target)throw new Error('Buka kembali pemeriksaan kode staf.');
      const current=kind==='staff-code-create'?{name:b.name.trim(),role:b.role,confirmed:true}:{accountId:target.id,revision:target.revision,confirmed:true},meta=JSON.stringify(current);
      if(ui.staffInvitePending&&ui.staffInvitePending.meta!==meta)throw new Error('Status kode sebelumnya belum pasti. Ulangi rincian yang sama atau tutup pemeriksaan dan periksa daftar staf.');
      ui.staffInvitePending??={meta,body:{...current,code:newStaffCode(),idempotencyKey:crypto.randomUUID()}};
      const draft=ui.staffInvitePending.body,epoch=ui.staffInviteEpoch||0,scope=scopeOf(state);
      try{
        const result=await request('/staff-invites',draft,state.csrf);await refresh();
        ui.staffInvitePending=null;ui.staffInviteTarget=null;values['staff-code-create']={};clearStaffCode();
        const currentInvite=state?.staffInvites?.find(i=>i.id===result.id);
        if(state&&scopeOf(state)===scope&&(ui.staffInviteEpoch||0)===epoch&&route()==='pengaturan'&&currentInvite?.status==='active'){
          ui.staffCodeResult={...currentInvite,code:draft.code};
          staffCodeTimer=setTimeout(()=>{const region=document.querySelector('.staff-code-result'),focused=region?.contains(document.activeElement);clearStaffCode();region?.remove();if(focused)document.querySelector('#staff-code-create-title')?.focus();notify('Kode melewati batas waktu. Buat kode baru untuk staf yang sama jika diperlukan.');},Math.max(0,Date.parse(currentInvite.expiresAt)-Date.now())+5);
          ui.staffFocus='.staff-code-result';
        }
        notify(ui.staffCodeResult?'Kode masuk dibuat. Bagikan langsung kepada staf bersama alamat masuk.':'Kode sebelumnya sudah tidak aktif atau halaman telah berubah. Periksa daftar staf.');
      }catch(error){if(error.status>=400&&error.status<500)ui.staffInvitePending=null;throw error;}
    }
    else if(kind==='staff-access-create'){
      if(b.confirmed!=='on')throw new Error('Periksa biodata dan kategori staf terlebih dahulu.');
      const rawCode=(b.code||'').replace(/[\s-]/g,'').toUpperCase(),meta=JSON.stringify([b.name,b.role,b.phone||'',b.notes||'',rawCode]),scope=scopeOf(state),epoch=ui.staffAccessEpoch||0;
      if(ui.staffAccessPending&&ui.staffAccessPending.meta!==meta)throw new Error('Status staf sebelumnya belum pasti. Ulangi biodata semula untuk memeriksa hasilnya.');
      const draft=ui.staffAccessPending||(ui.staffAccessPending={meta,rawCode,code:rawCode||newStaffCode(),idempotencyKey:crypto.randomUUID()});
      let result;try{result=await request('/staff-access',{name:b.name,role:b.role,phone:b.phone||'',notes:b.notes||'',code:draft.code,confirmed:true,idempotencyKey:draft.idempotencyKey},state.csrf);}catch(error){if(error.status>=400&&error.status<500)ui.staffAccessPending=null;throw error;}
      await refresh();if(scopeOf(state)!==scope)return;
      ui.staffAccessPending=null;ui.staffFormOpen=false;ui.staffAccessResult=route()==='staf'&&(ui.staffAccessEpoch||0)===epoch?{...result,code:draft.code}:null;values['staff-access-create']={};ui.staffFocus='.staff-code-result';
      notify('Staf disimpan. Salin kode unik sebelum menyembunyikannya.');
    }
    else if(kind==='staff-delete'){
      await request('/staff/'+b.id+'/delete',{confirmed:b.confirmed==='on'},state.csrf);
      ui.staffDelete=null;ui.staffAccessResult=null;await refresh();notify('Staf dihapus. Kode dan seluruh sesinya sudah dicabut.');
    }
    else if(kind==='staff-code-revoke'){
      const r=await request('/staff-invites/'+b.id+'/revoke',{confirmed:b.confirmed==='on'},state.csrf);ui.staffInviteRevoke=null;await refresh();
      notify(r.status==='used'?'Kode sudah dipakai. Gunakan Nonaktifkan untuk mengakhiri sesi staf.':'Kode masuk sudah tidak aktif. Sesi staf yang sudah masuk tidak diubah.');
    }
    else if(kind==='staff-create'){
      ui.staffLegacyOpen=true;
      const meta=JSON.stringify([b.name.trim(),b.email.trim().toLowerCase(),b.role]);
      if(ui.staffCreateKey&&ui.staffCreateMeta!==meta)throw new Error('Status pembuatan sebelumnya belum pasti. Perbarui daftar dan ulangi rincian staf yang sama.');
      ui.staffCreateKey??=crypto.randomUUID();ui.staffCreateMeta=meta;
      const r=await request('/staff',{name:b.name,email:b.email,role:b.role,password:b.password,confirmed:b.confirmed==='on',idempotencyKey:ui.staffCreateKey},state.csrf);
      ui.staffCreateKey=null;ui.staffCreateMeta=null;values['staff-create']={};ui.staffFocus='#staff-management-title';await refresh();notify(r.duplicate?'Akun sudah dibuat sebelumnya. Kata sandi tidak diubah oleh pengulangan.':'Akun staf dibuat. Berikan kredensial awal secara langsung kepada staf.');
    }
    else if(kind==='staff-update'){
      const target=ui.staffEdit;if(!target)throw new Error('Buka kembali pemeriksaan akses staf.');
      await request('/staff/'+target.id,{...target,role:target.action==='role'?b.role:undefined,confirmed:b.confirmed==='on'},state.csrf);
      ui.staffFocus=`[data-staff-heading="${CSS.escape(target.id)}"]`;ui.staffEdit=null;await refresh();notify('Akses staf diperbarui. Seluruh sesi staf tersebut dikeluarkan.');
    }
    else if(kind==='display-create'){
      if(b.confirmed!=='on')throw new Error(b.kind==='catalog'?'Setujui akses katalog terlebih dahulu.':'Setujui akses baca layar terlebih dahulu.');
      const current={kind:b.kind==='catalog'?'catalog':'display',label:b.label.trim(),durationHours:Number(b.durationHours),confirmed:true};
      if(ui.displayCreatePending&&(ui.displayCreatePending.kind!==current.kind||ui.displayCreatePending.label!==current.label||ui.displayCreatePending.durationHours!==current.durationHours))throw new Error('Status pembuatan sebelumnya belum pasti. Ulangi nama dan masa aktif yang sama atau perbarui halaman dan periksa daftar akses.');
      ui.displayCreatePending??={...current,token:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),idempotencyKey:crypto.randomUUID()};
      const draft=ui.displayCreatePending,creationEpoch=ui.displayEpoch||0,creationScope=scopeOf(state);
      try{
        const result=await request('/displays',draft,state.csrf);
        ui.displayCreatePending=null;values['display-create']={};
        ui.displayLink=result.status==='active'&&state&&scopeOf(state)===creationScope&&(ui.displayEpoch||0)===creationEpoch&&route()==='pengaturan'?{id:result.id,url:location.origin+(draft.kind==='catalog'?'/api/catalog/screen#':'/api/display/screen#')+draft.token,kind:draft.kind}:null;
        ui.displayFocus=ui.displayLink?'.display-link-result':'#display-management-title';await refresh();notify(result.status==='active'?'Tautan layar dibuat. Simpan sebelum meninggalkan halaman.':'Akses sebelumnya sudah tidak aktif. Buat tautan baru.');
      }catch(error){if(error.status>=400&&error.status<500)ui.displayCreatePending=null;throw error;}
    }
    else if(kind==='plan-interest'){await request('/account/plan-interest',{need:b.need,note:b.note||'',confirmed:b.confirmed==='on'},state.csrf);values['plan-interest']={};await refresh();notify('Kebutuhan paket tersimpan. Tidak ada biaya atau aktivasi paket.');}
    else if(kind==='kitchen-extract'){
      const scope=scopeOf(state),result=await request('/kitchen/extractions',{text:b.text,catalogRevision:state.catalogRevision},state.csrf);
      if(!state||scopeOf(state)!==scope)throw new Error('Akun berubah. Proses ulang pesanan pada akun yang sesuai.');
      const previous=values['kitchen-new']||{};values['kitchen-new']={label:previous.label||'',channel:previous.channel||'dine_in'};
      result.items.forEach((item,i)=>Object.assign(values['kitchen-new'],{['menuId-'+i]:item.id,['qty-'+i]:item.qty,['note-'+i]:item.note||''}));
      ui.kitchenItemCount=result.items.length;ui.kitchenExtraction={reason:result.reason,catalogRevision:result.catalogRevision,sourceText:b.text};ui.kitchenFocus={field:'menuId-0'};
      if(!isStaff())state.plan=await request('/account/plan');
      notify('Periksa hasil pada formulir. Pesanan belum dikirim ke dapur.');
    }
    else if(kind==='kitchen-new'){if(ui.kitchenExtraction&&ui.kitchenExtraction.catalogRevision!==state.catalogRevision)throw new Error('Katalog berubah. Proses ulang teks pesanan sebelum mengirim.');ui.kitchenFocus={queue:true};await durable('kitchenCreate','/kitchen/orders',{label:b.label,channel:b.channel,items:Array.from({length:Math.min(20,Number(b.itemCount)||1)},(_,i)=>({id:b['menuId-'+i],qty:Number(b['qty-'+i]),note:b['note-'+i]||''})),catalogRevision:state.catalogRevision,idempotencyKey:kitchenKey()},'Pesanan dapur: '+b.label);}
    else if(kind==='staff-extract'){const scope=scopeOf(state),result=await request('/kitchen/extractions',{text:b.text,catalogRevision:state.catalogRevision},state.csrf);if(!state||scopeOf(state)!==scope)throw new Error('Akun berubah. Proses ulang pesanan.');ui.staffReviewReason=result.reason;ui.staffReview=result.items;ui.staffReviewRevision=result.catalogRevision;values['staff-review']={label:'',channel:'takeaway'};}
    else if(kind==='kitchen-command'){ui.kitchenFocus={command:true};await runKitchenCommand(b.text);values['kitchen-command']={};}
    else if(kind==='kitchen-discard'){ui.kitchenFocus={queue:true};await durable('kitchenChange',`/kitchen/orders/${b.orderId}/actions`,{action:'discard',revision:Number(b.revision),confirmed:b.confirmed==='on',...kitchenWaste(b),idempotencyKey:crypto.randomUUID()},'Penutupan bahan terpakai');ui.kitchenDiscard=null;}
    else if(kind==='kitchen-void'){ui.kitchenFocus={order:b.orderId};await durable('kitchenChange',`/kitchen/orders/${b.orderId}/actions`,{action:'void',taskId:b.taskId,revision:Number(b.revision),confirmed:b.confirmed==='on',...kitchenWaste(b),idempotencyKey:kitchenKey()},'Pencatatan item terbuang');ui.kitchenVoid=null;}
    else if(kind==='request-reject'){await request(`/order-requests/${b.id}/decision`,{decision:'reject',reason:b.reason||''},state.csrf);ui.requestReject=null;await refresh();notify('Permintaan ditolak. Pelanggan melihat alasannya di katalog.');}
    else if(kind==='kitchen-station'){values['station:'+b.station]={...b};await request('/kitchen/stations',{station:b.station,cooks:Number(b.cooks),equipment:b.equipment===''?null:Number(b.equipment),agingMinutes:Number(b.agingMinutes),revision:Number(b.revision)},state.csrf);delete values['station:'+b.station];await refresh();notify('Kapasitas stasiun '+b.station+' tersimpan. Giliran antrean mengikuti kapasitas dan batas tunggu baru.');}
    else if(kind==='usage-decision'){const editor=ui.usageReview;if(!editor)throw new Error('Buka kembali pemeriksaan dari tanggal yang dipilih.');await request('/usage-reviews',{...editor,decision:b.decision,note:b.note||'',confirmed:b.confirmed==='on'},state.csrf);await refresh();ui.usageReview=null;values['usage-decision']={};notify('Hasil pemeriksaan tersimpan. Stok dan transaksi tidak diubah.');}
    else if(kind==='profile'){await request('/account/profile',{businessName:b.businessName},state.csrf);await refresh();values.profile={};notify('Nama usaha tersimpan.');}
    else if(kind==='withdraw'){await request('/withdrawals',{destinationType:b.destinationType,destinationDetail:b.destinationDetail,amount:Number(b.amount),idempotencyKey:crypto.randomUUID()},state.csrf);await refresh();values.withdraw={};notify('Penarikan berhasil (demo). Saldo sudah diperbarui.');}
    else if(kind==='password'){if(b.newPassword!==b.repeatPassword)throw new Error('Ulangan kata sandi baru belum sama.');const result=await request('/account/password',{currentPassword:b.currentPassword,newPassword:b.newPassword},state.csrf);await refresh();notify(`Kata sandi tersimpan. ${result.revokedSessions} sesi lain dikeluarkan.`);}
    else if(kind==='recovery-codes'){const result=await request('/account/recovery-codes',{confirmed:b.confirmed==='on'},state.csrf);ui.recoveryCodesResult=result.codes;await refresh();notify('Kode pemulihan baru dibuat. Salin dan simpan sekarang; kode lama tidak berlaku lagi.');}
    else if(kind==='community-create'){await request('/community/create',{communityName:b.communityName},state.csrf);await refresh();values['community-create']={};notify('Kelompok dibuat. Kode undangan siap dibagikan.');}
    else if(kind==='community-join'){
      if(pendingAction||deviceDrafts.length)throw new Error('Selesaikan atau hapus draft dan periksa catatan tertunda sebelum berpindah kelompok.');
      await request('/community/join',{inviteCode:b.inviteCode,confirmed:b.confirmed==='on',expectedWorkspace:state.workspaceId},state.csrf);
      await adopt(await request('/bootstrap'));values['community-join']={};notify('Berhasil bergabung. Periksa kebutuhan sebelum membagikannya ke kelompok.');
    }
    else if(kind==='community-settings'){await request('/community/settings',{communityName:b.communityName},state.csrf);await refresh();values['community-settings']={};notify('Nama kelompok tersimpan.');}
    else if(kind==='invite'){if(b.confirmed!=='on')throw new Error('Periksa dampak mengganti kode terlebih dahulu.');await request('/community/invite',{expectedCode:state.community.inviteCode},state.csrf);await refresh();values.invite={};notify('Kode undangan diganti. Bagikan kode terbaru kepada anggota baru.');}
    else if(kind==='ingredient'){payload={name:b.name,unit:b.unit,min:Number(b.min),storageNote:b.storageNote,catalogRevision:state.catalogRevision};await request('/ingredients'+(ui.editId?'/'+ui.editId:''),payload,state.csrf);await refresh();ui.editor=null;values.ingredient={};}
    else if(kind==='menu'){payload={name:b.name,price:Number(b.price),aliases:b.aliases.split(',').map(x=>x.trim()).filter(Boolean),recipe:Object.fromEntries(state.catalog.map(c=>[c.id,Number(b['recipe-'+c.id])]).filter(([,qty])=>qty>0)),catalogRevision:state.catalogRevision,preparation:{minutes:Number(b.minutes),passiveMinutes:Number(b.passiveMinutes),station:b.station}};await request('/menus'+(ui.editId?'/'+ui.editId:''),payload,state.csrf);await refresh();ui.editor=null;values.menu={};}
    else if(kind==='receipt'){const p=state.catalog.find(c=>c.id===b.productId);receiptMeasurement(p.unit,b.inputUnit,Number(b.qty),Number(b.unitPrice));await durable('receipt','/stock-receipts',{productId:b.productId,inputUnit:b.inputUnit,qty:Number(b.qty),unitPrice:Number(b.unitPrice),supplier:b.supplier,idempotencyKey:crypto.randomUUID()},`Penerimaan ${b.qty} ${b.inputUnit} ${p.name} pada ${m(Number(b.unitPrice))} per ${b.inputUnit}.`);}
    else if(kind==='extract'){const result=await request('/extractions',{text:b.text},state.csrf);ui.review=result.items;ui.reviewRevision=result.catalogRevision;ui.reviewId=null;ui.extractionReason=result.reason;}
    else if(kind==='quote'){payload={...b,unitPrice:Number(b.unitPrice),shipping:Number(b.shipping),minimum:Number(b.minimum),expiresAt:new Date(b.expiresAt).toISOString(),individualPrice:b.individualPrice===''?null:Number(b.individualPrice),individualShipping:b.individualShipping===''?null:Number(b.individualShipping)};await request('/community/quote',payload,state.csrf);await refresh();values.quote={};notify('Penawaran pemasok tersimpan dari rincian yang kamu masukkan.');}
    else if(kind==='usage-zero'||kind==='usage-zero-retract'){ui.usageZeroOpen=true;await request(kind==='usage-zero'?'/usage-zero-days':'/usage-zero-days/retract',{productId:b.productId,date:b.date,catalogRevision:state.catalogRevision,confirmed:kind==='usage-zero'?b.confirmed==='on':true,...(kind==='usage-zero-retract'?{id:b.id}:{})},state.csrf);if(values['usage-zero'])values['usage-zero'].confirmed=false;await refresh();notify(kind==='usage-zero'?'Pemakaian nol tersimpan. Stok dan transaksi tetap.':'Konfirmasi dibatalkan. Catatan asal transaksi tetap.');}
    else if(kind==='production-plan'){ui.productionPlannerOpen=true;ui.productionPlan=null;const items=state.menu.map(m=>({id:m.id,qty:Number(b['target-'+m.id]||0)})).filter(i=>i.qty!==0);ui.productionPlan=await request('/production-plan',{items,catalogRevision:state.catalogRevision},state.csrf);}
    else if(kind==='demand'){await request('/demand-consents',{qty:Number(b.qty),active:true,budget:b.budget===''?null:Number(b.budget)},state.csrf);await refresh();location.hash='kelompok';}
    else if(kind==='collective-receipt')await durable('collectiveReceipt',`/collective-orders/${state.group.purchase.id}/receipts`,{qty:Number(b.qty),idempotencyKey:crypto.randomUUID()},`Penerimaan ${b.qty} ${state.sharedProduct.unit} dari rencana kulakan.`);
    else if(kind==='offer')await durable('offer','/offers',{productId:state.sharedProduct.id,qty:Number(b.qty),unitPrice:Number(b.unitPrice),condition:b.condition,expiresInHours:Number(b.expiresInHours),cycle:state.group.cycle.id,idempotencyKey:crypto.randomUUID()},`Penawaran surplus ${b.qty} ${state.sharedProduct.unit}: ${b.condition}.`);
    else if(kind.startsWith('request-')){const offerId=kind.slice(8);await durable('requestTransfer',`/offers/${offerId}/request`,{qty:Number(b.qty)},`Permintaan ${b.qty} ${state.sharedProduct.unit} surplus.`,{offerId,before:state.transfers.map(t=>t.id)});}
    else if(kind==='cancel'){const c=ui.cancel,reason=b.reason?.trim();if(b.confirmed!=='on')throw new Error('Konfirmasi dampak koreksi terlebih dahulu.');if(c.kind!=='cancelSale'&&(!reason||reason.length<5||reason.length>240))throw new Error('Isi alasan dalam 5–240 karakter.');await durable(c.kind,c.path,c.kind==='cancelSale'?{}:{reason},`Pembatalan catatan. ${reason||'Mengembalikan bahan sesuai resep transaksi.'}`,{id:c.id});}
  }catch(err){error=err.message;if(kind==='kitchen-station'&&err.status===409){try{await refresh();}catch{}}if(kind==='staff-create'&&err.status>=400&&err.status<500){ui.staffCreateKey=null;ui.staffCreateMeta=null;}if(err.status===401){clearDisplaySecrets();state=null;ui.auth='login';ui.error='Sesi berakhir. Masuk lagi untuk melanjutkan.';}if(err.transport)connected=false;}
  finally{if(!state)clearVoice();busy=false;render();if(error&&state)showFormError(kind,error,kind==='kitchen-station'?b.station:undefined);}
});
document.addEventListener('click',async event=>{
  const toggle=event.target.closest('.password-toggle');
  if(toggle){
    event.preventDefault();
    const wrap=toggle.closest('.password-input-wrap');
    const input=wrap?.querySelector('input');
    if(input){
      const isPass=input.type==='password';
      input.type=isPass?'text':'password';
      toggle.setAttribute('aria-label',isPass?'Sembunyikan kata sandi':'Lihat kata sandi');
      toggle.innerHTML=icon(isPass?'eye-off':'eye');
      input.focus();
    }
    return;
  }
  const b=event.target.closest('[data-action]');if(!b)return;event.preventDefault();const action=b.dataset.action;if(action==='kitchen-listen'&&ui.kitchenHandsfree){clearVoice();render();return;}if(busy)return;
  if(isStaff()){const focused=staffFocusBefore();if(focused)ui.staffRestoreFocus=focused;}
  if(action==='staff-filter'){if(!isStaff())return;ui.staffQueueFilter=b.dataset.filter;render();return;}
  if(action==='staff-new-order'||action==='staff-queue'){
    const target=action==='staff-new-order'?(document.querySelector('[data-form="staff-extract"] [name="text"]')||document.querySelector('#staff-order-entry')):document.querySelector('#kitchen-queue-title');
    if(target){target.focus({preventScroll:true});const header=document.querySelector('.staff-shell .topbar');scrollBy({top:target.getBoundingClientRect().top-(header?.getBoundingClientRect().bottom||0)-32,behavior:'instant'});}ui.staffRestoreFocus=null;return;
  }
  if(['show-login','show-register','show-staff-code','show-recover'].includes(action)){ui.auth=action==='show-login'?'login':action==='show-staff-code'?'staff':action==='show-recover'?'recover':'register';ui.error='';render();return;}
  if(action==='create-community'||action==='join-community'){ui.joining=action==='join-community';render();return;}
  if(action==='staff-add'){ui.staffFormOpen=true;ui.staffAccessResult=null;render();document.querySelector('[data-form="staff-access-create"] [name="name"]')?.focus();return;}
  if(action==='staff-add-cancel'){ui.staffFormOpen=false;values['staff-access-create']={};render();document.querySelector('[data-action="staff-add"]')?.focus();return;}
  if(action==='staff-access-hide'){ui.staffAccessResult=null;render();document.querySelector('#staff-management-title')?.focus();return;}
  if(action==='staff-delete-review'){const target=state?.staff?.find(a=>a.id===b.dataset.id);if(target){ui.staffDelete=target;render();document.querySelector('[data-form="staff-delete"] input[name="confirmed"]')?.focus();}return;}
  if(action==='staff-delete-cancel'){ui.staffDelete=null;render();return;}
  if(action==='theme'){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('gerai-theme',theme);}catch{}if(!state)render();return;}
  if(['staff-invite-review','staff-code-cancel','staff-code-hide','staff-code-copy','staff-code-revoke','staff-code-cancel-revoke'].includes(action)){
    if(!state||isStaff())return;
    if(action==='staff-code-copy'){
      if(!ui.staffCodeResult||Date.parse(ui.staffCodeResult.expiresAt)<=Date.now()){clearStaffCode();render();notify('Kode tidak lagi aktif. Buat kode baru jika diperlukan.');return;}
      try{await navigator.clipboard.writeText(ui.staffCodeResult.code.slice(0,4)+'-'+ui.staffCodeResult.code.slice(4));notify('Kode disalin. Bagikan bersama alamat masuk staf.');}catch{notify('Pilih dan salin kode yang ditampilkan.');}return;
    }
    if(action==='staff-code-hide'||action==='staff-code-cancel'){clearStaffPairing();render();document.querySelector('#staff-code-create-title')?.focus();notify('Kode disembunyikan. Periksa daftar sebelum membuat staf baru; gunakan Buat kode masuk untuk staf yang sama.');return;}
    if(action==='staff-code-cancel-revoke'){ui.staffInviteRevoke=null;ui.staffCodeHistoryOpen=true;render();return;}
    if(!connected||busy||pendingAction)return;
    if(action==='staff-code-revoke'){ui.staffInviteRevoke=b.dataset.id;ui.staffCodeHistoryOpen=true;render();document.querySelector('[data-form="staff-code-revoke"] input[name="confirmed"]')?.focus();return;}
    if(ui.staffInvitePending){notify('Status kode sebelumnya belum pasti. Ulangi rincian yang sama atau tutup pemeriksaan lalu periksa daftar staf.');return;}
    const a=state.staff?.find(a=>a.id===b.dataset.id);if(!a||a.disabled)return;
    clearStaffCode();ui.staffEdit=null;ui.staffInviteTarget={id:a.id,revision:a.revision};render();document.querySelector('[data-form="staff-code-existing"] input[name="confirmed"]')?.focus();return;
  }
  if(action==='staff-review'){
    const target=state?.staff?.find(a=>a.id===b.dataset.id);if(!target)return;
    ui.staffEdit={id:target.id,revision:target.revision,action:b.dataset.step,idempotencyKey:crypto.randomUUID()};render();document.querySelector('[data-form="staff-update"] input[name="confirmed"]')?.focus();return;
  }
  if(action==='staff-cancel-review'){const id=ui.staffEdit?.id;ui.staffEdit=null;render();document.querySelector(`[data-staff-heading="${CSS.escape(id||'')}"]`)?.focus();return;}
  if(action==='display-copy'){try{await navigator.clipboard.writeText(ui.displayLink?.url||'');notify('Tautan layar disalin. Bagikan hanya untuk layar yang diizinkan.');}catch{notify('Salin tautan yang ditampilkan.');}return;}
  if(action==='display-hide-link'){ui.displayLink=null;render();document.querySelector('#display-management-title')?.focus();return;}
  if(action==='display-revoke'){ui.displayRevoke=b.dataset.id;render();document.querySelector('[data-action="display-confirm-revoke"]')?.focus();return;}
  if(action==='display-cancel-revoke'){const id=ui.displayRevoke;ui.displayRevoke=null;render();document.querySelector(`[data-action="display-revoke"][data-id="${CSS.escape(id)}"]`)?.focus();return;}
  if(action==='menu'){ui.mobile=!ui.mobile;render();return;}
  if(action==='update-app'){registration?.waiting?.postMessage('ACTIVATE_UPDATE');return;}
  if(!state)return;
  if(action==='kitchen-clear-ai'){ui.kitchenExtraction=null;render();document.querySelector('[data-form="kitchen-new"] [name="label"]')?.focus();return;}
  if(action==='kitchen-add-item'||action==='kitchen-remove-item'){ui.kitchenItemCount=Math.max(1,Math.min(20,(ui.kitchenItemCount||1)+(action==='kitchen-add-item'?1:-1)));ui.kitchenFocus={field:'menuId-'+(ui.kitchenItemCount-1)};render();return;}
  if(action==='kitchen-close-discard'){ui.kitchenFocus={order:ui.kitchenDiscard};ui.kitchenDiscard=null;render();return;}
  if(action==='request-open-reject'){ui.requestReject=b.dataset.id;render();document.querySelector('[data-form="request-reject"] [name="reason"]')?.focus();return;}
  if(action==='request-close-reject'){const id=ui.requestReject;ui.requestReject=null;render();document.querySelector(`[data-request="${CSS.escape(id||'')}"] strong`)?.focus();return;}
  if(action==='kitchen-close-void'){ui.kitchenFocus={order:ui.kitchenVoid?.order,task:ui.kitchenVoid?.task};ui.kitchenVoid=null;render();return;}
  if(action==='kitchen-listen'){
    if(ui.kitchenHandsfree){clearVoice();render();return;}
    if(!connected||pendingAction||route()!=='dapur')return;
    ui.kitchenHandsfree=true;ui.kitchenCommandResult='Kendali suara aktif. Ucapkan satu perintah tiap rekaman.';await voice.start();return;
  }
  if(action==='kitchen-action'&&b.dataset.step==='open-discard'){ui.kitchenDiscard=b.dataset.id;ui.kitchenVoid=null;ui.kitchenFocus={discard:true};render();return;}
  if(action==='kitchen-action'&&b.dataset.step==='open-void'){ui.kitchenVoid={order:b.dataset.id,task:b.dataset.task};ui.kitchenDiscard=null;ui.kitchenFocus={void:true};render();return;}
  if(action.startsWith('voice-')){
    if(action==='voice-cancel'){voice.cancel();notify('Suara dibatalkan. Catatan yang kamu ketik tetap tersedia.');return;}
    if(action==='voice-stop'){voice.stop();return;}
    if(!connected||pendingAction||!['pesanan','dapur'].includes(route())||isStaff()&&state.account.role!=='cashier')return;
    if(action==='voice-start'&&state.speech?.available){await voice.start();return;}
    if(action==='voice-use'&&voice.state.phase==='review'){
      const form=isStaff()?'staff-extract':route()==='dapur'?'kitchen-extract':'extract';
      const text=voice.state.text.trim(),before=values[form]?.text||'';
      if(!text){notify('Periksa hasil ucapan terlebih dahulu.');return;}
      const combined=before.trim()?before.trim()+'\n'+text:text;
      if(combined.length>2000){notify('Gabungan teks melebihi 2.000 karakter. Ringkas catatan sebelum menambahkan hasil suara.');return;}
      values[form]={...values[form],text:combined};clearVoice();render();document.querySelector(form==='staff-extract'?'#staff-order-text':form==='kitchen-extract'?'#kitchen-order-text':'#order-text')?.focus();return;
    }
    return;
  }
  if(action==='copy-invite'){try{await navigator.clipboard.writeText(state.community.inviteCode);notify('Kode kelompok disalin.');}catch{notify('Salin kode yang ditampilkan pada pengaturan kelompok.');}return;}
  if(action==='recovery-copy'){if(!ui.recoveryCodesResult){render();return;}try{await navigator.clipboard.writeText(ui.recoveryCodesResult.join('\n'));notify('Kode pemulihan disalin. Simpan di tempat aman di luar aplikasi.');}catch{notify('Salin kode yang ditampilkan.');}return;}
  if(action==='recovery-hide'){ui.recoveryCodesResult=null;render();document.querySelector('#recovery-section h2')?.focus?.();notify('Kode pemulihan disembunyikan. Pastikan sudah kamu simpan.');return;}
  if(action.startsWith('export-')){if(action==='export-sales')csv('penjualan.csv',salesRows(state.transactions));else csv('barang-masuk.csv',[['ID','Bahan','Jumlah stok','Satuan stok','Jumlah diterima asli','Satuan diterima asli','Harga satuan diterima','Total','Status','Alasan'],...state.stockReceipts.map(r=>[r.id,r.product_name,r.qty,r.product_unit,r.input_quantity==null?r.qty:r.input_quantity/10000,r.input_unit||r.product_unit,r.input_unit_price??r.unit_price,r.total,r.cancelled_at?'Dibatalkan':'Diterima',r.cancel_reason])]);return;}
  if(pendingAction&&!['reconnect','refresh','retry-action','logout'].includes(action)){notify('Periksa catatan tertunda terlebih dahulu.');return;}
  if(['new-ingredient','edit-ingredient','new-menu','edit-menu','new-receipt'].includes(action)){if(!connected)return;const type=action.includes('ingredient')?'ingredient':action.includes('menu')?'menu':'receipt';ui.editor=type;ui.editId=b.dataset.id||null;values[type]={};render();document.querySelector('.inventory-editor')?.scrollIntoView({block:'start'});return;}
  if(action==='close-editor'){ui.editor=null;render();return;}
  if(action==='open-usage-review'){
    if(!connected)return;
    const row=state.usageReviews?.find(item=>item.productId===b.dataset.product)?.dates.find(item=>item.date===b.dataset.date);
    if(!row?.screened)return;
    ui.usageReview={productId:b.dataset.product,date:row.date,snapshotHash:row.snapshotHash,expectedReviewId:row.saved?.id??null,idempotencyKey:crypto.randomUUID()};
    values['usage-decision']={decision:row.saved?.decision||'checked',note:row.saved?.note||'',confirmed:false};render();
    document.querySelector('#usage-decision-title')?.focus();return;
  }
  if(action==='close-usage-review'){ui.usageReview=null;values['usage-decision']={};render();return;}
  if(action==='manual-order'){clearVoice();ui.review=[{id:state.menu[0].id,qty:1,note:''}];ui.reviewRevision=state.catalogRevision;ui.reviewId=null;ui.extractionReason='Input manual. Periksa menu, jumlah dan resep sebelum konfirmasi.';render();return;}
  if(action==='staff-manual-order'){ui.staffReview=[{id:state.menu[0]?.id,qty:1,note:''}];ui.staffReviewRevision=state.catalogRevision;ui.staffReviewReason='Input manual. Periksa rincian sebelum mencatat.';values['staff-review']={label:'',channel:'takeaway'};render();return;}
  if(action==='staff-back-order'){ui.staffReview=null;render();return;}
  if(action==='staff-add-item'){if(ui.staffReview?.length<20)ui.staffReview.push({id:state.menu[0]?.id,qty:1,note:''});render();return;}
  if(action==='staff-remove-item'){if(ui.staffReview?.length>1)ui.staffReview.pop();render();return;}
  if(action==='staff-submit-queue'||action==='staff-direct-sale'){
    if(!ui.staffReview?.length)return;
    const review=values['staff-review']||{},items=structuredClone(ui.staffReview);
    if(ui.staffReviewRevision!==state.catalogRevision)return notify('Katalog berubah. Proses ulang pesanan sebelum mengirim.');
    if(items.some(i=>!i.id||!Number.isInteger(i.qty)||i.qty<1||i.qty>99||i.note?.length>500))return notify('Periksa menu, jumlah 1–99, dan catatan setiap item.');
    busy=true;lockControls();
    try{
      if(action==='staff-submit-queue'){
        if(!review.label?.trim())throw new Error('Isi label pesanan atau meja.');
        await durable('kitchenCreate','/kitchen/orders',{label:review.label.trim(),channel:review.channel||'takeaway',items,catalogRevision:ui.staffReviewRevision,idempotencyKey:kitchenKey()},'Pesanan dapur: '+review.label.trim());
      }else{
        await durable('staffSale','/transactions',{items,catalogRevision:ui.staffReviewRevision,idempotencyKey:kitchenKey()},'Penjualan langsung: '+items.map(i=>`${i.qty} ${state.menu.find(m=>m.id===i.id)?.name||i.id}`).join(', '));
      }
      if(!pendingAction){ui.staffReview=null;ui.staffReviewReason=null;values['staff-extract']={};values['staff-review']={};}
    }catch(err){notify(err.message);}finally{busy=false;render();}return;
  }
  if(action==='staff-pay'){ui.staffPayOrigin=staffFocusBefore();
    const kind=b.dataset.kind;
    if(kind==='complete'){
      const o=state.kitchen?.orders.find(x=>x.id===b.dataset.id);if(!o)return;
      ui.pay={kind:'complete',orderId:o.id,revision:Number(b.dataset.revision),items:o.items.filter(i=>!i.voided).map(i=>({name:i.name,qty:i.qty,unitPrice:i.unitPrice})),total:o.total,label:o.label,method:null};
    }else{
      if(!ui.staffReview?.length)return;
      if(ui.staffReviewRevision!==state.catalogRevision)return notify('Katalog berubah. Proses ulang pesanan sebelum mengirim.');
      const items=structuredClone(ui.staffReview);
      if(items.some(i=>!i.id||!Number.isInteger(i.qty)||i.qty<1||i.qty>99||i.note?.length>500))return notify('Periksa menu, jumlah 1–99, dan catatan setiap item.');
      const detailed=items.map(i=>{const mnu=state.menu.find(m=>m.id===i.id);return {id:i.id,qty:i.qty,note:i.note||'',name:mnu?.name||i.id,unitPrice:mnu?.price||0};});
      ui.pay={kind:'direct',rawItems:items.map(i=>({id:i.id,qty:i.qty,note:i.note||''})),items:detailed,total:detailed.reduce((a,i)=>a+i.unitPrice*i.qty,0),label:(values['staff-review']||{}).label||'',revision:ui.staffReviewRevision,method:null};
    }
    render();document.querySelector('#pay-title')?.focus();return;
  }
  if(action==='pay-method'){if(ui.pay){ui.pay.method=b.dataset.method;render();document.querySelector('[data-action="pay-confirm"]')?.focus();}return;}
  if(action==='pay-cancel'){const origin=ui.staffPayOrigin;ui.pay=null;ui.staffPayOrigin=null;render();restoreStaffFocus(origin);return;}
  if(action==='close-receipt'){ui.receipt=null;render();return;}
  if(action==='print-receipt'){window.print();return;}
  if(action==='pay-confirm'){
    const p=ui.pay;if(!p?.method)return;
    busy=true;lockControls();
    try{
      if(p.kind==='complete')await durable('kitchenChange',`/kitchen/orders/${p.orderId}/actions`,{action:'complete',revision:p.revision,paymentMethod:p.method,idempotencyKey:kitchenKey()},'Pembayaran & penyerahan: '+p.label);
      else await durable('staffSale','/transactions',{items:p.rawItems,catalogRevision:p.revision,paymentMethod:p.method,idempotencyKey:kitchenKey()},'Penjualan langsung: '+p.items.map(i=>`${i.qty} ${i.name}`).join(', '));
      if(!pendingAction){
        ui.receipt={businessName:state.business.name,cashier:state.account.name,items:p.items,total:p.total,label:p.label,paymentMethod:p.method,fee:Math.round(p.total*0.1),created_at:new Date().toISOString(),id:p.orderId||crypto.randomUUID()};
        if(p.kind==='direct'){ui.staffReview=null;ui.staffReviewReason=null;values['staff-extract']={};values['staff-review']={};}
      }
    }catch(err){notify(err.message);}finally{ui.pay=null;busy=false;render();}
    return;
  }
  if(action==='back-order'){ui.review=null;render();return;}
  if(action==='add-order'){ui.review.push({id:state.menu[0].id,qty:1,note:''});ui.reviewId=null;render();return;}
  if(action==='remove-order'){if(ui.review.length>1)ui.review.splice(Number(b.dataset.index),1);ui.reviewId=null;render();return;}
  if(action==='resume-draft'){const d=deviceDrafts.find(d=>d.id===b.dataset.id);ui.review=structuredClone(d.payload.items);ui.reviewRevision=d.payload.catalogRevision;ui.reviewId=d.id;render();return;}
  if(action==='close-cancel'){ui.cancel=null;render();return;}
  if(['cancel-sale','cancel-receipt','cancel-collective-receipt'].includes(action)){const id=b.dataset.id,kind=action==='cancel-sale'?'cancelSale':action==='cancel-receipt'?'cancelReceipt':'cancelCollectiveReceipt';ui.cancel={id,kind,path:kind==='cancelSale'?`/transactions/${id}/cancel`:kind==='cancelReceipt'?`/stock-receipts/${id}/cancel`:`/collective-orders/${state.group.purchase.id}/receipts/${id}/cancel`};values.cancel={};location.hash='riwayat';render();return;}
  busy=true;lockControls();
  try{
    if(action==='display-confirm-revoke'){await request(`/displays/${b.dataset.id}/revoke`,{},state.csrf);if(ui.displayLink?.id===b.dataset.id)ui.displayLink=null;ui.displayRevoke=null;ui.displayFocus='#display-management-title';await refresh();notify('Akses layar dicabut. Layar terkait akan menutup status pesanan.');}
    else if(action==='request-accept'){const result=await request(`/order-requests/${b.dataset.id}/decision`,{decision:'accept'},state.csrf);await refresh();ui.kitchenFocus={order:result.orderId};notify('Permintaan masuk antrean dapur. Bahan sudah dicadangkan.');}
    else if(action==='kitchen-action'){ui.kitchenFocus={order:b.dataset.id,task:b.dataset.task};await durable('kitchenChange',`/kitchen/orders/${b.dataset.id}/actions`,{action:b.dataset.step,taskId:b.dataset.task||null,revision:Number(b.dataset.revision),idempotencyKey:kitchenKey()},'Perubahan tahap dapur');}
    else if(action==='reconnect'||action==='refresh'){await refresh();if(!ui.kitchenLive){kitchenEvents?.close();kitchenEvents=null;kitchenEventScope='';}}
    else if(action==='retry-action'){const original=pendingAction;await refresh();if(pendingAction){if(original.scope!==scopeOf(state))throw new Error('Masuk ke akun asal untuk memeriksa catatan.');await sendAction(original);}else notify('Catatan ditemukan di server. Tidak dikirim dua kali.');}
    else if(action==='kitchen-station-latest'){const station=b.dataset.station;delete values['station:'+station];ui.stationFocus=station;}
    else if(action==='logout'){clearDisplaySecrets();clearVoice();await request('/auth/logout',{},state.csrf);let storageWarning='';try{await clearSnapshot();}catch{storageWarning='Kamu sudah keluar. Penyimpanan perangkat belum dapat dibersihkan; tutup tab ini jika memakai perangkat bersama.';}state=null;pendingAction=null;values={};deviceDrafts=[];ui.displayLink=null;ui.displayCreatePending=null;ui.displayRevoke=null;ui.auth='login';ui.review=null;ui.editor=null;ui.cancel=null;ui.usageReview=null;ui.pay=null;ui.receipt=null;ui.recoveryCodesResult=null;ui.error='';document.querySelector('#toast').hidden=true;if(storageWarning)notify(storageWarning);}
    else if(action==='confirm-order')await confirmOrder();
    else if(action==='review-catalog'){await refresh();ui.reviewRevision=state.catalogRevision;}
    else if(action==='delete-draft'){await removeDraft(b.dataset.id,true);deviceDrafts=(await listDrafts()).filter(d=>d.scope===scopeOf(state));}
    else if(action==='approve'||action==='decline'){await request('/proposal/approval',{version:state.group.version,decision:action==='approve'?'accepted':'declined'},state.csrf);await refresh();}
    else if(action==='withdraw-demand'){await request('/demand-consents',{qty:state.demand,active:false,budget:state.budget},state.csrf);await refresh();}
    else if(action==='finalize')await durable('finalize','/collective-orders',{cycle:state.group.cycle.id,version:state.group.version},'Menyimpan rencana sesuai persetujuan.',{cycle:state.group.cycle.id});
    else if(action==='next-cycle')await durable('nextCycle','/collective-cycles/next',{cycle:state.group.cycle.id,version:state.group.version},'Membuka siklus baru setelah siklus ini selesai.',{cycle:state.group.cycle.id});
    else if(action==='cancel-plan')await durable('cancelPlan',`/collective-orders/${state.group.purchase.id}/cancel`,{},'Membatalkan rencana tanpa penerimaan aktif.',{id:state.group.purchase.id});
    else if(action==='withdraw-offer'){await request(`/offers/${b.dataset.id}/withdraw`,{},state.csrf);await refresh();}
    else if(action==='approve-transfer'||action==='cancel-transfer')await durable('transferDecision',`/transfers/${b.dataset.id}/${action==='approve-transfer'?'approval':'cancel'}`,{},action==='approve-transfer'?'Menyetujui pemindahan stok surplus.':'Membatalkan permintaan surplus.',{id:b.dataset.id,status:action==='approve-transfer'?'completed':'cancelled'});
  }catch(err){if(err.transport)connected=false;if(err.status===401){clearDisplaySecrets();state=null;ui.auth='login';ui.error='Masuk lagi untuk melanjutkan.';}notify(err.message);}
  finally{if(!state)clearVoice();busy=false;render();}
});
window.addEventListener('hashchange',()=>{ui.recoveryCodesResult=null;ui.staffAccessEpoch=(ui.staffAccessEpoch||0)+1;ui.staffAccessResult=null;ui.staffDelete=null;ui.staffFormOpen=false;clearStaffPairing();ui.staffCreateKey=null;ui.staffCreateMeta=null;ui.staffEdit=null;ui.displayEpoch=(ui.displayEpoch||0)+1;ui.displayLink=null;ui.displayCreatePending=null;ui.displayRevoke=null;clearVoice();ui.mobile=false;render();scrollTo(0,0);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&ui.mobile){ui.mobile=false;render();document.querySelector('[data-action="menu"]')?.focus();}});
window.addEventListener('gerai:connection-lost',()=>{clearVoice();connected=false;});
window.addEventListener('offline',()=>{clearVoice();connected=false;if(state)render();});
window.addEventListener('pagehide',()=>{clearVoice();kitchenEvents?.close();kitchenEvents=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&voice.active){clearVoice();if(state)render();}});
window.addEventListener('online',()=>{if(!connected)notify('Koneksi tersedia. Hubungkan untuk memeriksa catatan; tidak ada pengiriman otomatis.');});
let updateReload=false;navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(registration&&!updateReload){updateReload=true;location.reload();}});
registerPwa(r=>{registration=r;showUpdatePrompt();});
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
try{document.documentElement.dataset.theme=localStorage.getItem('gerai-theme')||(systemTheme.matches?'dark':'light');}catch{document.documentElement.dataset.theme=systemTheme.matches?'dark':'light';}
systemTheme.addEventListener('change',()=>{try{if(!localStorage.getItem('gerai-theme'))document.documentElement.dataset.theme=systemTheme.matches?'dark':'light';}catch{}});
function restoreKitchenFocus(){
  const focus=ui.kitchenFocus;if(!focus||route()!=='dapur')return;ui.kitchenFocus=null;
  let target;
  if(focus.command)target=document.querySelector('[data-form="kitchen-command"] [name="text"]');
  else if(focus.field)target=document.querySelector(`[data-form="kitchen-new"] [name="${CSS.escape(focus.field)}"]`);
  else if(focus.discard)target=document.querySelector('[data-form="kitchen-discard"] [name="confirmed"]');
  else if(focus.void)target=document.querySelector('[data-form="kitchen-void"] input:not([type="hidden"])');
  else if(focus.task){const task=document.querySelector(`[data-kitchen-task="${CSS.escape(focus.task)}"]`);target=task?.querySelector('button:not(:disabled)')||task?.querySelector('strong');}
  if(!target&&focus.order)target=document.querySelector(`[data-kitchen-order="${CSS.escape(focus.order)}"] h3`);
  (target||document.querySelector('#kitchen-queue-title'))?.focus({preventScroll:true});
}
// Owner forms send per-ingredient amounts; staff forms have no inputs and record the full item.
function kitchenWaste(b){const entries=Object.entries(b).filter(([k])=>k.startsWith('waste-')).map(([k,v])=>[k.slice(6),Number(v)]);return entries.length?{wasted:Object.fromEntries(entries)}:{};}
async function runKitchenCommand(text,revisions=Object.fromEntries((state.kitchen?.orders||[]).map(o=>[o.id,o.revision])),voiceEpoch=null){
  const commandScope=scopeOf(state);
  const resolved=await request('/kitchen/commands',{text,revisions},state.csrf);
  if(!state||scopeOf(state)!==commandScope||voiceEpoch!==null&&(voiceEpoch!==kitchenVoiceEpoch||!ui.kitchenHandsfree||route()!=='dapur'||document.hidden))throw new Error('Kendali suara dihentikan. Perintah belum dikirim.');
  await durable('kitchenChange',`/kitchen/orders/${resolved.id}/actions`,{action:resolved.action,taskId:resolved.taskId,revision:resolved.revision,idempotencyKey:kitchenKey()},'Perubahan tahap dapur dari perintah');
  ui.kitchenCommandResult='Tahap diperbarui: '+resolved.menu+' · '+resolved.label;
}
async function runSpokenKitchenCommand(){
  if(!ui.kitchenHandsfree||route()!=='dapur'||busy||!connected)return;
  busy=true;lockControls();
  try{await runKitchenCommand(voice.state.text,kitchenRecordingRevisions,kitchenVoiceEpoch);}
  catch(error){ui.kitchenCommandResult=error.message;ui.kitchenHandsfree=false;notify(error.message);}
  finally{voice.reset();ui.voice=voice.state;busy=false;render();if(ui.kitchenHandsfree&&!pendingAction)kitchenVoiceTimer=setTimeout(()=>{if(ui.kitchenHandsfree&&connected&&route()==='dapur')voice.start();},1000);}
}
function syncKitchenEvents(){
  const key=state&&connected?scopeOf(state):'';
  if(key===kitchenEventScope&&kitchenEvents)return;
  kitchenEvents?.close();kitchenEvents=null;kitchenEventScope=key;ui.kitchenLive=false;
  if(!key)return;
  const stream=kitchenEvents=new EventSource('/api/kitchen/events');
  stream.onopen=()=>{ui.kitchenLive=true;const el=document.querySelector('#kitchen-live-status');if(el)el.textContent='Pembaruan langsung aktif';};
  stream.onerror=()=>{if(isStaff())request('/bootstrap').then(async data=>{await adopt(data);render();}).catch(error=>{if(error.status===401){clearDisplaySecrets();clearVoice();state=null;values={};pendingAction=null;ui.auth='login';ui.error='Akses staf berakhir atau berubah. Masuk lagi atau hubungi pemilik.';render();}else if(error.transport){connected=false;clearVoice();render();}});ui.kitchenLive=false;const el=document.querySelector('#kitchen-live-status');if(el)el.textContent='Pembaruan terputus · status mungkin lama. Mencoba terhubung; gunakan Perbarui status atau Perbarui data.';};
  stream.onmessage=async event=>{
    if(busy||voice.active||pendingAction||kitchenUpdating||!state||scopeOf(state)!==key)return;
    const canRender=['dapur','layanan'].includes(route())&&!document.querySelector('#main input:focus,#main select:focus,#main textarea:focus')&&!ui.kitchenDiscard&&!ui.kitchenVoid&&!ui.requestReject;
    const data=JSON.parse(event.data);if(data.revision===state.kitchen?.revision){if(kitchenRenderPending&&canRender){kitchenRenderPending=false;render();}return;}
    kitchenUpdating=true;
    try{await refresh();kitchenRenderPending=true;if(canRender){kitchenRenderPending=false;render();}}catch(error){if(error.status===401){clearDisplaySecrets();clearVoice();state=null;ui.auth='login';kitchenEvents?.close();kitchenEvents=null;kitchenEventScope='';render();}}finally{kitchenUpdating=false;}
  };
}
async function initialize(){
  try{await adopt(await request('/bootstrap'));render();}
  catch(err){if(err.transport){try{const snapshot=await readSnapshot();if(snapshot?.data.mode==='live'){state=snapshot.data;connected=false;snapshotAt=snapshot.savedAt;pendingAction=await readAction(scopeOf(state));deviceDrafts=(await listDrafts()).filter(d=>d.scope===scopeOf(state));render();return;}}catch{}ui.error='Server belum terhubung. Buka aplikasi saat server aktif untuk masuk.';}else if(err.status!==401)ui.error=err.message;render();}
}
initialize();

document.addEventListener('toggle',event=>{
  const el=event.target;if(!el.isConnected)return;
  for(const [selector,key] of [['details.usage-zero-panel','usageZeroOpen'],['details.production-planner','productionPlannerOpen'],['details.staff-finance','staffFinanceOpen'],['details.usage-review','usagePanelOpen'],['details.kulakan-model','kulakanModelOpen']])if(el.matches(selector))ui[key]=el.open;
},true);
document.addEventListener('keydown',event=>{
  const modal=document.querySelector('.staff-shell .overlay[role="dialog"]');if(!modal)return;
  if(event.key==='Escape'&&ui.pay&&!busy&&!pendingAction){event.preventDefault();const origin=ui.staffPayOrigin;ui.pay=null;ui.staffPayOrigin=null;render();restoreStaffFocus(origin);return;}
  if(event.key!=='Tab')return;
  const controls=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
  if(!controls.length)return;
  const first=controls[0],last=controls.at(-1),current=document.activeElement;
  if(event.shiftKey&&(current===first||!controls.includes(current))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(current===last||!controls.includes(current))){event.preventDefault();first.focus();}
});
