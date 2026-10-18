import {icon} from './icons.js';
import {GUIDE_TOPICS,PAGE_TOPICS,findTopic} from './guide-content.js';
import {emptyGuideProgress,readGuideProgress,writeGuideProgress} from './guide-state.js';
import {guideLayout} from './guide-layout.js';

export function createGuideController({getContext,navigate,notify,escape,consumeNewAccount=()=>{},storage=()=>window.localStorage}){
  const root=document.createElement('div');root.id='guide-root';document.body.append(root);
  const memory=new Map();let scope=null,progress=emptyGuideProgress(),active=false,highlight=null,lastStep='',storageWarned=false,frame=0;
  const e=escape;
  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>schedulePosition()):null;
  function visibleTarget(selector){return selector?[...document.querySelectorAll(selector)].find(node=>node.getClientRects().length>0):null;}
  function pointRect(){
    if(!highlight)return null;
    let node=highlight,rect=node.getBoundingClientRect();
    if(rect.height>innerHeight*.3){const heading=visibleTargetInside(node);if(heading){node=heading;rect=node.getBoundingClientRect();}}
    return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};
  }
  function visibleTargetInside(node){return [...node.querySelectorAll('h1,h2,h3,legend,label,summary')].find(child=>child.getClientRects().length>0);}
  function positionTour(){
    frame=0;if(!active)return;
    const panel=root.querySelector('.guide-tour'),overlay=root.querySelector('.guide-overlay');if(!panel||!overlay)return;
    const mobile=innerWidth<=760,context=getContext();
    const vw=document.documentElement.clientWidth||innerWidth,vh=document.documentElement.clientHeight||innerHeight;
    const isButton=Boolean(highlight?.matches('button,[role="button"],.icon-button,.guide-access'));
    const viewport={width:vw,height:vh,topInset:context.signedIn?82:12,bottomInset:mobile&&context.signedIn?88:12,focusPadding:isButton?2:6};
    const size=panel.getBoundingClientRect(),layout=guideLayout(pointRect(),{width:size.width,height:size.height},viewport);
    for(const [property,value] of Object.entries({left:layout.x+'px',top:layout.y+'px',width:layout.width+'px',maxHeight:layout.maxHeight+'px'}))if(panel.style[property]!==value)panel.style[property]=value;
    panel.dataset.placement=layout.side;overlay.setAttribute('viewBox',`0 0 ${vw} ${vh}`);
    const outer=`M 0 0 H ${vw} V ${vh} H 0 Z`;
    const r=layout.focus;
    const rx=isButton?10:8;
    const safeRx=r?Math.min(rx,Math.floor(r.width/2),Math.floor(r.height/2)):0;
    const hole=r?(safeRx>0?` M ${r.left+safeRx} ${r.top} H ${r.right-safeRx} A ${safeRx} ${safeRx} 0 0 1 ${r.right} ${r.top+safeRx} V ${r.bottom-safeRx} A ${safeRx} ${safeRx} 0 0 1 ${r.right-safeRx} ${r.bottom} H ${r.left+safeRx} A ${safeRx} ${safeRx} 0 0 1 ${r.left} ${r.bottom-safeRx} V ${r.top+safeRx} A ${safeRx} ${safeRx} 0 0 1 ${r.left+safeRx} ${r.top} Z`:` M ${r.left} ${r.top} V ${r.bottom} H ${r.right} V ${r.top} Z`):'';
    overlay.innerHTML=`<defs><marker id="guide-arrow-tip" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 10 6 L 1 11" class="guide-arrow-tip"/></marker></defs><path class="guide-dim" fill-rule="evenodd" d="${outer+hole}"/>${r?`<rect class="guide-spotlight" x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" rx="${safeRx||rx}"/>`:''}${layout.arrow?`<path class="guide-arrow-halo" d="${layout.arrow.d}"/><path class="guide-arrow" data-end-x="${layout.arrow.end.x}" data-end-y="${layout.arrow.end.y}" d="${layout.arrow.d}" marker-end="url(#guide-arrow-tip)"/>`:''}`;
    const hint=root.querySelector('.guide-reveal');if(hint)hint.hidden=Boolean(layout.arrow)||!highlight;
  }
  function schedulePosition(){if(active&&!frame)frame=requestAnimationFrame(positionTour);}
  function revealTarget(){
    if(highlight){highlight.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-100);}
    schedulePosition();
  }
  function save(){
    memory.set(scope,{...progress});
    if(!writeGuideProgress(storage,scope,progress)&&!storageWarned){storageWarned=true;notify('Perangkat belum bisa menyimpan posisi panduan. Kamu tetap bisa memakainya dan membuka kembali lewat Panduan.');}
  }
  function clearHighlight(){resizeObserver?.disconnect();highlight?.classList.remove('guide-target');highlight=null;}
  function chooseScope(){
    const next=getContext().scope;
    if(next===scope)return;
    clearHighlight();active=false;lastStep='';root.replaceChildren();scope=next;
    progress=memory.get(scope)||readGuideProgress(storage,scope).progress;
    if(getContext().newAccount){
      if(!progress.autoPageGuides){progress={...progress,welcomeSeen:true,autoPageGuides:true};save();}
      consumeNewAccount();
    }
  }
  function renderResume(){
    const slot=document.querySelector('.guide-resume-slot'),topic=findTopic(progress.topicId);if(!slot)return;
    slot.innerHTML=topic&&['paused','in_progress'].includes(progress.status)?`<div class="guide-resume"><p>Terakhir dibuka: <strong>${e(topic.title)}</strong>, langkah ${progress.step+1} dari ${topic.steps.length}.</p><button type="button" class="text-link" data-guide-action="resume">Lanjutkan panduan terakhir ${icon('arrow')}</button></div>`:'';
  }
  function renderTour(focus=false){
    clearHighlight();
    if(!active){if(frame)cancelAnimationFrame(frame);frame=0;root.replaceChildren();document.body.classList.remove('guide-is-active');return;}
    const topic=findTopic(progress.topicId);if(!topic)return;
    const step=topic.steps[progress.step],context=getContext();
    const awaitingRoute=step.route&&context.signedIn&&step.route!==context.route;
    const target=awaitingRoute?null:visibleTarget(step.target);
    const needsAccount=step.route&&step.route!=='panduan'&&!context.signedIn;
    const targetVisible=target&&target.getClientRects().length>0;
    const token=topic.id+':'+progress.step+':'+context.route+':'+Boolean(targetVisible);
    const hadFocus=root.contains(document.activeElement);
    if(token!==lastStep||!root.firstElementChild)root.innerHTML=`<svg class="guide-overlay" aria-hidden="true" focusable="false"></svg><section class="guide-tour" aria-labelledby="guide-step-title"><div class="guide-tour-header"><p class="guide-step-count" role="status">Langkah ${progress.step+1} dari ${topic.steps.length}</p><button type="button" class="text-link" data-guide-action="skip">Lewati panduan</button></div><div class="guide-tour-body"><h2 id="guide-step-title" tabindex="-1">${e(step.title)}</h2><p>${e(step.text)}</p>${needsAccount?'<p class="guide-context-note">Masuk ke akun untuk membuka bagian ini. Kamu tetap bisa membaca petunjuknya sekarang.</p>':!targetVisible?`<p class="guide-context-note">Bagian ini belum tampil pada keadaan sekarang. ${e(step.hint||'Kamu bisa membaca penjelasan dan melanjutkan tur tanpa mengubah catatan.')}</p>`:''}${step.controls.length?`<details><summary>Petunjuk tombol dan isian</summary><dl>${step.controls.map(([label,text])=>`<div><dt>${e(label)}</dt><dd>${e(text)}</dd></div>`).join('')}</dl></details>`:''}<button type="button" class="text-link guide-reveal" data-guide-action="reveal" hidden>Tampilkan bagian yang ditunjuk</button><button type="button" class="text-link guide-pause" data-guide-action="pause">Tutup sementara</button></div><div class="guide-tour-footer"><button type="button" class="button secondary" data-guide-action="back" ${progress.step===0?'disabled':''}>Kembali</button><button type="button" class="button" data-guide-action="next">${progress.step===topic.steps.length-1?'Selesai':'Lanjut'}</button></div></section>`;
    document.body.classList.add('guide-is-active');
    if(targetVisible&&!needsAccount){target.classList.add('guide-target');highlight=target;}
    if(focus&&token!==lastStep){
      revealTarget();
    }
    if((focus||hadFocus)&&token!==lastStep)root.querySelector('#guide-step-title')?.focus({preventScroll:true});
    lastStep=token;
    if(highlight)resizeObserver?.observe(highlight);
    const panel=root.querySelector('.guide-tour');if(panel)resizeObserver?.observe(panel);
    schedulePosition();
  }
  function sync(){
    chooseScope();const context=getContext(),main=document.querySelector('#main');if(!main)return;
    document.body.classList.toggle('guide-signed-in',context.signedIn);
    if(!document.querySelector('[data-guide-open]')){
      const actions=document.querySelector('.topbar-actions');
      if(actions)actions.insertAdjacentHTML('afterbegin',`<button type="button" class="guide-access" data-guide-open aria-label="Buka panduan penggunaan">${icon('info')}<span>Panduan</span></button>`);
      else if(context.signedIn)main.insertAdjacentHTML('afterbegin',`<div class="guide-access-row"><button type="button" class="text-link" data-guide-open>${icon('info')} Panduan penggunaan</button></div>`);
    }
    const staffTopic=context.role==='cashier'?'staf-kasir':context.role==='kitchen'?'staf-dapur':null;
    const pageTopic=context.signedIn?(staffTopic||PAGE_TOPICS[context.route]):'akun';
    main.querySelector('.guide-welcome')?.remove();
    const stepRoute=findTopic(progress.topicId)?.steps[progress.step]?.route;
    if(active&&context.signedIn&&stepRoute&&stepRoute!==context.route){
      active=false;progress={...progress,status:'paused'};save();renderTour();
    }
    if(active&&context.signedIn&&progress.autoPageGuides&&context.route!=='panduan'&&!progress.seenPages.includes(context.route)){
      progress={...progress,seenPages:[...progress.seenPages,context.route]};save();
    }
    if(!active&&context.signedIn&&progress.autoPageGuides&&context.route&&context.route!=='panduan'){
      if(!progress.seenPages.includes(context.route)){
        progress={...progress,welcomeSeen:true,seenPages:[...progress.seenPages,context.route]};
        save();
        start(pageTopic);
        return;
      }
    }
    renderResume();renderTour();
  }
  function routeStep(){
    const step=findTopic(progress.topicId)?.steps[progress.step],context=getContext();
    if(step?.route&&(context.signedIn||step.route==='panduan'))navigate(step.route);
    else if(!context.signedIn&&context.route==='panduan')navigate('ringkasan');
  }
  function start(id,resume=false){
    chooseScope();const topic=findTopic(id);if(!topic)return;
    progress={...progress,welcomeSeen:true,status:'in_progress',topicId:id,step:resume?progress.step:0};active=true;lastStep='';save();
    document.querySelector('.guide-welcome')?.remove();routeStep();renderTour(true);renderResume();
  }
  function stop(status){
    active=false;progress={...progress,welcomeSeen:true,status};save();renderTour();renderResume();
    document.querySelector('[data-guide-open]')?.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-guide-open],[data-guide-topic],[data-guide-action]');if(!button)return;
    event.preventDefault();
    if(button.hasAttribute('data-guide-open')){const context=getContext();if(context.role==='cashier'||context.role==='kitchen'){start(context.role==='cashier'?'staf-kasir':'staf-dapur');return;}if(active)stop('paused');navigate('panduan');return;}
    if(button.dataset.guideTopic){start(button.dataset.guideTopic);return;}
    const action=button.dataset.guideAction;
    if(action==='resume'){start(progress.topicId,true);return;}
    if(action==='reveal'){revealTarget();return;}
    if(action==='dismiss'){
      progress={...progress,welcomeSeen:true};save();document.querySelector('.guide-welcome')?.remove();document.querySelector('[data-guide-open]')?.focus();return;
    }
    if(!active)return;
    if(action==='skip'||action==='pause'){stop(action==='skip'?'skipped':'paused');return;}
    if(action==='back'||action==='next'){
      const topic=findTopic(progress.topicId),next=progress.step+(action==='next'?1:-1);
      if(next>=topic.steps.length){stop('completed');notify('Panduan selesai. Buka Panduan untuk mempelajari fitur lain atau mengulangnya.');return;}
      if(next<0)return;
      progress={...progress,step:next};save();routeStep();renderTour(true);
    }
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();stop('paused');}});
  window.addEventListener('resize',schedulePosition);
  window.addEventListener('scroll',event=>{if(!root.contains(event.target))schedulePosition();},true);
  document.addEventListener('input',event=>{
    if(event.target.id!=='guide-search')return;
    const query=event.target.value.toLocaleLowerCase('id-ID').trim();let count=0;
    for(const topic of GUIDE_TOPICS){
      const row=document.querySelector('[data-guide-result="'+topic.id+'"]');if(!row)continue;
      const match=JSON.stringify(topic).toLocaleLowerCase('id-ID').includes(query);row.hidden=!match;if(match)count++;
    }
    const status=document.querySelector('#guide-search-status');if(status)status.textContent=count+' panduan ditemukan';
    const empty=document.querySelector('.guide-no-results');if(empty)empty.hidden=count>0;
  });
  return {sync};
}
