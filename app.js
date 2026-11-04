"use strict";
/* =========================================================
   Blutdruck Pro – alles in einer Datei
   Abschnitte: Utils · Speicherung · Parser · Erfassen ·
   Tabelle · Diagramm · Export/Import · App-Steuerung · PWA
   ========================================================= */

/* ---------- Utils ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
                   : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const fmtDate = d => new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
const fmtTime = d => new Date(d).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
function toLocalInput(iso){
  const d=new Date(iso), p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = s => new Date(s).toISOString();
const todayStr = () => { const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`; };
const stampDateTime = () => { const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

/* Toast in 3 Kategorien (success/notice/error): farbiges Feld mit Icon, 4 s sichtbar, wegwischbar. */
const TOAST_ICON={
  success:'<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.4l3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  notice:'<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l9.5 17H2.5z" fill="currentColor"/><path d="M12 9.5v4.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="#fff"/></svg>',
  error:'<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l9.5 17H2.5z" fill="currentColor"/><path d="M12 9.5v4.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.15" fill="#fff"/></svg>'
};
let _toastT;
/* Toast in das gerade offene Fenster (Dialog) rendern, sonst in den Body. Ein modales Fenster
   macht alles AUSSERHALB von sich „unberührbar" (inert); liegt der Toast im Fenster, bleibt er
   sichtbar UND wischbar. (Ersetzt das frühere Popover/Top-Layer-Konstrukt.) */
function toastHost(){ return $$('dialog').find(d=>d.open) || document.body; }
function toast(msg,kind){
  kind=(kind==='error'||kind==='notice')?kind:'success';
  const wrap=$('#toast'), host=toastHost();
  if(wrap.parentElement!==host) host.appendChild(wrap);   // zum offenen Fenster (bzw. Body) holen
  wrap.innerHTML='';
  const card=document.createElement('div'); card.className='toast-card '+kind;
  card.innerHTML=TOAST_ICON[kind];
  const s=document.createElement('span'); s.className='t-msg'; s.textContent=msg; card.appendChild(s);
  wrap.appendChild(card);
  requestAnimationFrame(()=>wrap.classList.add('show'));   // einblenden
  clearTimeout(_toastT); _toastT=setTimeout(hideToast,4000);
  swipeToast(card);
}
function hideToast(){
  clearTimeout(_toastT);
  $('#toast').classList.remove('show');
}
/* Toast horizontal wegwischen (Pointer = Finger + Maus); beim Berühren pausiert der Auto-Timer. */
function swipeToast(card){
  let startX=0,dx=0,drag=false;
  card.addEventListener('pointerdown',e=>{ drag=true; startX=e.clientX; dx=0; card.style.transition='none'; clearTimeout(_toastT); try{card.setPointerCapture(e.pointerId);}catch{} });
  card.addEventListener('pointermove',e=>{ if(!drag) return; dx=e.clientX-startX; card.style.transform='translateX('+dx+'px)'; card.style.opacity=String(Math.max(0,1-Math.abs(dx)/200)); });
  const end=()=>{ if(!drag) return; drag=false; card.style.transition='';
    if(Math.abs(dx)>60){ card.style.transform='translateX('+(dx>0?420:-420)+'px)'; card.style.opacity='0'; setTimeout(hideToast,200); }
    else{ card.style.transform=''; card.style.opacity=''; clearTimeout(_toastT); _toastT=setTimeout(hideToast,4000); } };
  card.addEventListener('pointerup',end); card.addEventListener('pointercancel',end);
}

/* Eigene Bestätigen-Rückfrage statt native confirm(): gestaltbar, Hell/Dunkel, mit Symbol.
   Promise löst zu true (bestätigt) bzw. false (Abbrechen/Esc/Klick daneben). Optionen:
   icon ('trash'|'info') + tone ('danger'|'notice'), title, message, confirmLabel, cancelLabel,
   danger (roter Füll-Knopf statt blau), previewHTML (Vorschau-Karte), detailsText (ausklappbar),
   requireCheck (Pflicht-Häkchen; schaltet den Bestätigen-Knopf erst frei). */
const CONFIRM_ICON={
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
};
function askConfirm(opts){
  opts=opts||{};
  const dlg=$('#confirmDlg'), extra=$('#confirmExtra'), ok=$('#confirmOk'), icon=$('#confirmIcon');
  icon.innerHTML=opts.icon?(CONFIRM_ICON[opts.icon]||''):'';
  icon.className='cdlg-ic'+(opts.tone?' tone-'+opts.tone:'');
  icon.hidden=!opts.icon;
  $('#confirmTitle').textContent=opts.title||'Sicher?';
  const msg=$('#confirmMsg');
  if(opts.messageHTML){ msg.innerHTML=opts.messageHTML; msg.hidden=false; }   // messageHTML nur mit App-eigenen Texten (kein Nutzer-Input)
  else { msg.textContent=opts.message||''; msg.hidden=!opts.message; }
  extra.innerHTML='';
  if(opts.previewHTML) extra.insertAdjacentHTML('beforeend','<div class="cdlg-prev">'+opts.previewHTML+'</div>');
  if(opts.detailsText){
    extra.insertAdjacentHTML('beforeend','<details class="cdlg-det"><summary>Technische Details</summary><div class="cdlg-info"></div></details>');
    extra.querySelector('.cdlg-info').textContent=opts.detailsText;
  }
  if(opts.noteText){                                 // Hinweiszeile mit Info-Symbol (z. B. Backup-Notiz)
    extra.insertAdjacentHTML('beforeend','<div class="cdlg-note">'+CONFIRM_ICON.info+'<span></span></div>');
    extra.querySelector('.cdlg-note span').textContent=opts.noteText;
  }
  ok.className=opts.danger?'btn-fill-danger':'btn-fill';
  ok.textContent=opts.confirmLabel||'OK';
  ok.disabled=!!opts.requireCheck;                 // bei Pflicht-Häkchen erst nach dem Ankreuzen aktiv
  if(opts.requireCheck){
    extra.insertAdjacentHTML('beforeend','<label class="cdlg-check"><input type="checkbox"><span></span></label>');
    const chk=extra.querySelector('.cdlg-check input');
    extra.querySelector('.cdlg-check span').textContent=opts.requireCheck;
    chk.addEventListener('change',()=>{ ok.disabled=!chk.checked; });
  }
  $('#confirmCancel').textContent=opts.cancelLabel||'Abbrechen';
  dlg.returnValue='';
  dlg.showModal();
  return new Promise(res=>{
    dlg.addEventListener('close',function h(){       // Aufräumen passiert beim nächsten Aufbau (oben), nicht hier –
      dlg.removeEventListener('close',h);            // sonst könnte ein verzögertes close-Ereignis frischen Inhalt löschen.
      res(dlg.returnValue==='ok');
    });
  });
}

/* ---------- Speicherung ---------- */
const LS_KEY='bpp_entries', LS_SET='bpp_settings';
const SET_DEFAULT={colorDots:true,guideLines:true,theme:'auto',accent:'kobalt',
  reminderDays:3,firstDirtyAt:null,snoozeUntil:0,
  thr:{sysY:130,sysR:140,diaY:85,diaR:90}};

/* IndexedDB ist der robuste Hauptspeicher (überlebt Speicherdruck/ITP deutlich besser
   als localStorage und fasst viel mehr Daten). localStorage bleibt als Spiegel/Fallback. */
const DB_NAME='blutdruck-pro', DB_VER=1, STORE_E='entries', STORE_M='meta';
let _db=null;
function openDB(){
  return new Promise((res,rej)=>{
    if(!('indexedDB' in window)){ rej(new Error('no-indexeddb')); return; }
    const rq=indexedDB.open(DB_NAME,DB_VER);
    rq.onupgradeneeded=()=>{
      const db=rq.result;
      if(!db.objectStoreNames.contains(STORE_E)) db.createObjectStore(STORE_E,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_M)) db.createObjectStore(STORE_M); // für Backup-Datei-Handle
    };
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=()=>rej(rq.error);
  });
}
function idbAll(){
  return new Promise((res,rej)=>{
    const rq=_db.transaction(STORE_E,'readonly').objectStore(STORE_E).getAll();
    rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error);
  });
}
function idbWriteAll(list){
  return new Promise((res,rej)=>{
    const tx=_db.transaction(STORE_E,'readwrite'), st=tx.objectStore(STORE_E);
    st.clear(); list.forEach(e=>st.put(e)); // kompletter Stand in einer Transaktion
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  });
}
function idbGetMeta(key){
  return new Promise((res,rej)=>{
    if(!_db){ res(null); return; }
    const rq=_db.transaction(STORE_M,'readonly').objectStore(STORE_M).get(key);
    rq.onsuccess=()=>res(rq.result??null); rq.onerror=()=>rej(rq.error);
  });
}
function idbSetMeta(key,val){
  return new Promise((res,rej)=>{
    if(!_db){ rej(new Error('no-db')); return; }
    const tx=_db.transaction(STORE_M,'readwrite'); tx.objectStore(STORE_M).put(val,key);
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  });
}

/* Browser bitten, den Speicher dauerhaft zu behalten (Schutz gegen Auto-Löschung/Eviction). */
async function requestPersistence(){
  try{
    if(navigator.storage && navigator.storage.persist){
      if(!(await navigator.storage.persisted())) await navigator.storage.persist();
    }
  }catch{}
}

function loadEntries(){ try{const a=JSON.parse(localStorage.getItem(LS_KEY)||'[]');return Array.isArray(a)?a:[];}catch{return[];} }
function quotaToast(e){ if(e&&e.name==='QuotaExceededError') toast('Speicher voll – bitte Backup sichern','error'); }
function saveEntries(){
  try{ localStorage.setItem(LS_KEY,JSON.stringify(entries)); }catch(e){ quotaToast(e); }   // Spiegel/Fallback
  if(_db) idbWriteAll(entries).then(scheduleAutoBackup).catch(quotaToast);                  // robuster Hauptspeicher
}
function loadSettings(){
  let s; try{ s=Object.assign({},SET_DEFAULT,JSON.parse(localStorage.getItem(LS_SET)||'{}')); }catch{ s={...SET_DEFAULT}; }
  s.thr=Object.assign({},SET_DEFAULT.thr,s.thr||{}); // Schwellenwerte immer vollständig halten
  return s;
}
function persistSettings(){
  try{ localStorage.setItem(LS_SET,JSON.stringify(settings)); }catch(e){ quotaToast(e); }   // Spiegel/Fallback
  if(_db) idbSetMeta('settings',settings).catch(()=>{});                                     // robuster Hauptspeicher
}
function saveSettings(){ persistSettings(); scheduleAutoBackup(); }                           // Nutzer-Änderung: auch Auto-Backup-Datei aktualisieren

let entries=[];
let settings=loadSettings();

/* Beim Start: IndexedDB öffnen, Daten laden, ggf. einmalig aus localStorage migrieren. */
async function initStorage(){
  try{
    _db=await openDB();
    // Einstellungen robust laden / einmalig aus localStorage migrieren (gleiches Muster wie entries)
    try{
      const s=await idbGetMeta('settings');
      if(s && typeof s==='object'){
        settings=Object.assign({},SET_DEFAULT,s);
        settings.thr=Object.assign({},SET_DEFAULT.thr,s.thr||{});
        try{ localStorage.setItem(LS_SET,JSON.stringify(settings)); }catch{}   // schnellen Spiegel sofort wiederherstellen (kein Theme-Flash beim nächsten Start)
      }else{
        await idbSetMeta('settings',settings);
      }
    }catch{}
    const fromDb=await idbAll();
    if(fromDb.length){ entries=fromDb; }
    else{
      const fromLs=loadEntries();          // einmalige Migration aus localStorage
      entries=fromLs;
      if(fromLs.length) await idbWriteAll(fromLs);
    }
  }catch{
    entries=loadEntries();                  // kompletter Fallback ohne IndexedDB
  }
}

function addEntry(e){ entries.push(e); saveEntries(); markDirty(); }
function updateEntry(id,patch){ const i=entries.findIndex(x=>x.id===id); if(i>=0){entries[i]={...entries[i],...patch};saveEntries();markDirty();} }
function removeEntry(id){ entries=entries.filter(x=>x.id!==id); saveEntries(); markDirty(); }

/* ---------- Plausibilitäts-Bereiche (nur zur Warnung, blockieren nicht) ---------- */
const RANGES={sys:[70,260],dia:[40,160],pulse:[30,220]};
const inRange=(v,[a,b])=>v!=null&&v>=a&&v<=b;

/* ---------- Filter (geteilt von Verlauf + Diagramm) ---------- */
const filters={from:'',to:'',sysMin:'',sysMax:'',diaMin:'',diaMax:'',pulMin:'',pulMax:'',note:''};

function getFiltered(){
  return entries.filter(e=>{
    const t=new Date(e.ts).getTime();
    if(filters.from && t<new Date(filters.from+'T00:00:00').getTime()) return false;
    if(filters.to   && t>new Date(filters.to+'T23:59:59').getTime()) return false;
    const numOk=(v,mn,mx)=>!((mn!==''&&v<+mn)||(mx!==''&&v>+mx));
    if(!numOk(e.sys,filters.sysMin,filters.sysMax)) return false;
    if(!numOk(e.dia,filters.diaMin,filters.diaMax)) return false;
    if(!numOk(e.pulse,filters.pulMin,filters.pulMax)) return false;
    if(filters.note && !(e.note||'').toLowerCase().includes(filters.note.toLowerCase())) return false;
    return true;
  });
}
function category(e){            // Gesamt-Ampel: der schlechtere von Sys/Dia (medizinischer Standard)
  const t=settings.thr;
  if(e.sys>=t.sysR||e.dia>=t.diaR) return 'r';
  if(e.sys>=t.sysY||e.dia>=t.diaY) return 'y';
  return 'g';
}
/* Ampel für EINEN Wert (Sys bzw. Dia getrennt) – differenzierter als die Gesamt-Ampel.
   Gibt 'g'/'y'/'r' zurück (bzw. 'n' = neutral, z. B. Puls ohne Schwellenwerte). */
function catVal(v,y,r){ if(v==null||isNaN(v)) return 'n'; if(v>=r) return 'r'; if(v>=y) return 'y'; return 'g'; }
function catValFor(key,v){ const t=settings.thr;
  if(key==='sys') return catVal(v,t.sysY,t.sysR);
  if(key==='dia') return catVal(v,t.diaY,t.diaR);
  return 'n'; }
/* Ampel-Kategorie → CSS-Token bzw. Text (überall geteilt: Dashboard, Verlauf, Detail, Diagramm). */
const CAT_INK ={g:'var(--g-ink)', y:'var(--y-ink)', r:'var(--r-ink)', n:'var(--muted)'};
const CAT_SOFT={g:'var(--g-soft)',y:'var(--y-soft)',r:'var(--r-soft)',n:'var(--surf2)'};
const CAT_BAR ={g:'var(--g-bar)', y:'var(--y-bar)', r:'var(--r-bar)', n:'var(--muted)'};
const CAT_LABEL={g:'Im Ziel', y:'Erhöht', r:'Zu hoch', n:'–'};

/* ---------- Erfassen (geführte Eingabe) ----------
   Ein Feld nach dem anderen (Sys → Dia → Puls) über einen eigenen Ziffernblock: große Vorschauzahl,
   Segment-Kacheln mit Ampel-Rückmeldung (catVal), Fortschrittspunkte, Datum/Uhrzeit- und Notiz-Sheet.
   Speichert über addEntry (neu) bzw. updateEntry (Bearbeiten). Nachbau des Designs – Datenlogik unverändert. */
const CAP_FIELDS=[{seg:'SYS',name:'Systolisch',unit:'mmHg',key:'sys'},
                  {seg:'DIA',name:'Diastolisch',unit:'mmHg',key:'dia'},
                  {seg:'PULS',name:'Puls',unit:'bpm',key:'pulse'}];
/* Rahmenfarbe der „erledigten" Kachel (weiches Ampel-Linien-Pendant zu CAT_SOFT/-BAR). */
const CAT_LINE={g:'color-mix(in srgb,var(--g-bar) 34%,var(--line))',
                y:'color-mix(in srgb,var(--y-bar) 34%,var(--line))',
                r:'color-mix(in srgb,var(--r-bar) 34%,var(--line))', n:'var(--line)'};
const cap={f:['','',''],step:0,editing:false,editId:null,note:'',date:new Date(),returnTab:'dashboard',dtView:{y:0,m:0},saving:false};

const WD_SHORT=['So','Mo','Di','Mi','Do','Fr','Sa'];
const MO_FULL=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const pad2=n=>String(n).padStart(2,'0');
/* Datum-Chip: „Heute, 09:41" / „Gestern, …" / „Mi, 24. Jun, …" */
function capDateLabel(d){
  const now=new Date(), y=new Date(now); y.setDate(y.getDate()-1);
  let day;
  if(sameDay(d,now)) day='Heute';
  else if(sameDay(d,y)) day='Gestern';
  else day=WD_SHORT[d.getDay()]+', '+d.getDate()+'. '+MO_FULL[d.getMonth()].slice(0,3);
  return day+', '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}
function capSyncDateChip(){ $('#capDateLabel').textContent=capDateLabel(cap.date); }

/* Öffnen. entry gesetzt → Bearbeiten-Modus; sonst neue Messung. returnTab = Ziel beim Schließen/Speichern. */
function startCapture(entry,returnTab){
  cap.returnTab=returnTab||'dashboard'; cap.saving=false; cap.step=0;
  if(entry){
    cap.editing=true; cap.editId=entry.id;
    cap.f=[String(entry.sys),String(entry.dia),String(entry.pulse)];
    cap.note=entry.note||''; cap.date=new Date(entry.ts);
  }else{
    cap.editing=false; cap.editId=null;
    cap.f=['','','']; cap.note=''; cap.date=new Date();
  }
  $('#capTitle').textContent=cap.editing?'Messung bearbeiten':'Neue Messung';
  $('#capSave').hidden=true; $('#capDtSheet').hidden=true; $('#capNoteSheet').hidden=true;
  capSyncDateChip(); capUpdate();
  navPush('capture',null);
}

/* Alles Sichtbare an den Zustand angleichen (Zahl, Einheit, Fortschritt, Kacheln, Knöpfe, Hinweis). */
function capUpdate(){
  const i=cap.step, raw=cap.f[i], cfg=CAP_FIELDS[i];
  $('#capBig').textContent=raw;
  $('#capUnit').textContent=cfg.name.toUpperCase()+' · '+cfg.unit;
  $$('#capProgress span').forEach(s=>{ const k=+s.dataset.i;
    s.classList.toggle('active',k===i);
    s.classList.toggle('filled',k!==i&&cap.f[k].length>0); });
  $$('#tab-capture .cap-tile').forEach(t=>{
    const k=+t.dataset.i, r=cap.f[k], has=r.length>0, active=k===i, done=has&&!active&&k<2;
    const cat=done?catValFor(CAP_FIELDS[k].key,parseInt(r,10)):null;
    t.classList.toggle('active',active); t.classList.toggle('empty',!has);
    const box=t.querySelector('.cap-tile-box'), seg=t.querySelector('.cap-tile-seg'),
          val=t.querySelector('.cap-tile-val'), pill=t.querySelector('.cap-tile-pill');
    val.textContent=has?r:'––';
    if(done){
      box.style.background=CAT_SOFT[cat]; box.style.borderColor=CAT_LINE[cat];
      seg.style.color=CAT_INK[cat]; val.style.color=CAT_INK[cat];
      pill.innerHTML='<span class="cap-pill" style="background:'+CAT_SOFT[cat]+';color:'+CAT_INK[cat]+'">'
        +'<span class="d" style="background:'+CAT_BAR[cat]+'"></span>'+CAT_LABEL[cat]+'</span>';
    }else{
      box.style.background=''; box.style.borderColor=''; seg.style.color=''; val.style.color=''; pill.innerHTML='';
    }
  });
  $('#capInk').style.left='calc('+i+' * (100% - 16px) / 3 + '+(8*i)+'px)';
  const allFilled=cap.f.every(v=>v.length>0), last=i>=2, next=$('#capNext');
  next.textContent=last?'Speichern':'Weiter';
  next.disabled=last?!allFilled:raw.length===0;
  let hint='';
  for(let k=0;k<3;k++){ const v=cap.f[k]; if(v.length&&!inRange(parseInt(v,10),RANGES[CAP_FIELDS[k].key])){ hint='Ungewöhnlicher Wert – bitte prüfen.'; break; } }
  $('#capHint').textContent=hint;
  $('#capNoteBtn').textContent=cap.note.trim()?'✓ Notiz':'+ Notiz';
}
function capBump(){ const b=$('#capBig'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

function capPressDigit(d){
  const i=cap.step; if(cap.f[i].length>=3) return;
  cap.f[i]+=d;
  if(cap.f[i].length>=3&&i<2) cap.step=i+1;   // nach 3 Ziffern automatisch weiter
  capUpdate(); capBump();
}
function capPressBack(){
  const i=cap.step;
  if(cap.f[i].length){ cap.f[i]=cap.f[i].slice(0,-1); capUpdate(); return; }
  if(i>0){ cap.step=i-1; capUpdate(); }
}
function capGoStep(i){ if(i!==cap.step){ cap.step=i; capUpdate(); } }
function capNext(){
  if(cap.step<2){ if(cap.f[cap.step].length===0) return; cap.step++; capUpdate(); }
  else capSave();
}
function capClose(){ if(!cap.saving) backToScreen(cap.returnTab); }
function capSave(){
  if(cap.saving) return;
  const sys=parseInt(cap.f[0],10), dia=parseInt(cap.f[1],10), pulse=parseInt(cap.f[2],10);
  if(!Number.isFinite(sys)||!Number.isFinite(dia)||!Number.isFinite(pulse)) return;
  cap.saving=true;
  const note=cap.note.trim();
  if(cap.editing&&cap.editId) updateEntry(cap.editId,{ts:cap.date.toISOString(),sys,dia,pulse,note});
  else addEntry({id:uid(),ts:cap.date.toISOString(),sys,dia,pulse,note});
  $('#capSave').hidden=false;                 // Häkchen-Overlay, dann Zielscreen
  const back=cap.returnTab;
  setTimeout(()=>{ $('#capSave').hidden=true; cap.saving=false; refreshData(); updateReminder(); backToScreen(back); },780);
}

/* ----- Datum & Uhrzeit (Bottom-Sheet) ----- */
function capOpenDt(){ cap.dtView={y:cap.date.getFullYear(),m:cap.date.getMonth()}; capRenderDt(); navPush('capture','#capDtSheet'); }
function capCloseDt(){ closeSheet('#capDtSheet'); }
function capSetDtQuick(which){
  const c=cap.date; let d;
  if(which==='jetzt') d=new Date();
  else if(which==='heute'){ d=new Date(); d.setHours(c.getHours(),c.getMinutes(),0,0); }
  else { d=new Date(); d.setDate(d.getDate()-1); d.setHours(c.getHours(),c.getMinutes(),0,0); }
  cap.date=d; cap.dtView={y:d.getFullYear(),m:d.getMonth()}; capRenderDt(); capSyncDateChip();
}
function capDtPrevMonth(){ let {y,m}=cap.dtView; m--; if(m<0){m=11;y--;} cap.dtView={y,m}; capRenderDt(); }
function capDtNextMonth(){ const n=new Date(); let {y,m}=cap.dtView;
  if(y>n.getFullYear()||(y===n.getFullYear()&&m>=n.getMonth())) return;     // nicht in die Zukunft
  m++; if(m>11){m=0;y++;} cap.dtView={y,m}; capRenderDt(); }
function capPickDay(day){ const c=cap.date; cap.date=new Date(cap.dtView.y,cap.dtView.m,day,c.getHours(),c.getMinutes(),0,0); capRenderDt(); capSyncDateChip(); }
function capStepHour(delta){ const d=new Date(cap.date); d.setHours((cap.date.getHours()+delta+24)%24); cap.date=d; capRenderDt(); capSyncDateChip(); }
function capStepMin(delta){ const d=new Date(cap.date); d.setMinutes((cap.date.getMinutes()+delta+60)%60); cap.date=d; capRenderDt(); capSyncDateChip(); }
function capRenderDt(){
  const e=cap.date, now=new Date(), yest=new Date(now); yest.setDate(yest.getDate()-1);
  const vy=cap.dtView.y, vm=cap.dtView.m;
  const isNow=sameDay(e,now)&&Math.abs(e-now)<60000;
  const q=[['jetzt','Jetzt',isNow],['heute','Heute',sameDay(e,now)&&!isNow],['gestern','Gestern',sameDay(e,yest)]];
  const xIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let html='<div class="cap-sheet-grab"></div>'
    +'<div class="cap-sheet-head"><div class="cap-sheet-title">Datum &amp; Uhrzeit</div>'
    +'<button class="cap-x" data-act="close" type="button" aria-label="Schließen">'+xIcon+'</button></div>'
    +'<div class="cap-dt-quick">'+q.map(([k,l,on])=>'<button type="button" data-act="quick" data-q="'+k+'" class="'+(on?'on':'')+'">'+l+'</button>').join('')+'</div>';
  const canNext=!(vy>now.getFullYear()||(vy===now.getFullYear()&&vm>=now.getMonth()));
  html+='<div class="cap-cal"><div class="cap-cal-head">'
    +'<button class="cap-cal-nav" data-act="prevm" type="button" aria-label="Vorheriger Monat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>'
    +'<div class="cap-cal-title">'+MO_FULL[vm]+' '+vy+'</div>'
    +'<button class="cap-cal-nav" data-act="nextm" type="button" aria-label="Nächster Monat"'+(canNext?'':' disabled')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>'
    +'</div><div class="cap-cal-wd">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>'<span>'+w+'</span>').join('')+'</div>';
  const first=new Date(vy,vm,1), startW=(first.getDay()+6)%7, dim=new Date(vy,vm+1,0).getDate();
  const todayMid=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let cells='';
  for(let b=0;b<startW;b++) cells+='<span></span>';
  for(let day=1;day<=dim;day++){
    const cd=new Date(vy,vm,day), future=cd>todayMid, sel=sameDay(cd,e), today=sameDay(cd,now);
    const cls=[sel?'sel':'',today?'today':'',future?'future':''].filter(Boolean).join(' ');
    cells+=future ? '<button type="button" class="'+cls+'" disabled>'+day+'</button>'
                  : '<button type="button" class="'+cls+'" data-act="day" data-day="'+day+'">'+day+'</button>';
  }
  html+='<div class="cap-cal-grid">'+cells+'</div></div>';
  const up='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
  const dn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const step=(val,lbl,ua,da)=>'<div class="cap-step"><button type="button" data-act="'+ua+'">'+up+'</button>'
    +'<div class="cap-step-val tnum">'+val+'</div><button type="button" data-act="'+da+'">'+dn+'</button>'
    +'<div class="cap-step-lbl">'+lbl+'</div></div>';
  html+='<div class="cap-time">'+step(pad2(e.getHours()),'STD','hup','hdn')
    +'<div class="cap-time-colon">:</div>'+step(pad2(e.getMinutes()),'MIN','mup','mdn')+'</div>'
    +'<button class="cap-sheet-apply" data-act="close" type="button">Übernehmen</button>';
  $('#capDtPanel').innerHTML=html;
}

/* ----- Notiz (Bottom-Sheet) ----- */
function capOpenNote(){ $('#capNoteTa').value=cap.note; navPush('capture','#capNoteSheet'); setTimeout(()=>$('#capNoteTa').focus(),50); }
function capCloseNote(){ closeSheet('#capNoteSheet'); }
function capApplyNote(){ cap.note=$('#capNoteTa').value; capCloseNote(); capUpdate(); }

/* ----- Verkabelung ----- */
$('#capKeys').addEventListener('click',ev=>{ const b=ev.target.closest('.cap-key'); if(!b) return;
  const k=b.dataset.k; if(k==='back') capPressBack(); else capPressDigit(k); });
$('#capNext').addEventListener('click',capNext);
$('#capClose').addEventListener('click',capClose);
$('#capDateChip').addEventListener('click',capOpenDt);
$('#capNoteBtn').addEventListener('click',capOpenNote);
$$('#capProgress span').forEach(s=>s.addEventListener('click',()=>capGoStep(+s.dataset.i)));
$$('#tab-capture .cap-tile').forEach(t=>t.addEventListener('click',()=>capGoStep(+t.dataset.i)));
$('#capDtPanel').addEventListener('click',ev=>{ const b=ev.target.closest('[data-act]'); if(!b||b.disabled) return;
  const a=b.dataset.act;
  if(a==='close') capCloseDt();
  else if(a==='quick') capSetDtQuick(b.dataset.q);
  else if(a==='prevm') capDtPrevMonth();
  else if(a==='nextm') capDtNextMonth();
  else if(a==='day') capPickDay(+b.dataset.day);
  else if(a==='hup') capStepHour(1); else if(a==='hdn') capStepHour(-1);
  else if(a==='mup') capStepMin(1); else if(a==='mdn') capStepMin(-1);
});
$('#capDtScrim').addEventListener('click',capCloseDt);
$('#capNoteScrim').addEventListener('click',capCloseNote);
$('#capNoteX').addEventListener('click',capCloseNote);
$('#capNoteApply').addEventListener('click',capApplyNote);
/* Physische Tastatur (Komfort am Desktop + echte Tastatur): nur im Erfassen-Screen aktiv. */
document.addEventListener('keydown',ev=>{
  if(currentTab!=='capture') return;
  const dtOpen=!$('#capDtSheet').hidden, noteOpen=!$('#capNoteSheet').hidden;
  if(dtOpen||noteOpen){ if(ev.key==='Escape'){ capCloseDt(); capCloseNote(); } return; }
  if(ev.key>='0'&&ev.key<='9'){ capPressDigit(ev.key); ev.preventDefault(); }
  else if(ev.key==='Backspace'){ capPressBack(); ev.preventDefault(); }
  else if(ev.key==='Enter'){ if(!$('#capNext').disabled) capNext(); ev.preventDefault(); }
  else if(ev.key==='Escape'){ capClose(); }
});

/* ---------- Tabelle ---------- */
/* ---------- Verlauf (Liste) ----------
   Chronologische Liste (neu, ersetzt die alte Tabelle). Sys und Dia je in ihrer eigenen Ampelfarbe
   (catVal), Zeilenpunkt = der schlechtere von beiden. Zeitraum unten: 7/30/90 Tage + „Zeitraum"
   (Von–Bis-Sheet). Zeile antippen → Detail-Screen. Nutzt die geteilte Filter-Basis (filters → getFiltered). */
let verlaufRange='30';
const RANK={n:0,g:1,y:2,r:3};
const worseCat=(a,b)=>RANK[b]>RANK[a]?b:a;
const IC_CHEV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const IC_NOTE_SM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M5 10h14M5 15h8"/></svg>';

/* 7/30/90 → filters.from/to setzen; 'custom' behält die im Zeitraum-Sheet gewählten Werte. */
function applyVerlaufRange(){
  const k=verlaufRange;
  if(k==='7'||k==='30'||k==='90'){ filters.from=new Date(Date.now()-(+k)*864e5).toISOString().slice(0,10); filters.to=''; }
}
function renderTable(){
  applyVerlaufRange();
  const list=getFiltered().slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const rangeLabel={'7':'Letzte 7 Tage','30':'Letzte 30 Tage','90':'Letzte 90 Tage','custom':'Eigener Zeitraum'}[verlaufRange];
  $('#vhSub').textContent=rangeLabel+' · '+list.length+' '+(list.length===1?'Messung':'Messungen');
  $$('#vFilter .vh-pill').forEach(p=>p.classList.toggle('active',p.dataset.r===verlaufRange));
  const vl=$('#vList'), ve=$('#vEmpty');
  if(!list.length){
    vl.innerHTML='';
    ve.innerHTML=!entries.length
      ? 'Noch keine Messung erfasst.<br>Tippe unten auf das <b style="color:var(--accent)">+</b>.'
      : 'Keine Messungen in diesem Zeitraum.';
    ve.hidden=false;
  }else{
    ve.hidden=true;
    let html='';
    list.forEach((e,i)=>{
      const d=new Date(e.ts);
      const dateLabel=WD_SHORT[d.getDay()]+', '+pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.';
      const time=pad2(d.getHours())+':'+pad2(d.getMinutes());
      const sc=catValFor('sys',e.sys), dc=catValFor('dia',e.dia), oc=worseCat(sc,dc);
      const delay=Math.min(i*0.04,0.32);
      html+='<button class="vrow" type="button" data-id="'+e.id+'" style="animation-delay:'+delay+'s">'
        +'<span class="vrow-dot" style="background:'+CAT_BAR[oc]+'"></span>'
        +'<span class="vrow-main"><span class="vrow-date">'+dateLabel+'</span>'
        +'<span class="vrow-sub">'+time+(e.note?IC_NOTE_SM:'')+'</span></span>'
        +'<span class="vrow-v tnum" style="color:'+CAT_INK[sc]+'">'+e.sys+'</span>'
        +'<span class="vrow-v tnum" style="color:'+CAT_INK[dc]+'">'+e.dia+'</span>'
        +'<span class="vrow-p tnum">'+e.pulse+'</span>'
        +'<span class="vrow-chev">'+IC_CHEV+'</span>'
        +'</button>';
    });
    vl.innerHTML=html;
  }
  if(currentTab==='table') requestAnimationFrame(positionVInk);
}
/* Gleitende Markierung unter die aktive Zeitraum-Pille legen (misst deren Position). */
function positionVInk(){
  const bar=$('#vFilter'); if(!bar) return;
  const active=bar.querySelector('.vh-pill.active'), ink=$('#vInk');
  if(!active||!ink) return;
  ink.style.top=active.offsetTop+'px'; ink.style.height=active.offsetHeight+'px';
  ink.style.width=active.offsetWidth+'px'; ink.style.transform='translateX('+active.offsetLeft+'px)';
  ink.style.opacity='1';
}
/* Zeile antippen → Detail. */
$('#vList').addEventListener('click',ev=>{ const b=ev.target.closest('.vrow'); if(b) showDetail(b.dataset.id); });
/* Zeitraum-Pillen. */
$('#vFilter').addEventListener('click',ev=>{
  const b=ev.target.closest('.vh-pill'); if(!b) return;
  if(b.dataset.r==='custom'){ openRangeSheet(); navPush('table','#rangeSheet'); return; }
  verlaufRange=b.dataset.r; renderTable();
});
/* Zeitraum-Sheet (Von–Bis). */
function openRangeSheet(){ $('#rsFrom').value=filters.from||''; $('#rsTo').value=filters.to||''; }   // nur befüllen; Anzeigen/Verlauf übernimmt navPush → applyTop
function closeRangeSheet(){ closeSheet('#rangeSheet'); }
$('#rangeSheet').addEventListener('click',ev=>{ if(ev.target.closest('[data-act=close]')) closeRangeSheet(); });
$('#rsApply').addEventListener('click',()=>{
  let from=$('#rsFrom').value, to=$('#rsTo').value;
  if(from&&to&&from>to){ const t=from; from=to; to=t; }   // vertauscht → richtig herum
  filters.from=from; filters.to=to; verlaufRange='custom';
  renderTable(); if(currentTab==='chart') renderChart();   // erst neu zeichnen (Zeitraum ist mit dem Diagramm geteilt) …
  navBack();                                               // … dann das Sheet schließen (eine Ebene zurück)
});
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&!$('#rangeSheet').hidden){ ev.preventDefault(); closeRangeSheet(); } });

/* Die früheren Zeitraum-Chips des Diagramms sind entfallen: Verlauf und Diagramm teilen sich jetzt
   denselben Zeitraum (verlaufRange + filters.from/to, gesetzt über applyVerlaufRange bzw. das Von–Bis-Sheet). */
/* ---------- Detail (Einzelmessung) ----------
   Öffnet aus einer Verlauf-Zeile: großer Sys/Dia-Wert in Ampelfarbe, Status-Pille, Puls, volles Datum
   + Tageszeit, „Position im Ampelbereich" (Skala mit Marker), datengetriebener Kontext-Satz, Notiz.
   Aktionen unten: Zurück · Bearbeiten (→ geführte Eingabe im Bearbeiten-Modus) · Löschen (askConfirm). */
let detailId=null;
const IC_CAL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v4M16 3v4"/></svg>';
const IC_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>';
const IC_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const IC_NOTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M5 10h14M5 15h8"/></svg>';
const TOD_LABEL={morgens:'Morgen','tagsüber':'Tages',abends:'Abend'};
const todOf=h=>h<11?'morgens':h<17?'tagsüber':'abends';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* Kontext-Satz: Vergleich mit dem Schnitt derselben Tageszeit (morgens/tagsüber/abends). */
function detContext(e){
  const tod=todOf(new Date(e.ts).getHours());
  const same=entries.filter(x=>todOf(new Date(x.ts).getHours())===tod);
  const avg=k=>Math.round(same.reduce((a,x)=>a+x[k],0)/same.length);
  const as=avg('sys'), ad=avg('dia'), diff=e.sys-as, lbl=TOD_LABEL[tod];
  let strong;
  if(diff>=8) strong='Deutlich über deinem '+lbl+'-Schnitt';
  else if(diff>=3) strong='Etwas über deinem '+lbl+'-Schnitt';
  else if(diff<=-3) strong='Unter deinem '+lbl+'-Schnitt';
  else strong='Im Bereich deines '+lbl+'-Schnitts';
  return '<b>'+strong+'</b> ('+as+'/'+ad+') der letzten Wochen.';
}

function showDetail(id){ detailId=id; navPush('detail',null); }
function renderDetail(id){
  const e=entries.find(x=>x.id===id);
  if(!e){ showTab('table'); return; }
  const sc=catValFor('sys',e.sys), dc=catValFor('dia',e.dia), oc=worseCat(sc,dc);
  const d=new Date(e.ts), tod=todOf(d.getHours());
  const fullDate=d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const time=pad2(d.getHours())+':'+pad2(d.getMinutes()), t=settings.thr;
  const sysPct=clamp((e.sys-90)/80*100,4,96), diaPct=clamp((e.dia-50)/60*100,4,96);
  /* Skala-Verlauf grün/gelb/rot – Umschlagpunkte aus den eingestellten Schwellenwerten. */
  const grad=(dom0,span,y,r)=>{ const yp=clamp((y-dom0)/span*100,0,100), rp=clamp((r-dom0)/span*100,0,100);
    return 'linear-gradient(90deg,var(--g-soft) 0 '+yp+'%,var(--y-soft) '+yp+'% '+rp+'%,var(--r-soft) '+rp+'% 100%)'; };
  const scaleRow=(lab,valTxt,valColor,g,pct,mk,delay)=>
    '<div class="det-scale-row"><div class="det-scale-top">'
    +'<span class="det-scale-lab">'+lab+'</span>'
    +'<span class="det-scale-val tnum" style="color:'+valColor+'">'+valTxt+'</span></div>'
    +'<div class="det-scale-bar" style="background:'+g+'"><span class="det-scale-mk" style="left:'+pct+'%;background:'+mk+';animation-delay:'+delay+'s"></span></div></div>';

  let html='<div class="det-hero">'
    +'<span class="det-pill" style="background:'+CAT_SOFT[oc]+';color:'+CAT_INK[oc]+'"><span class="d" style="background:'+CAT_BAR[oc]+'"></span>'+CAT_LABEL[oc]+'</span>'
    +'<div class="det-nums">'
      +'<div class="det-col"><span class="det-num tnum" style="color:'+CAT_INK[sc]+'">'+e.sys+'</span><span class="det-num-l" style="color:'+CAT_INK[sc]+'">SYS</span></div>'
      +'<span class="det-slash">/</span>'
      +'<div class="det-col"><span class="det-num tnum" style="color:'+CAT_INK[dc]+'">'+e.dia+'</span><span class="det-num-l" style="color:'+CAT_INK[dc]+'">DIA</span></div>'
    +'</div>'
    +'<div class="det-meta">mmHg<span class="sep"></span><span class="hb">'+IC_HEART+'<b class="tnum">'+e.pulse+'</b> Puls</span></div>'
  +'</div>';
  html+='<div class="det-card det-date"><div class="det-date-ic">'+IC_CAL+'</div>'
    +'<div class="det-date-main"><div class="det-date-1">'+fullDate+'</div>'
    +'<div class="det-date-2">'+time+'<span class="sep"></span>'+(tod==='abends'?IC_MOON:IC_SUN)+tod+'</div></div></div>';
  html+='<div class="det-card det-scale"><div class="det-scale-h">POSITION IM AMPELBEREICH</div>'
    +scaleRow('Systolisch',e.sys+' · '+CAT_LABEL[sc],CAT_INK[sc],grad(90,80,t.sysY,t.sysR),sysPct,CAT_BAR[sc],0.06)
    +scaleRow('Diastolisch',e.dia+' · '+CAT_LABEL[dc],CAT_INK[dc],grad(50,60,t.diaY,t.diaR),diaPct,CAT_BAR[dc],0.14)
  +'</div>';
  html+='<div class="det-ctx">'+detContext(e)+'</div>';
  if(e.note) html+='<div class="det-card det-note">'+IC_NOTE+'<div class="det-note-txt">„'+escapeHtml(e.note)+'"</div></div>';
  $('#detBody').innerHTML=html;
}
/* Detail-Aktionen: Zurück / Bearbeiten / Löschen. */
$('#detBack').addEventListener('click',()=>navBack());
$('#detEdit').addEventListener('click',()=>{ const e=entries.find(x=>x.id===detailId); if(e) startCapture(e,'detail'); });
$('#detDelete').addEventListener('click',()=>{
  const e=entries.find(x=>x.id===detailId); if(!e) return;
  const prev='<div class="pd">'+fmtDate(e.ts)+' · '+fmtTime(e.ts)+'</div>'
    +'<div class="pv"><span style="color:'+CAT_INK[catValFor('sys',e.sys)]+'">'+e.sys+'</span> / <span style="color:'+CAT_INK[catValFor('dia',e.dia)]+'">'+e.dia+'</span> · Puls '+e.pulse+'</div>';
  askConfirm({icon:'trash',tone:'danger',danger:true,title:'Eintrag löschen?',message:'Dieser Eintrag wird dauerhaft entfernt.',previewHTML:prev,confirmLabel:'Löschen'})
    .then(ok=>{ if(ok){ removeEntry(detailId); navBack(); toast('Eintrag gelöscht'); } });
});

/* ---------- Diagramm (Variante A, SVG) ----------
   Eigener Vollbild-Screen. Unten die Steuerleiste: Reihe (Sys/Dia/Beide) · Puls-Umschalter ·
   Zeitraum-Popover (teilt sich Zeitraum + getFiltered mit dem Verlauf). Grafik: Verbindungslinien
   + Ampel-Farbpunkte (catVal), gestrichelte Ø-Linie, KEINE Hintergrund-Zonen. Einzelmodus mit
   Zonen-Labels + 3 Statistik-Kacheln; „Beide" mit zwei Ø-Werten + Statistik-Tabelle (Sys/Dia/Puls
   × Ø/Max/Min) und optionaler rosa Puls-Spur. Datenlogik unverändert (nur neue Darstellung). */
let diagSeries='both', diagPulse=false;
let lastChartList=null, pulseFadeTimer=null;   // fürs Teil-Update der Puls-Ebene (setDiagPulseLayer)
const prefersReduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const DG_SHORT={'7':'7 Tage','30':'30 Tage','90':'90 Tage','custom':'Zeitraum'};

/* Kennzahlen einer Reihe (Sys oder Dia) inkl. Ampel-Verteilung – deckungsgleich mit dem Entwurf. */
function seriesStats(list,key){
  const t=settings.thr, thY=key==='sys'?t.sysY:t.diaY, thR=key==='sys'?t.sysR:t.diaR;
  const vals=list.map(m=>m[key]), n=vals.length||1;
  let green=0,yellow=0,red=0;
  vals.forEach(v=>{ const c=catVal(v,thY,thR); if(c==='r')red++; else if(c==='y')yellow++; else green++; });
  const avg=Math.round(vals.reduce((a,b)=>a+b,0)/n);
  return { thY, thR, green, yellow, red, avg,
    max:vals.length?Math.max(...vals):0, min:vals.length?Math.min(...vals):0, cat:catVal(avg,thY,thR) };
}
/* Kontext-Satz aus der Ampel-Verteilung (rein beschreibend, keine Wertung). */
function contextDiag(g,ye,rd,cat){
  const strong = cat==='g' ? 'Dein Schnitt liegt im Ziel.'
               : cat==='y' ? 'Dein Schnitt ist erhöht.'
               : 'Dein Schnitt ist zu hoch.';
  const rest = rd>0 ? rd+(rd===1?' Wert lag':' Werte lagen')+' im roten Bereich, der Rest überwiegend im Ziel.'
             : ye>0 ? 'Keine roten Werte — '+ye+' erhöht, der Rest im Ziel.'
             : 'Alle Werte im Ziel — sehr gut.';
  return { strong, rest };
}

/* Baut die eigentliche SVG-Grafik (viewBox 268×H). Farben werden auf konkrete Werte aufgelöst,
   damit sie in Hell/Dunkel stimmen (renderChart läuft bei Theme-Wechsel erneut). */
function buildDiagChart(list){
  const t=settings.thr, both=diagSeries==='both', showPulse=diagPulse;
  const keys=both?['sys','dia']:[diagSeries], n=list.length, anim=!prefersReduce();
  const xL=14,xR=232,bpTop=12,bpBottom=140, chartH=showPulse?172:164, datesY=showPulse?168:158;
  const R={ ink:cssVar('--ink'), muted:cssVar('--muted'), accent:cssVar('--accent'), surf:cssVar('--surf'),
    gInk:cssVar('--g-ink'), yInk:cssVar('--y-ink'), rInk:cssVar('--r-ink'),
    gBar:cssVar('--g-bar'), yBar:cssVar('--y-bar'), rBar:cssVar('--r-bar'),
    pBar:cssVar('--pulse-bar'), pInk:cssVar('--pulse-ink') };
  const barOf=c=>c==='r'?R.rBar:c==='y'?R.yBar:R.gBar;

  let lo=Infinity,hi=-Infinity;
  keys.forEach(k=>{ const y=k==='sys'?t.sysY:t.diaY, r=k==='sys'?t.sysR:t.diaR;
    list.forEach(m=>{ if(m[k]<lo)lo=m[k]; if(m[k]>hi)hi=m[k]; });
    hi=Math.max(hi,r); lo=Math.min(lo,y-8); });
  const vmax=hi+8, vmin=lo-8, span=(vmax-vmin)||1;
  const Y=v=>+(bpBottom-(v-vmin)/span*(bpBottom-bpTop)).toFixed(1);
  const X=i=>n<=1?(xL+xR)/2:+(xL+i*(xR-xL)/(n-1)).toFixed(1);
  let s='';

  if(both){                                            // waagerechte Hilfslinien nur im „Beide"-Modus
    for(let v=Math.ceil(vmin/20)*20; v<=vmax; v+=20){
      s+='<line x1="0" y1="'+Y(v)+'" x2="'+xR+'" y2="'+Y(v)+'" stroke="'+R.ink+'" stroke-opacity=".07" stroke-width="1"/>';
      s+='<text x="236" y="'+(Y(v)+3)+'" font-size="7.5" font-weight="700" fill="'+R.muted+'">'+v+'</text>';
    }
  }
  keys.forEach(k=>{                                    // gestrichelte Ø-Linie je Reihe
    const st=seriesStats(list,k);
    s+='<line x1="0" y1="'+Y(st.avg)+'" x2="'+xR+'" y2="'+Y(st.avg)+'" stroke="'+R.accent+'" stroke-width="1.5" stroke-dasharray="4 3" opacity=".85"/>';
    s+='<text x="2" y="'+(Y(st.avg)-3)+'" font-size="8" font-weight="800" fill="'+R.accent+'">Ø</text>';
  });
  if(!both){                                           // Zonen-Labels rechts (Einzelmodus)
    const st=seriesStats(list,diagSeries);
    const zl=(txt,val,col)=>'<text x="236" y="'+(Y(val)+3)+'" font-size="8" font-weight="800" fill="'+col+'" text-anchor="end">'+txt+'</text>';
    s+=zl('Zu hoch',(st.thR+vmax)/2,R.rInk)+zl('Erhöht',(st.thY+st.thR)/2,R.yInk)+zl('Im Ziel',(vmin+st.thY)/2,R.gInk);
  }
  keys.forEach(k=>{                                    // Verbindungslinien (dezent)
    const pts=list.map((m,i)=>X(i)+','+Y(m[k])).join(' ');
    s+='<polyline'+(anim?' class="dg-line"':'')+' points="'+pts+'" fill="none" stroke="'+R.accent+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>';
  });
  keys.forEach(k=>{                                    // Datenpunkte in Ampelfarbe
    const yy=k==='sys'?t.sysY:t.diaY, rr=k==='sys'?t.sysR:t.diaR;
    list.forEach((m,i)=>{ const last=!both&&i===n-1, rad=last?4.6:3.4, c=catVal(m[k],yy,rr);
      s+='<circle'+(anim?' class="dg-pt"':'')+' cx="'+X(i)+'" cy="'+Y(m[k])+'" r="'+rad+'" fill="'+barOf(c)+'" stroke="'+R.surf+'" stroke-width="1.4"'+(anim?' style="animation-delay:'+(0.34+i*0.03).toFixed(2)+'s"':'')+'/>';
    });
  });
  if(showPulse) s+=diagPulseLayer(list,anim);
  s+='<g class="dg-dates">'+diagDateLabels(list,n,X,datesY,R.muted)+'</g>';

  return '<svg class="dg-svg" viewBox="0 0 268 '+chartH+'" width="100%" style="display:block">'+s+'</svg>';
}
/* Datums-Beschriftung unter der Grafik (erster/mittlerer/letzter Punkt) – eigene Funktion, damit
   der Puls-Umschalter (setDiagPulseLayer) nur die Y-Position verschieben muss statt das ganze
   Diagramm neu zu bauen. */
function diagDateLabels(list,n,X,y,muted){
  const dlab=(idx,anchor)=>{ const m=list[idx]; if(!m) return ''; const d=new Date(m.ts);
    return '<text class="dg-datelabel" x="'+X(idx)+'" y="'+y+'" font-size="8" font-weight="600" fill="'+muted+'" text-anchor="'+anchor+'">'+pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.</text>'; };
  return dlab(0,'start')+(n>2?dlab(Math.floor((n-1)/2),'middle'):'')+dlab(n-1,'end');
}
/* Eigene rosa Puls-Spur (Linie+Punkte+„bpm") als austauschbare Ebene <g class="dg-pulse-g">:
   dieselbe Funktion baut sie sowohl beim vollen Diagramm-Aufbau (anim=Einblend-Reihenfolge der
   ganzen Grafik) als auch beim Ein-/Ausblenden über den Puls-Umschalter (setDiagPulseLayer,
   anim=eigene Zeichen-Animation), damit die Koordinaten nie auseinanderlaufen. */
function diagPulseLayer(list,anim){
  const xL=14,xR=232,n=list.length;
  const X=i=>n<=1?(xL+xR)/2:+(xL+i*(xR-xL)/(n-1)).toFixed(1);
  const pv=list.map(m=>m.pulse), pmin=Math.min(...pv)-6, pmax=Math.max(...pv)+6, laneTop=146,laneBot=160;
  const PY=v=>+(laneBot-(v-pmin)/((pmax-pmin)||1)*(laneBot-laneTop)).toFixed(1);
  const pBar=cssVar('--pulse-bar'), pInk=cssVar('--pulse-ink'), surf=cssVar('--surf');
  let s='<g class="dg-pulse-g">';
  s+='<polyline'+(anim?' class="dg-line"':'')+' points="'+list.map((m,i)=>X(i)+','+PY(m.pulse)).join(' ')+'" fill="none" stroke="'+pBar+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
  list.forEach((m,i)=>{ s+='<circle'+(anim?' class="dg-pt"':'')+' cx="'+X(i)+'" cy="'+PY(m.pulse)+'" r="2.5" fill="'+pBar+'" stroke="'+surf+'" stroke-width="1.1"'+(anim?' style="animation-delay:'+(0.4+i*0.03).toFixed(2)+'s"':'')+'/>'; });
  s+='<text x="236" y="'+(PY(pmax)+8)+'" font-size="7.5" font-weight="800" fill="'+pInk+'">bpm</text>';
  s+='</g>';
  return s;
}
/* Puls-Umschalter: baut NICHT das ganze Diagramm neu (renderChart), sondern fügt nur die
   Puls-Ebene ein bzw. blendet sie aus – Sys/Dia-Linien/-Punkte bleiben unberührt und spielen
   ihre Einblend-Animation nicht erneut ab. Höhe/Datumszeile springen mit (kein eigener
   Animationswunsch dafür), die Puls-Ebene selbst zeichnet sich ein bzw. blendet aus. */
function setDiagPulseLayer(show){
  const svg=$('#dgBody .dg-svg');
  if(!svg){ renderChart(); return; }                   // kein Diagramm sichtbar (z. B. leere Liste) → normal aufbauen
  clearTimeout(pulseFadeTimer);
  const list=lastChartList||[];
  const applySize=()=>{
    svg.setAttribute('viewBox','0 0 268 '+(show?172:164));
    $$('.dg-datelabel',svg).forEach(t=>t.setAttribute('y',show?168:158));
  };
  const old=$('.dg-pulse-g',svg);
  if(show){
    if(old) old.remove();                              // Rest einer noch ausblendenden Ebene entfernen
    applySize();
    $('.dg-dates',svg).insertAdjacentHTML('beforebegin', diagPulseLayer(list,!prefersReduce()));
  } else if(old){
    if(prefersReduce()){ old.remove(); applySize(); return; }
    old.classList.add('out');
    pulseFadeTimer=setTimeout(()=>{ old.remove(); applySize(); },220);
  } else applySize();
}

function renderChart(){
  applyVerlaufRange();                                 // gemeinsamer Zeitraum mit dem Verlauf
  const list=getFiltered().slice().sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  lastChartList=list;                                  // fürs Teil-Update der Puls-Ebene (setDiagPulseLayer)
  const both=diagSeries==='both', short=DG_SHORT[verlaufRange]||'30 Tage';
  $('#dgSub').textContent='Blutdruck · '+short+' · '+list.length+(list.length===1?' Messung':' Messungen');
  $$('#dgSeg .dg-seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.s===diagSeries));
  $('#dgPulse').classList.toggle('active',diagPulse);
  $$('#dgPop button').forEach(b=>b.classList.toggle('active',b.dataset.r===verlaufRange));

  const body=$('#dgBody');
  if(!list.length){ body.innerHTML='<div class="dg-card"><div class="dg-empty">Noch keine Daten im gewählten Zeitraum.</div></div>'; return; }

  const sst=seriesStats(list,'sys'), dst=seriesStats(list,'dia'), st=diagSeries==='dia'?dst:sst;
  const pulseAvg=Math.round(list.reduce((a,m)=>a+m.pulse,0)/list.length);
  let og=0,oy=0,orr=0;                                 // Gesamt-Ampel je Messung (schlechterer von Sys/Dia)
  list.forEach(m=>{ const ov=worseCat(catValFor('sys',m.sys),catValFor('dia',m.dia)); if(ov==='r')orr++; else if(ov==='y')oy++; else og++; });
  const overallCat=worseCat(sst.cat,dst.cat);

  /* Kopf der Karte: großer Ø-Wert (+ Status-Pille im Einzelmodus). */
  let valHtml, statusHtml='';
  if(both){
    valHtml='<div class="dg-val"><span class="dg-val-num both tnum">'
      +'<span style="color:'+CAT_INK[sst.cat]+'">'+sst.avg+'</span>'
      +'<span class="dg-val-slash">/</span>'
      +'<span style="color:'+CAT_INK[dst.cat]+'">'+dst.avg+'</span></span>'
      +'<span class="dg-val-side"><span class="dg-val-unit">mmHg</span><span class="dg-val-sub">Ø · '+short+'</span></span></div>';
  } else {
    valHtml='<div class="dg-val"><span class="dg-val-num tnum" style="color:'+CAT_INK[st.cat]+'">'+st.avg+'</span>'
      +'<span class="dg-val-side"><span class="dg-val-unit">mmHg</span><span class="dg-val-sub">Ø '+(diagSeries==='sys'?'Systolisch':'Diastolisch')+'</span></span></div>';
    statusHtml='<span class="dg-status" style="background:'+CAT_SOFT[st.cat]+';color:'+CAT_INK[st.cat]+'"><span class="d" style="background:'+CAT_BAR[st.cat]+'"></span>'+CAT_LABEL[st.cat]+'</span>';
  }

  /* Legende unter der Grafik. */
  let legHtml;
  if(both){
    legHtml='<div class="dg-legend both">'
      +'<span style="color:var(--g-ink)">'+og+' Im Ziel</span>'
      +'<span style="color:var(--y-ink)">'+oy+' Erhöht</span>'
      +'<span style="color:var(--r-ink)">'+orr+' Zu hoch</span></div>';
  } else {
    legHtml='<div class="dg-legend single">'
      +'<span class="avg" style="color:var(--accent)"><i style="border-color:var(--accent)"></i>Ø '+st.avg+'</span>'
      +'<span class="cnts"><span style="color:var(--g-ink)">'+st.green+' Im Ziel</span>'
      +'<span style="color:var(--y-ink)">'+st.yellow+' Erhöht</span>'
      +'<span style="color:var(--r-ink)">'+st.red+' Zu hoch</span></span></div>';
  }

  const cardHtml='<div class="dg-card"><div class="dg-cardhead">'+valHtml+statusHtml+'</div>'
    +'<div class="dg-chart">'+buildDiagChart(list)+'</div>'+legHtml+'</div>';

  /* Statistik: „Beide" als Tabelle, Einzelmodus als drei Kacheln. */
  let statHtml;
  if(both){
    const pv=list.map(m=>m.pulse), pMax=Math.max(...pv), pMin=Math.min(...pv);
    const head=(name,unit,pink)=>'<div class="dg-sg-h"><b style="color:'+(pink?'var(--pulse-ink)':'var(--ink)')+'">'+name+'</b><span>'+unit+'</span></div>';
    const vc=(v,col)=>'<div class="dg-sg-v tnum" style="color:'+col+'">'+v+'</div>';
    const rl=x=>'<div class="dg-sg-rl">'+x+'</div>';
    statHtml='<div class="dg-statgrid"><div></div>'+head('Sys','mmHg')+head('Dia','mmHg')+head('Puls','bpm',true)
      +rl('Ø')+vc(sst.avg,CAT_INK[sst.cat])+vc(dst.avg,CAT_INK[dst.cat])+vc(pulseAvg,'var(--pulse-ink)')
      +rl('MAX')+vc(sst.max,'var(--ink)')+vc(dst.max,'var(--ink)')+vc(pMax,'var(--ink)')
      +rl('MIN')+vc(sst.min,'var(--ink)')+vc(dst.min,'var(--ink)')+vc(pMin,'var(--ink)')+'</div>';
  } else {
    const sc=(l,v,col)=>'<div class="dg-stat"><div class="dg-stat-l">'+l+'</div><div class="dg-stat-v tnum" style="color:'+col+'">'+v+'</div></div>';
    statHtml='<div class="dg-stat3">'+sc('HÖCHSTER',st.max,'var(--r-ink)')+sc('NIEDRIGSTER',st.min,'var(--g-ink)')+sc('MESSUNGEN',list.length,'var(--ink)')+'</div>';
  }

  const ctx=both?contextDiag(og,oy,orr,overallCat):contextDiag(st.green,st.yellow,st.red,st.cat);
  body.innerHTML=cardHtml+statHtml+'<div class="dg-ctx"><b>'+ctx.strong+'</b> '+ctx.rest+'</div>';
}

/* Steuerleiste: Reihe · Puls · Zeitraum-Popover. */
function openDgPop(){ $('#dgPop').hidden=false; $('#dgCal').classList.add('active'); }
function closeDgPop(){ $('#dgPop').hidden=true; $('#dgCal').classList.remove('active'); }
$('#dgSeg').addEventListener('click',ev=>{ const b=ev.target.closest('.dg-seg-btn'); if(!b) return;
  if(diagSeries!==b.dataset.s){ diagSeries=b.dataset.s; closeDgPop(); renderChart(); } });
$('#dgPulse').addEventListener('click',()=>{
  diagPulse=!diagPulse; closeDgPop();
  $('#dgPulse').classList.toggle('active',diagPulse);
  setDiagPulseLayer(diagPulse);                        // nur die Puls-Ebene ein-/ausblenden, nicht das ganze Diagramm
});
$('#dgCal').addEventListener('click',()=>{ $('#dgPop').hidden?openDgPop():closeDgPop(); });
$('#dgPop').addEventListener('click',ev=>{ const b=ev.target.closest('button'); if(!b) return;
  closeDgPop();
  if(b.dataset.r==='custom'){ openRangeSheet(); navPush('chart','#rangeSheet'); return; }
  verlaufRange=b.dataset.r; renderChart();
});
/* Tippen außerhalb schließt das Zeitraum-Popover. */
document.addEventListener('click',ev=>{ if($('#dgPop').hidden) return;
  if(!ev.target.closest('#dgPop')&&!ev.target.closest('#dgCal')) closeDgPop(); });

/* ---------- Dashboard (Startseite) ----------
   Kennzahlen nach dashboard-spezifikation.md: rollierende Fenster (7/30 Tage), Trend gegen die
   Vorwoche, Ampel-Verteilung über 30 Tage. Rechnet aus den echten Einträgen (ts/sys/dia/pulse). */
const ageDays=ts=>(Date.now()-new Date(ts).getTime())/86400000;          // Alter eines Eintrags in Tagen
function meanKey(list,key){ return list.length?Math.round(list.reduce((s,e)=>s+e[key],0)/list.length):null; }
function relTime(ts){
  const diff=Date.now()-new Date(ts).getTime();
  const min=Math.round(diff/60000);
  if(min<1) return 'gerade eben';
  if(min<60) return 'vor '+min+' Min.';
  const hrs=Math.round(min/60);
  if(hrs<24) return 'vor '+hrs+' Std.';
  const days=Math.round(hrs/24);
  return days===1?'gestern':'vor '+days+' Tagen';
}
function fmtLongDate(d){ return new Date(d).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'}); }
/* Prozente ganzzahlig runden, aber so, dass die Summe exakt 100 % bleibt (größte Reste zuerst). */
function roundTo100(raw){
  const fl=raw.map(v=>Math.floor(v));
  const rem=100-fl.reduce((a,b)=>a+b,0);
  const order=raw.map((v,i)=>[v-Math.floor(v),i]).sort((a,b)=>b[0]-a[0]);
  for(let k=0;k<rem&&k<order.length;k++) fl[order[k][1]]++;
  return fl;
}
/* Trend-Chip: neutraler Pfeil (rauf/runter/gleich) + Betrag. Bewusst KEINE Wertung gut/schlecht –
   die Farbe trägt die Gesamt-Ampel (siehe Datenspezifikation). '—' wenn kein Vergleich möglich. */
function trendChip(diff){
  if(diff==null) return '<span class="dtrend">—</span>';
  const a=Math.abs(diff);
  const d=diff<0?'M12 5v13M18 12l-6 6-6-6':diff>0?'M12 19V6M6 12l6-6 6 6':'M5 12h14';
  return '<span class="dtrend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>'+a+'</span>';
}
function legRow(color,name,count,pct){
  return '<div class="dleg-row"><span class="dleg-sq" style="background:'+color+'"></span>'
    +'<span class="dleg-name">'+name+'</span>'
    +'<span class="dleg-val"><b>'+count+'</b> · '+pct+'%</span></div>';
}
const IC_GAUGE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 18a8 8 0 1 1 15 0"/><path d="M12 18l3.6-4.6"/><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>';
const IC_ACT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4.5l2-6 3.5 12 2.5-8 1.6 2H22"/></svg>';
const IC_HEART='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.3l-1.4-1.3C5.4 14.2 2 11.1 2 7.6 2 5 4 3 6.5 3c1.7 0 3.3 1 4.1 2.4h.8C12.2 4 13.8 3 15.5 3 18 3 20 5 20 7.6c0 3.5-3.4 6.6-8.6 11.4L12 20.3z"/></svg>';
const IC_DIST='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="2" width="8" height="20" rx="4"/><circle cx="12" cy="7.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="16.5" r="1.6" fill="currentColor" stroke="none"/></svg>';

function renderDashboard(){
  const host=$('#dashboard'); if(!host) return;
  const de=$('#dashDate'); if(de) de.textContent=fmtLongDate(new Date());
  if(!entries.length){
    host.innerHTML='<div class="dcard" style="padding:22px 18px;text-align:center">'
      +'<div style="font-size:15px;font-weight:800;margin-bottom:6px">Noch keine Messung erfasst.</div>'
      +'<div style="font-size:13px;color:var(--muted);line-height:1.5">Tippe unten auf das <b style="color:var(--accent)">+</b>, um deine erste Messung einzutragen.</div>'
      +'</div>';
    return;
  }
  const sorted=entries.slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const last=sorted[0];
  const lc=category(last), sc=catValFor('sys',last.sys), dc=catValFor('dia',last.dia);

  const cur=entries.filter(e=>ageDays(e.ts)<=7);                          // letzte 7 Tage
  const prev=entries.filter(e=>{const a=ageDays(e.ts);return a>7&&a<=14;}); // die 7 Tage davor
  const trend=(k)=>{ const a=meanKey(cur,k),b=meanKey(prev,k); return (a==null||b==null)?null:a-b; };
  const sys7=meanKey(cur,'sys'), dia7=meanKey(cur,'dia'), pul7=meanKey(cur,'pulse');
  const na='<span class="dtile-num" style="color:var(--muted)">–</span>';

  const cur30=entries.filter(e=>ageDays(e.ts)<=30);                       // letzte 30 Tage
  let g=0,y=0,r=0; cur30.forEach(e=>{const c=category(e); if(c==='r')r++;else if(c==='y')y++;else g++;});
  const total=cur30.length;

  let html='';
  // Hero: Letzte Messung – Sys/Dia je in ihrer eigenen Ampelfarbe, dazu die Gesamt-Ampel als Pille
  html+='<div class="dcard dcard-pad">'
    +'<div class="dhero-top">'
      +'<div class="dhead-l"><span class="dicon">'+IC_GAUGE+'</span>'
        +'<div><div class="dhead-t1">Letzte Messung</div><div class="dhead-t2">'+relTime(last.ts)+'</div></div></div>'
      +'<span class="dpill" style="background:'+CAT_SOFT[lc]+';color:'+CAT_INK[lc]+'"><span class="ddot" style="background:'+CAT_BAR[lc]+'"></span>'+CAT_LABEL[lc]+'</span>'
    +'</div>'
    +'<div class="dhero-nums">'
      +'<div style="display:flex;align-items:flex-end;gap:3px">'
        +'<div class="dbig"><span class="n" data-count="'+last.sys+'" style="color:'+CAT_INK[sc]+'">'+last.sys+'</span><span class="l" style="color:'+CAT_INK[sc]+'">SYS</span></div>'
        +'<span class="dslash">/</span>'
        +'<div class="dbig"><span class="n" data-count="'+last.dia+'" style="color:'+CAT_INK[dc]+'">'+last.dia+'</span><span class="l" style="color:'+CAT_INK[dc]+'">DIA</span></div>'
      +'</div>'
      +'<div class="dhero-side"><div class="u">mmHg</div><div class="p">Puls '+last.pulse+'</div></div>'
    +'</div>'
  +'</div>';

  // Kacheln: Ø Blutdruck (7 Tage) mit Trend + Ø Puls (7 Tage) mit Trend
  html+='<div class="dtiles">'
    +'<div class="dtile wide">'
      +'<div class="dhead-l"><span class="dicon">'+IC_ACT+'</span><div><div class="dhead-t1">Blutdruck</div><div class="dhead-t2">Ø 7 Tage · mmHg</div></div></div>'
      +'<div class="dtile-avgs">'
        +'<div class="dtile-col"><div class="dtile-cell">'+(sys7!=null?'<span class="dtile-num">'+sys7+'</span>':na)+'<span class="dtile-lbl">SYS</span></div>'+trendChip(trend('sys'))+'</div>'
        +'<div class="dtile-div"></div>'
        +'<div class="dtile-col"><div class="dtile-cell">'+(dia7!=null?'<span class="dtile-num">'+dia7+'</span>':na)+'<span class="dtile-lbl">DIA</span></div>'+trendChip(trend('dia'))+'</div>'
      +'</div>'
      +'<div class="dtile-foot">vs. Vorwoche</div>'
    +'</div>'
    +'<div class="dtile" style="text-align:center">'
      +'<div class="dhead-l" style="justify-content:center"><span class="dicon pulse">'+IC_HEART+'</span><div class="dhead-t1">Puls</div></div>'
      +'<div class="dtile-pulse"><div class="dtile-cell">'+(pul7!=null?'<span class="dtile-num">'+pul7+'</span>':na)+'<span class="dtile-lbl">BPM</span></div>'+trendChip(trend('pulse'))+'</div>'
      +'<div class="dtile-foot">vs. Vorwoche</div>'
    +'</div>'
  +'</div>';

  // Ampel-Verteilung (30 Tage) als Ring + Legende
  html+='<div class="dcard dcard-pad">'
    +'<div class="dhero-top" style="margin-bottom:12px">'
      +'<div class="dhead-l"><span class="dicon">'+IC_DIST+'</span><div><div class="dhead-t1">Ampel-Verteilung</div><div class="dhead-t2">Letzte 30 Tage</div></div></div>'
      +'<span style="font-size:10.5px;font-weight:700;color:var(--muted)">'+total+' '+(total===1?'Messung':'Messungen')+'</span>'
    +'</div>';
  if(!total){
    html+='<div style="font-size:13px;color:var(--muted);padding:2px 2px 4px">Noch keine Daten in den letzten 30 Tagen.</div>';
  }else{
    const p=roundTo100([g/total*100,y/total*100,r/total*100]), pg=p[0],py=p[1],pr=p[2];
    const seg='conic-gradient(var(--g-bar) 0 '+pg+'%,var(--y-bar) '+pg+'% '+(pg+py)+'%,var(--r-bar) '+(pg+py)+'% 100%)';
    html+='<div class="ddist-body">'
      +'<div class="ring"><div class="ring-fill" style="background:'+seg+'"></div><div class="ring-c"><span class="ring-pct" data-count="'+pg+'" data-suf="%" style="color:var(--g-ink)">'+pg+'%</span><span class="ring-lbl">im Ziel</span></div></div>'
      +'<div class="dleg">'+legRow('var(--g-bar)','Im Ziel',g,pg)+legRow('var(--y-bar)','Erhöht',y,py)+legRow('var(--r-bar)','Zu hoch',r,pr)+'</div>'
    +'</div>';
  }
  html+='</div>';
  host.innerHTML=html;
  animateDashboard();
}

/* Dashboard-Einblendung: die großen Zahlen zählen hoch (Count-up) und der Ampel-Ring
   wird kreisförmig aufgedeckt (Maske dreht von 0° auf 360°). Läuft bei jedem Öffnen des
   Dashboards. Respektiert „Bewegung reduzieren" (prefers-reduced-motion) → sofort Endwert. */
let dashRAF=0;
function animateDashboard(){
  const host=$('#dashboard'); if(!host) return;
  const nums=[...host.querySelectorAll('[data-count]')].map(el=>({el,to:+el.dataset.count,suf:el.dataset.suf||''}));
  const fill=host.querySelector('.ring-fill');
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){
    nums.forEach(n=>{ n.el.textContent=n.to+n.suf; });
    if(fill) fill.style.setProperty('--sweep','360deg');
    return;
  }
  nums.forEach(n=>{ n.el.textContent='0'+n.suf; });
  if(fill) fill.style.setProperty('--sweep','0deg');
  const dur=680,t0=performance.now(),ease=p=>1-Math.pow(1-p,3);
  cancelAnimationFrame(dashRAF);
  const tick=now=>{
    const p=Math.min(1,(now-t0)/dur),e=ease(p);
    nums.forEach(n=>{ n.el.textContent=Math.round(n.to*e)+n.suf; });
    if(fill) fill.style.setProperty('--sweep',(360*e).toFixed(1)+'deg');
    if(p<1) dashRAF=requestAnimationFrame(tick);
  };
  dashRAF=requestAnimationFrame(tick);
}

/* ---------- Export / Import ---------- */
function download(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const csvCell=v=>{ v=String(v); return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
function exportCSV(){
  if(!entries.length){ toast('Noch keine Werte zum Exportieren','notice'); return; }
  const rows=[['Datum','Uhrzeit','Systolisch','Diastolisch','Puls','Notiz']];
  entries.slice().sort((a,b)=>new Date(a.ts)-new Date(b.ts))
    .forEach(e=>rows.push([fmtDate(e.ts),fmtTime(e.ts),e.sys,e.dia,e.pulse,(e.note||'').replace(/\r?\n/g,' ')]));
  const csv='﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`blutdruck-${todayStr()}.csv`);
  toast('CSV exportiert');
}
// Backup-Datei: Inhalt bleibt JSON (JSON.stringify), aber Endung .txt und Typ text/plain –
// einheitlich für alle Backup-Wege und nötig fürs Teilen auf Android (Chrome lehnt .json beim
// share() ab). Wiederherstellen liest per JSON.parse, die Datei-Endung spielt dabei keine Rolle.
function backupName(){ return `blutdruck-pro-backup-${stampDateTime()}.txt`; }
const BACKUP_VER=2;
/* Nur die „Vorlieben" sichern – geräte-interne Erinnerungs-Merker (firstDirtyAt/snoozeUntil) bleiben außen vor. */
function backupSettings(){ const {colorDots,guideLines,theme,accent,reminderDays,thr}=settings; return {colorDots,guideLines,theme,accent,reminderDays,thr}; }
function backupData(){ return {app:'blutdruck',version:BACKUP_VER,exportedAt:new Date().toISOString(),entries,settings:backupSettings()}; }
function backupBlob(){ return new Blob([JSON.stringify(backupData(),null,2)],{type:'text/plain'}); }
function exportJSON(){
  if(!entries.length){ toast('Noch keine Werte zum Sichern','notice'); return; }
  download(backupBlob(),backupName());
  markBackedUp();
  toast('Backup gespeichert');
}

/* Backup über das native Teilen-Menü weitergeben (Cloud/Mail/Messenger); Fallback: Download. */
async function shareBackup(){
  if(!entries.length){ toast('Noch keine Werte zum Sichern','notice'); return; }
  // backupName()/backupBlob() liefern bereits .txt / text/plain (siehe oben).
  const file=new File([backupBlob()],backupName(),{type:'text/plain'});
  if(!(navigator.canShare && navigator.canShare({files:[file]}))){  // Teilen nicht möglich → Download
    $('#menuDlg').close(); exportJSON(); return;
  }
  // Diagnose-Werte GENAU vor dem Teilen festhalten (für die Fehlersuche am Handy):
  // War die frische Tipp-Erlaubnis (Nutzer-Aktivierung) aktiv? Läuft die App als installierte
  // PWA oder als Browser-Tab? Welcher Browser? (z. B. Samsung Internet teilt Dateien oft nicht.)
  const ua=navigator.userActivation;
  const act=ua?('act='+ua.isActive+'/'+ua.hasBeenActive):'act=?';
  const mode=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)?'PWA':'Tab';
  const m=/SamsungBrowser\/[\d.]+|Edg\/\d+|Chrome\/\d+|Firefox\/\d+/.exec(navigator.userAgent||'');
  const brand=m?m[0]:'Browser?';
  try{
    // Menü NICHT vor dem Teilen schließen: sonst geht auf Android die frische Tipp-Erlaubnis
    // (transiente Nutzer-Aktivierung) verloren und das Teilen wird blockiert. Erst danach schließen.
    await navigator.share({files:[file]});   // ohne title – manche Ziele lehnen die Kombi sonst ab
    markBackedUp(); toast('Backup geteilt'); $('#menuDlg').close();
  }catch(e){
    if(e&&e.name==='AbortError') return;      // Nutzer hat das Teilen abgebrochen – Menü offen lassen
    $('#menuDlg').close();
    // Teilen ging nicht – freundlich erklären und den Nutzer entscheiden lassen, ob stattdessen
    // heruntergeladen wird. Technische Info nachgestellt (zum Vorlesen/Abfotografieren für die Diagnose).
    const err=e?((e.name||'Fehler')+(e.message?': '+e.message:'')):'Unbekannter Fehler';
    const info=err+' · '+act+' · '+mode+' · '+brand;
    const wantSave=await askConfirm({
      icon:'info',tone:'notice',title:'Teilen nicht möglich',
      message:'Das direkte Teilen hat dein Browser oder Handy nicht erlaubt. Stattdessen als Datei speichern?',
      detailsText:info,confirmLabel:'Speichern'
    });
    if(wantSave){ download(backupBlob(),backupName()); markBackedUp(); toast('Backup gespeichert'); }
  }
}

/* Auto-Backup-Datei: einmal anlegen/wählen, danach immer dieselbe Datei automatisch überschreiben.
   Nur Chromium (Chrome/Edge/Android); sonst ausgegraut. Beide System-Dialoge nötig:
   Speichern (neu anlegen) UND Öffnen (bestehende wählen). */
const FS_SUPPORTED=typeof window.showSaveFilePicker==='function'&&typeof window.showOpenFilePicker==='function';

/* „Neue Datei anlegen": Speichern-Dialog ist hier korrekt (man legt bewusst neu an).
   Datei anlegen, sofort verknüpfen und den aktuellen Stand hineinschreiben. */
async function createBackupFile(){
  if(!FS_SUPPORTED){ toast('Auf diesem Gerät nicht verfügbar','notice'); return; }
  try{
    const handle=await window.showSaveFilePicker({
      suggestedName:'blutdruck-pro-backup.txt',
      types:[{description:'Textdatei',accept:{'text/plain':['.txt']}}]
    });
    await idbSetMeta('backupHandle',handle);
    await writeToHandle(handle);
    await refreshLinkFileUI();
    toast('Backup-Datei angelegt & verknüpft');
  }catch(e){ if(e&&e.name!=='AbortError') toast('Anlegen fehlgeschlagen','error'); }
}
/* „Bestehende wählen"/„Datei ändern": Öffnen-Dialog (kein Vorschlagsname, keine „Ersetzen?"-Frage).
   Datensicher: erst Datei-Inhalt einlesen und mit den App-Daten ZUSAMMENFÜHREN (damit eine reichere
   Datei nichts verliert), dann verknüpfen und den vereinigten Stand zurückschreiben. */
async function pickBackupFile(){
  if(!FS_SUPPORTED){ toast('Auf diesem Gerät nicht verfügbar','notice'); return; }
  try{
    const [handle]=await window.showOpenFilePicker({
      types:[{description:'Backup-Datei',accept:{'text/plain':['.txt'],'application/json':['.json']}}],
      multiple:false
    });
    if(!(await ensurePerm(handle))){ toast('Keine Schreibrechte für die Datei','error'); return; }
    let merged=null;
    try{ merged=mergeEntriesFromData(JSON.parse(await (await handle.getFile()).text())); }catch{}
    await idbSetMeta('backupHandle',handle);
    await writeToHandle(handle);
    await refreshLinkFileUI();
    toast(merged&&merged.added ? 'Verknüpft · '+merged.added+' neu übernommen' : 'Backup-Datei verknüpft');
    if(merged) offerSettingsRestore(merged.settings);
  }catch(e){ if(e&&e.name!=='AbortError') toast('Verknüpfen fehlgeschlagen','error'); }
}
/* Verknüpfung lösen: die Datei selbst bleibt unangetastet, nur das Handle wird vergessen. */
async function unlinkBackupFile(){
  try{ await idbSetMeta('backupHandle',null); }catch{}
  await refreshLinkFileUI();
  toast('Verknüpfung gelöst','notice');
}
async function writeToHandle(handle){
  const w=await handle.createWritable();
  await w.write(backupBlob()); await w.close();
  markBackedUp();
}
async function ensurePerm(handle){
  const opt={mode:'readwrite'};
  if(await handle.queryPermission(opt)==='granted') return true;
  return (await handle.requestPermission(opt))==='granted';
}
async function autoBackupIfLinked(){
  if(!FS_SUPPORTED) return;
  try{
    const handle=await idbGetMeta('backupHandle');
    if(!handle || !(await ensurePerm(handle))) return;
    await writeToHandle(handle);
  }catch{}
}
let _abT=0;
function scheduleAutoBackup(){ clearTimeout(_abT); _abT=setTimeout(autoBackupIfLinked,1500); }
/* Merge-Kern, geteilt von „Backup wiederherstellen" und „Bestehende Datei wählen": vereinigt die
   übergebenen Daten mit den vorhandenen Einträgen (nach id). Gibt {added,updated} zurück oder null,
   wenn nichts Gültiges drinsteckt. */
function mergeEntriesFromData(data){
  const arr=Array.isArray(data)?data:(data&&Array.isArray(data.entries)?data.entries:null);   // altes Array ODER neues Objekt {entries,settings}
  if(!arr) return null;
  const valid=arr.filter(x=>x&&typeof x==='object'&&Number.isFinite(+x.sys)&&Number.isFinite(+x.dia)&&Number.isFinite(+x.pulse)&&x.ts)
    .map(x=>({id:x.id||uid(),ts:new Date(x.ts).toISOString(),sys:+x.sys,dia:+x.dia,pulse:+x.pulse,note:x.note?String(x.note):''}));
  if(!valid.length) return null;
  const map=new Map(entries.map(e=>[e.id,e]));
  let added=0, updated=0;
  valid.forEach(e=>{ if(map.has(e.id)) updated++; else added++; map.set(e.id,e); });
  entries=[...map.values()]; saveEntries(); markDirty(); refreshData();
  return {added,updated,settings:(!Array.isArray(data)&&data&&data.settings)||null};
}
/* Im Backup enthaltene Einstellungen auf Wunsch übernehmen (geteilt von „Wiederherstellen" und „Auswählen"/„Ändern"). */
let _pendingRestoreSettings=null;
function offerSettingsRestore(s){
  if(!s || typeof s!=='object') return;
  _pendingRestoreSettings=s;
  $('#restoreDlg').showModal();          // eigenes Fenster statt Browser-confirm (sprechende Knopf-Texte)
}
function applyBackupSettings(s){
  ['colorDots','guideLines','theme','accent','reminderDays','thr'].forEach(k=>{ if(s[k]!==undefined) settings[k]=s[k]; });
  settings.thr=Object.assign({},SET_DEFAULT.thr,settings.thr||{});
  saveSettings(); applyTheme(); applySettingsUI(); renderTable();
  if(currentTab==='chart') renderChart();
  toast('Einstellungen übernommen');
}
function importJSON(file){
  const r=new FileReader();
  r.onload=()=>{
    let res=null;
    try{ res=mergeEntriesFromData(JSON.parse(r.result)); }catch{}
    if(res){ toast(`Wiederhergestellt: ${res.added} neu, ${res.updated} aktualisiert`); offerSettingsRestore(res.settings); }
    else toast('Wiederherstellen fehlgeschlagen: ungültige Datei','error');
  };
  r.readAsText(file);
}

/* Alle Messwerte löschen. Die externe Backup-Datei bleibt erhalten und wird NICHT überschrieben:
   Auto-Backup wird abgebrochen und die Verknüpfung gelöst. */
async function clearAllData(){
  const n=entries.length;
  const ok=await askConfirm({
    icon:'trash',tone:'danger',danger:true,title:'Alle Daten löschen?',
    messageHTML:'Alle <b>'+n+' Messwerte</b> werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.',
    noteText:'Eine bereits gespeicherte Backup-Datei bleibt erhalten, wird aber nicht mehr automatisch aktualisiert.',
    requireCheck:'Ja, ich möchte alle '+n+' Werte löschen',confirmLabel:'Alle löschen'
  });
  if(!ok) return;
  clearTimeout(_abT);                         // kein Auto-Backup der leeren Liste auslösen
  entries=[];
  try{ localStorage.removeItem(LS_KEY); }catch{}
  try{ if(_db){ await idbWriteAll([]); await idbSetMeta('backupHandle',null); } }catch{}
  markBackedUp(); refreshData();
  $('#menuDlg').close();
  toast('Alle Daten gelöscht');
}
$('#mExportCsv').addEventListener('click',()=>{ $('#menuDlg').close(); exportCSV(); });
$('#mExportJson').addEventListener('click',()=>{ $('#menuDlg').close(); exportJSON(); });
$('#mShare').addEventListener('click',()=>{ shareBackup(); });   // Menü erst nach dem Teilen schließen (Gesten-Schutz)
// Nicht unterstützte Optionen sichtbar lassen, aber deaktivieren + kurzen Grund anzeigen
const SHARE_SUPPORTED=!!(navigator.canShare&&(()=>{ try{ return navigator.canShare({files:[new File([''],'x.txt',{type:'text/plain'})]}); }catch{ return false; } })());
function disableMenuItem(btnId,reasonId,text){ const b=$('#'+btnId); if(b) b.disabled=true; const r=$('#'+reasonId); if(r){ r.textContent=text; r.hidden=false; } }
if(!SHARE_SUPPORTED) disableMenuItem('mShare','mShareReason','Dein Browser kann das Teilen nicht.');
// Auto-Backup-Datei: Name der verknüpften Datei + Aktionen anzeigen/aktualisieren.
// (Browser geben aus Sicherheitsgründen nur den Dateinamen her – keinen vollständigen Pfad,
//  und können die Datei/den Ordner nicht im Datei-Manager öffnen.)
/* Auto-Backup-Bereich auffrischen: Zustandstext (rot/grün) + die zwei Knöpfe (Text & Aktion) je
   nachdem, ob eine Datei verknüpft ist. Bei nicht unterstütztem Browser ausgegraut mit Grund. */
async function refreshLinkFileUI(){
  const box=$('#linkFileBox'), name=$('#linkFileName'), b1=$('#lfBtn1'), b2=$('#lfBtn2');
  if(!box) return;
  if(!FS_SUPPORTED){                        // Browser kann keine Datei-Verknüpfung → ausgrauen + Grund
    box.style.opacity='.5'; b1.disabled=b2.disabled=true;
    name.textContent='Auf diesem Gerät nicht verfügbar'; name.className='reason';
    b1.textContent='Neu anlegen'; b2.textContent='Auswählen';
    return;
  }
  box.style.opacity=''; b1.disabled=b2.disabled=false;
  let handle=null; try{ handle=await idbGetMeta('backupHandle'); }catch{}
  if(handle){                               // verknüpft → grün; links „Lösen", rechts „Ändern"
    name.textContent='Verknüpft: '+handle.name; name.className='reason is-linked';
    b1.textContent='Lösen';   b1.onclick=unlinkBackupFile;
    b2.textContent='Ändern';  b2.onclick=pickBackupFile;
  }else{                                    // nicht verknüpft → rot; links „Neu anlegen", rechts „Auswählen"
    name.textContent='Keine Datei verknüpft'; name.className='reason is-unlinked';
    b1.textContent='Neu anlegen'; b1.onclick=createBackupFile;
    b2.textContent='Auswählen';   b2.onclick=pickBackupFile;
  }
}
$('#mImport').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',e=>{ if(e.target.files[0]){ $('#menuDlg').close(); importJSON(e.target.files[0]); } e.target.value=''; });
$('#mClearAll').addEventListener('click',clearAllData);
$('#mHelp').addEventListener('click',()=>{ $('#menuDlg').close(); $('#helpDlg').showModal(); });
// Aufklappbare Abschnitte öffnen/schließen
$$('#menuDlg .acc-head[aria-controls]').forEach(h=>h.addEventListener('click',()=>{
  const open=h.getAttribute('aria-expanded')==='true';
  // Immer nur EIN Abschnitt offen: erst alle schließen ...
  $$('#menuDlg .acc-head[aria-controls]').forEach(o=>{
    o.setAttribute('aria-expanded','false');
    $('#'+o.getAttribute('aria-controls')).classList.remove('open');
    o.closest('.acc-sec').classList.remove('open');
  });
  // ... dann nur den geklickten öffnen, falls er vorher zu war (sonst bleibt alles zu)
  if(!open){
    h.setAttribute('aria-expanded','true');
    $('#'+h.getAttribute('aria-controls')).classList.add('open');
    h.closest('.acc-sec').classList.add('open');   // Karten-Optik des offenen Abschnitts
  }
}));
// Speicher-Status: dauerhaft gesichert? wie viel belegt?
// Belegter Speicher als reine Info – mit Kapazität und Prozent, sofern der Browser eine Quota
// liefert. Der frühere Persistenz-Status („Dauerhaft gesichert?" + „Aktivieren"-Link) entfällt:
// dauerhaften Speicher fordert die App ohnehin beim Start automatisch an (requestPersistence in
// init), und die Backups sichern zusätzlich ab.
const fmtBytes=b=>{ const mb=b/1048576; return (mb>=1024?(mb/1024).toFixed(1)+' GB':mb.toFixed(1)+' MB').replace('.',','); };
async function updateStorageStatus(){
  const el=$('#storageStatus'); if(!el) return;
  try{
    const est=(navigator.storage&&navigator.storage.estimate)?await navigator.storage.estimate():null;
    if(est&&est.usage!=null){
      let t=fmtBytes(est.usage)+' belegt';
      if(est.quota){                       // Kapazität bekannt → „belegt von Kapazität · Prozent"
        const pct=est.usage/est.quota*100, pctStr=pct<0.1?'<0,1':pct.toFixed(1).replace('.',',');
        t=fmtBytes(est.usage)+' von '+fmtBytes(est.quota)+' belegt · '+pctStr+' %';
      }
      el.textContent=t; el.hidden=false;
    } else el.hidden=true;
  }catch{ el.hidden=true; }
}

/* ---------- Backup-Erinnerung ---------- */
const DAY=86400000;
function markDirty(){ if(!settings.firstDirtyAt){ settings.firstDirtyAt=new Date().toISOString(); persistSettings(); } }
function markBackedUp(){ settings.firstDirtyAt=null; settings.snoozeUntil=0; persistSettings(); updateReminder(); }   // persistSettings statt saveSettings: kein erneutes Auto-Backup (sonst Endlosschleife)
function reminderDaysDue(){
  const d=+settings.reminderDays||0;
  if(d<=0||!entries.length||!settings.firstDirtyAt) return 0;
  if(Date.now()<(settings.snoozeUntil||0)) return 0;
  const days=Math.floor((Date.now()-new Date(settings.firstDirtyAt).getTime())/DAY);
  return days>=d?days:0;
}
function updateReminder(){
  const days=reminderDaysDue(), el=$('#reminder');
  if(days){
    $('#reminderMsg').textContent=`Seit ${days} ${days===1?'Tag':'Tagen'} ungesicherte Änderungen – jetzt ein Backup speichern?`;
    el.hidden=false;
  } else el.hidden=true;
}
$('#reminderSave').addEventListener('click',()=>exportJSON());
$('#reminderLater').addEventListener('click',()=>{ settings.snoozeUntil=Date.now()+DAY; persistSettings(); updateReminder(); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) updateReminder(); });

/* ---------- Einstellungen / Menü ---------- */
/* Akzentfarben: pro Hell-/Dunkelmodus eine eigene, kuratierte Liste statt gemeinsamer Töne nur
   auf-/abgehellt. Grund: --accent trägt an manchen Stellen helle Schrift (braucht dunkle
   Flächen), ist an anderen selbst die Schrift auf der Oberfläche (braucht Kontrast gegen
   --surf) – ein Satz für beide Rollen in beiden Modi ging nicht überall gut auf. `ink` ist die
   Farbe für Schrift/Icon, das AUF der Akzentfläche liegt (--accent-ink); pro Modus dürfen
   Farben fehlen oder nur dort vorkommen (resolveAccent() fängt eine fehlende Auswahl ab). */
const ACCENTS_LIGHT=[
  {key:'azur',     label:'Azur',     c:'#0A6FB4', ink:'#FFFFFF'},
  {key:'kobalt',   label:'Kobalt',   c:'#1E5FE0', ink:'#FFFFFF'},
  {key:'iris',     label:'Iris',     c:'#6E3AE0', ink:'#FFFFFF'},
  {key:'violett',  label:'Violett',  c:'#7C3AED', ink:'#FFFFFF'},
  {key:'amethyst', label:'Amethyst', c:'#8B2FD6', ink:'#FFFFFF'},
  {key:'graphit',  label:'Graphit',  c:'#3A4658', ink:'#FFFFFF'}
];
const ACCENTS_DARK=[
  {key:'aqua',     label:'Aqua',     c:'#2DD4BF', ink:'#0E131C'},
  {key:'himmel',   label:'Himmel',   c:'#38BDF8', ink:'#0E131C'},
  {key:'azur',     label:'Azur',     c:'#4CA3FF', ink:'#FFFFFF'},
  {key:'kobalt',   label:'Kobalt',   c:'#6D9BFF', ink:'#FFFFFF'},
  {key:'amethyst', label:'Amethyst', c:'#A855F7', ink:'#FFFFFF'},
  {key:'silber',   label:'Silber',   c:'#C2CCDE', ink:'#0E131C'}
];
const ACCENT_DEFAULT='kobalt';
/* Gewählten Akzent für einen Modus auflösen; fehlt der Key dort (z. B. „iris" gibt es nur
   hell), greift der Standard. settings.accent bleibt dabei unverändert, damit beim
   Zurückwechseln in den Modus wieder die ursprüngliche Wahl gilt. */
function resolveAccent(dark){
  const list=dark?ACCENTS_DARK:ACCENTS_LIGHT;
  const want=settings.accent||ACCENT_DEFAULT;
  return list.find(a=>a.key===want) || list.find(a=>a.key===ACCENT_DEFAULT) || list[0];
}
/* Effektiver Hell/Dunkel-Zustand: „dark"/„light" fest, sonst der Systemwunsch. */
function resolveDark(){
  const t=settings.theme;
  if(t==='dark') return true;
  if(t==='light') return false;
  return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
/* --accent UND --accent-ink hängen von Akzentwahl UND Hell/Dunkel ab → per JS auf :root
   setzen. Die ganze App folgt automatisch, da alles über var(--accent) läuft (Alias
   --primary → --accent). */
function applyAccent(){
  const acc=resolveAccent(resolveDark());
  document.documentElement.style.setProperty('--accent', acc.c);
  document.documentElement.style.setProperty('--accent-ink', acc.ink);
}
function applyTheme(){
  const t=settings.theme;
  if(t==='auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme',t);
  applyAccent();
}
/* Im Auto-Modus dem Systemwechsel folgen: die Struktur-/Ampelfarben schaltet CSS selbst um,
   nur der modus-abhängige Akzentwert muss nachgezogen werden. */
if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if(settings.theme==='auto'){ applyAccent(); applyAccentSwatches(); } });
function applyThrUI(){
  const t=settings.thr;
  $('#thrSysY').value=t.sysY; $('#thrDiaY').value=t.diaY;
  $('#thrSysR').value=t.sysR; $('#thrDiaR').value=t.diaR;
}
/* Akzent-Auswahl: Punkte komplett neu bauen statt nur umzufärben, denn Hell und Dunkel haben
   jetzt unterschiedliche Farben UND eine unterschiedliche Anzahl eigener Töne (nicht mehr
   dieselben 5 Keys, nur ab-/aufgehellt). Der aktive Ring nutzt currentColor (daher color=c),
   das Häkchen bekommt je Punkt sein eigenes ink (auf hellen Tönen wie Aqua/Silber schwarz). */
function applyAccentSwatches(){
  const dark=resolveDark();
  const list=dark?ACCENTS_DARK:ACCENTS_LIGHT;
  const active=resolveAccent(dark).key;
  $('#accentPick').innerHTML=list.map(a=>
    '<button type="button" class="acc-sw'+(a.key===active?' active':'')+'" data-accent="'+a.key+'" '+
    'aria-label="'+escapeHtml(a.label)+'" style="background:'+a.c+';color:'+a.c+'">'+
    '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="'+a.ink+'" stroke-width="3" '+
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>'+
    '</button>'
  ).join('');
}
function applyThemeSeg(){ $$('#themeSeg [data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===settings.theme)); }
function applySettingsUI(){
  $('#setReminderDays').value=settings.reminderDays;
  applyThemeSeg();
  applyThrUI();
  applyAccentSwatches();
}
$('#menuBtn').addEventListener('click',()=>{ applySettingsUI(); updateStorageStatus(); refreshLinkFileUI(); const cn=$('#csvNote'); if(cn) cn.textContent=entries.length+(entries.length===1?' Messung':' Messungen')+' · für Excel/Tabellen'; $('#menuDlg').showModal(); });
$('#menuClose').addEventListener('click',()=>$('#menuDlg').close());
// Schließen nur, wenn der Klick die Backdrop-Fläche (das Dialog-Element selbst) trifft –
// robust gegen das Neu-Zentrieren beim Auf-/Zuklappen der Abschnitte.
$('#menuDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.close(); });
$('#helpClose').addEventListener('click',()=>$('#helpDlg').close());
$('#helpBack').addEventListener('click',()=>{ $('#helpDlg').close(); $('#menuDlg').showModal(); });   // zurück ins Menü
$('#helpDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.close(); });
// Wiederherstellen-Rückfrage: oben Werte+Einstellungen, unten nur Werte. Raustippen/Esc = nur Werte.
$('#restoreWith').addEventListener('click',()=>{ $('#restoreDlg').close(); const s=_pendingRestoreSettings; _pendingRestoreSettings=null; if(s) applyBackupSettings(s); });
$('#restoreOnly').addEventListener('click',()=>{ _pendingRestoreSettings=null; $('#restoreDlg').close(); });
$('#restoreDlg').addEventListener('cancel',()=>{ _pendingRestoreSettings=null; });
$('#restoreDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget){ _pendingRestoreSettings=null; e.currentTarget.close(); } });
// Bestätigen-Rückfrage (#confirmDlg): OK setzt returnValue='ok', alles andere (Abbrechen/Esc/daneben) = Abbruch.
$('#confirmOk').addEventListener('click',()=>{ const d=$('#confirmDlg'); d.returnValue='ok'; d.close(); });
$('#confirmCancel').addEventListener('click',()=>{ const d=$('#confirmDlg'); d.returnValue=''; d.close(); });
$('#confirmDlg').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.close(); });
// Toast nicht im gerade geschlossenen Fenster „einsperren": zurück in den Body holen, damit eine
// noch sichtbare Meldung nahtlos unten stehen bleibt (z. B. „Backup geteilt" vor dem Schließen).
$$('dialog').forEach(d=>d.addEventListener('close',()=>{ const w=$('#toast'); if(w.parentElement===d) document.body.appendChild(w); }));
// Die Schalter „Werte-Ampel" (colorDots) und „Schwellenwert-Linien" (guideLines) entfielen in Stufe 6:
// Verlauf färbt immer pro Wert, das Diagramm nutzt immer Ampelpunkte + Ø-Linie. Die Schlüssel bleiben
// in settings/Backup (Rückwärtskompatibilität), nur ohne Bedienelement.
$('#setReminderDays').addEventListener('input',e=>{
  let v=parseInt(e.target.value,10); if(!Number.isFinite(v)||v<0) v=0;
  settings.reminderDays=v; saveSettings(); updateReminder();
});
$$('#themeSeg [data-theme]').forEach(b=>b.addEventListener('click',()=>{ settings.theme=b.dataset.theme; saveSettings(); applyTheme(); applyThemeSeg(); applyAccentSwatches(); if(currentTab==='chart') renderChart(); }));
// Akzentfarbe wählen: --accent app-weit setzen (applyAccent), Swatches auffrischen, Diagramm (Ø-Linie) nachziehen.
// Delegiert auf den Container, weil applyAccentSwatches() die Punkte bei jedem Aufruf neu baut.
$('#accentPick').addEventListener('click',e=>{
  const b=e.target.closest('.acc-sw'); if(!b) return;
  settings.accent=b.dataset.accent; saveSettings(); applyAccent(); applyAccentSwatches(); if(currentTab==='chart') renderChart();
});
[['thrSysY','sysY'],['thrDiaY','diaY'],['thrSysR','sysR'],['thrDiaR','diaR']].forEach(([id,key])=>{
  $('#'+id).addEventListener('input',e=>{
    const v=parseInt(e.target.value,10);
    if(Number.isFinite(v)){ settings.thr[key]=v; saveSettings(); renderTable(); if(currentTab==='chart') renderChart(); } // Echtzeit: Tabelle (und Diagramm, falls offen)
  });
});
$('#thrReset').addEventListener('click',()=>{ settings.thr={...SET_DEFAULT.thr}; saveSettings(); applyThrUI(); renderTable(); if(currentTab==='chart') renderChart(); toast('Standardwerte wiederhergestellt','notice'); });

/* ==================== ARZT-REPORT (Druck/PDF) ====================
   Aufbereiteter, druckbarer Bericht für den Arztbesuch (Kompakt-Layout + Querformat-Anhang),
   umgesetzt aus dem Claude-Design-Entwurf. REINE Datenaufbereitung – keine Diagnose/Bewertung.
   Nutzt die vorhandene Logik (meanKey, category, catValFor, todOf, roundTo100, settings.thr).
   Der Report ist IMMER hell (Druck auf Weiß): eigene feste Palette RP statt der theme-abhängigen
   CSS-Variablen; das App-Diagramm (buildDiagChart) bleibt unberührt – der Report bringt seine
   eigene Grafik mit. Der Zustand (reportState) ist BEWUSST flüchtig: bei jedem Öffnen auf Standard
   (Kobalt, 30 Tage, Puls+Namensfeld an, Anhang aus). Nichts davon landet in settings/Backup. */
const RP={
  ink:'#131a26', muted:'#68717f', faint:'#9aa3b2', surf:'#ffffff', surf2:'#f4f6fa', line:'#e5e9f0',
  amp:{ g:{soft:'#e7f6ec',bar:'#16a34a',ink:'#15803d',label:'Im Ziel'},
        y:{soft:'#fdf6ea',bar:'#e0850b',ink:'#b26a00',label:'Erhöht'},
        r:{soft:'#fdeaea',bar:'#dc2626',ink:'#c0261f',label:'Zu hoch'},
        n:{soft:'#f4f6fa',bar:'#c2cad6',ink:'#68717f',label:'—'} },
  pulse:{bar:'#e11d68',ink:'#be185d',soft:'#fdeaf1'},
  acc:{Kobalt:'#1E5FE0',Indigo:'#3B3F9E',Petrol:'#0E7C93',Violett:'#7048C4',Graphit:'#3C4A5E'}
};
const RP_ACC_ORDER=['Kobalt','Indigo','Petrol','Violett','Graphit'];
let reportState={accent:'Kobalt',range:'30',from:null,to:null,puls:true,namen:true,anhang:false};
const rpAcc=()=>RP.acc[reportState.accent]||RP.acc.Kobalt;

const rpIso=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
function rpParseIso(s){ if(!s) return null; const p=s.split('-').map(Number); return new Date(p[0],p[1]-1,p[2]); }
function rpPeriodLabel(from,to){
  const full={day:'numeric',month:'long',year:'numeric'}, part={day:'numeric',month:'long'};
  if(from.getFullYear()===to.getFullYear())
    return from.toLocaleDateString('de-DE',part)+' – '+to.toLocaleDateString('de-DE',full);
  return from.toLocaleDateString('de-DE',full)+' – '+to.toLocaleDateString('de-DE',full);
}
/* Aktuelle Bereichsgrenzen (EIGEN – nicht das geteilte filters-Objekt). Standard-Fenster ab heute. */
function rpRangeDates(){
  const now=new Date(), to=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(reportState.range==='custom'){
    const f=rpParseIso(reportState.from)||new Date(to.getFullYear(),to.getMonth(),to.getDate()-30);
    const t=rpParseIso(reportState.to)||to;
    return f<=t ? {from:f,to:t} : {from:t,to:f};
  }
  const days=reportState.range==='90'?90:30;
  return {from:new Date(to.getFullYear(),to.getMonth(),to.getDate()-days),to:to};
}
/* Kennzahlen bündeln. category()/catValFor() beziehen sich auf settings.thr → Ampel & Fußnote stimmen überein. */
function reportData(from,to){
  const lo=new Date(from.getFullYear(),from.getMonth(),from.getDate()).getTime();
  const hi=new Date(to.getFullYear(),to.getMonth(),to.getDate(),23,59,59,999).getTime();
  const list=entries.filter(e=>{ const t=new Date(e.ts).getTime(); return t>=lo&&t<=hi; });
  const asc=list.slice().sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const desc=list.slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const avgSys=meanKey(list,'sys'), avgDia=meanKey(list,'dia'), avgPul=meanKey(list,'pulse');
  const mm=k=>({min:list.length?Math.min(...list.map(m=>m[k])):0, max:list.length?Math.max(...list.map(m=>m[k])):0});
  const win=key=>{ const a=list.filter(m=>todOf(new Date(m.ts).getHours())===key);
    const s=meanKey(a,'sys'), d=meanKey(a,'dia'), p=meanKey(a,'pulse');
    return {n:a.length, sys:s, dia:d, pul:p, cat:a.length?category({sys:s,dia:d}):'n'}; };
  let g=0,y=0,r=0;
  list.forEach(m=>{ const c=category(m); if(c==='r')r++; else if(c==='y')y++; else g++; });
  const tot=list.length||1, pc=roundTo100([g/tot*100,y/tot*100,r/tot*100]);
  return {
    list, asc, desc, count:list.length,
    avgSys, avgDia, avgPul, catAvg:list.length?category({sys:avgSys,dia:avgDia}):'n',
    tod:{morgens:win('morgens'),tags:win('tagsüber'),abends:win('abends')},
    minmax:{sys:mm('sys'),dia:mm('dia'),pul:mm('pulse')},
    dist:{g,y,r}, pct:{g:pc[0],y:pc[1],r:pc[2]}, above:pc[1]+pc[2],
    period:rpPeriodLabel(from,to),
    created:new Date().toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'})
  };
}

/* ---- kleine Bausteine (feste Palette) ---- */
const rpMark=(sz,color)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none"><polyline points="2.5,12.5 7.5,12.5 10.3,4 13.3,20 15.9,10.5 18,13.3 21.5,13.3" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function rpChip(cat,lg){ const c=RP.amp[cat];
  return `<span style="display:inline-flex;align-items:center;gap:6px;background:${c.soft};color:${c.ink};border-radius:999px;padding:${lg?'5px 13px':'3px 9px'};font-size:${lg?13:11}px;font-weight:800;white-space:nowrap"><span style="width:${lg?8:6}px;height:${lg?8:6}px;border-radius:50%;background:${c.bar}"></span>${c.label}</span>`; }
function rpLegend(showPuls){
  const item=(node,txt)=>`<span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:${RP.muted}">${node}${txt}</span>`;
  const disc=`<span style="width:10px;height:10px;border-radius:50%;background:${RP.ink}"></span>`;
  const ring=`<span style="width:10px;height:10px;border-radius:50%;border:2.4px solid ${RP.ink};box-sizing:border-box"></span>`;
  const dash=`<span style="width:16px;height:0;border-top:2px dashed ${RP.muted}"></span>`;
  let items=item(disc,'Systolisch')+item(ring,'Diastolisch')+item(dash,'Ø Mittel');
  if(showPuls) items+=item(`<span style="width:10px;height:10px;border-radius:50%;background:${RP.pulse.bar}"></span>`,'Puls');
  return `<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px">${items}</div>`;
}
function rpDonut(rep,size,sw){
  const r=42, C=2*Math.PI*r, strokeW=sw||20;
  const segs=[['g',rep.pct.g],['y',rep.pct.y],['r',rep.pct.r]].filter(s=>s[1]>0);
  let off=0, rings='';
  segs.forEach(s=>{ const len=s[1]/100*C;
    rings+=`<circle cx="50" cy="50" r="${r}" fill="none" stroke="${RP.amp[s[0]].bar}" stroke-width="${strokeW}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" stroke-linecap="butt"/>`;
    off+=len; });
  const svg=`<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="transform:rotate(-90deg);display:block"><circle cx="50" cy="50" r="${r}" fill="none" stroke="${RP.line}" stroke-width="${strokeW}"/>${rings}</svg>`;
  const center=`<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1"><span style="font-size:${Math.round(size*0.27)}px;font-weight:800;color:${RP.amp.g.ink}">${rep.pct.g}%</span><span style="font-size:${Math.max(8,Math.round(size*0.1))}px;font-weight:800;letter-spacing:.08em;color:${RP.muted};margin-top:2px">IM ZIEL</span></div>`;
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none">${svg}${center}</div>`;
}
function rpFoot(rep,pageLabel,opt){
  const t=settings.thr;
  const tod=(opt&&opt.noTod)?'':`<div><b style="color:${RP.ink}">Tageszeit: </b>morgens vor 11 Uhr · tagsüber 11–17 Uhr · abends ab 17 Uhr.</div>`;
  return `<div style="margin-top:auto;padding-top:18px;border-top:1px solid ${RP.line};font-size:10.5px;line-height:1.5;color:${RP.muted};display:flex;justify-content:space-between;gap:16px"><div style="max-width:592px;display:flex;flex-direction:column;gap:4px"><div><b style="color:${RP.ink}">Angewendete Grenzwerte: </b>erhöht ab ${t.sysY}/${t.diaY}, zu hoch ab ${t.sysR}/${t.diaR} mmHg.</div>${tod}<div>Rein beschreibende Auswertung der erfassten Werte — keine ärztliche Bewertung oder Diagnose.</div></div><div style="text-align:right;white-space:nowrap">Blutdruck Pro<br>${pageLabel||'Seite 1'}</div></div>`;
}

/* ---- druck-optimierte Grafik (zeit-proportionale X-Achse; detailed = Wert je Punkt, Seite 2) ---- */
function rpChart(rep,W,showPuls,acc,detailed){
  const list=rep.asc, n=list.length;
  if(!n) return '';
  const padL=30, padR=42, top=detailed?22:16;
  const bpBot=detailed?(showPuls?430:520):(showPuls?188:214);
  const pulTop=detailed?476:226, pulBot=detailed?560:260;
  const axisY=showPuls?pulBot:bpBot, dateY=axisY+19, H=dateY+6;
  let lo=Infinity, hi=-Infinity;
  list.forEach(m=>{ lo=Math.min(lo,m.sys,m.dia); hi=Math.max(hi,m.sys,m.dia); });
  lo=Math.floor((lo-6)/10)*10; hi=Math.ceil((hi+6)/10)*10;
  const span=(hi-lo)||1;
  const yb=v=>+(bpBot-(v-lo)/span*(bpBot-top)).toFixed(1);
  const tvs=list.map(m=>new Date(m.ts).getTime());
  const tlo=Math.min(...tvs), thi=Math.max(...tvs), tspan=(thi-tlo)||1;
  const xs=tvs.map(t=> n===1 ? +((padL+(W-padR))/2).toFixed(1) : +(padL+(t-tlo)/tspan*(W-padL-padR)).toFixed(1));
  const catBar=(k,v)=>RP.amp[catValFor(k,v)].bar, catInk=(k,v)=>RP.amp[catValFor(k,v)].ink;
  let s='';
  const gs=detailed?10:20;
  for(let t=Math.ceil(lo/gs)*gs; t<=hi; t+=gs){
    s+=`<line x1="${padL}" y1="${yb(t)}" x2="${W-padR}" y2="${yb(t)}" stroke="${RP.ink}" stroke-opacity=".07" stroke-width="1"/>`;
    s+=`<text x="2" y="${yb(t)+3.4}" font-size="9" font-weight="700" fill="${RP.faint}">${t}</text>`;
  }
  ['sys','dia'].forEach(k=>{ s+=`<polyline points="${list.map((m,i)=>xs[i]+','+yb(m[k])).join(' ')}" fill="none" stroke="#c7d0dd" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`; });
  [['sys',rep.avgSys],['dia',rep.avgDia]].forEach(p=>{
    s+=`<line x1="${padL}" y1="${yb(p[1])}" x2="${W-padR}" y2="${yb(p[1])}" stroke="${acc}" stroke-width="1.4" stroke-dasharray="5 4" opacity=".9"/>`;
    s+=`<text x="${W-padR+4}" y="${yb(p[1])+3.4}" font-size="9.5" font-weight="800" fill="${acc}">Ø ${p[1]}</text>`;
  });
  list.forEach((m,i)=>{ s+=`<circle cx="${xs[i]}" cy="${yb(m.dia)}" r="4.4" fill="#fff" stroke="${catBar('dia',m.dia)}" stroke-width="2.4"/>`; });
  list.forEach((m,i)=>{ s+=`<circle cx="${xs[i]}" cy="${yb(m.sys)}" r="4.6" fill="${catBar('sys',m.sys)}" stroke="#fff" stroke-width="1.3"/>`; });
  if(detailed){ list.forEach((m,i)=>{
    s+=`<text x="${xs[i]}" y="${yb(m.sys)-9}" font-size="9" font-weight="800" fill="${catInk('sys',m.sys)}" text-anchor="middle">${m.sys}</text>`;
    s+=`<text x="${xs[i]}" y="${yb(m.dia)+16}" font-size="9" font-weight="800" fill="${catInk('dia',m.dia)}" text-anchor="middle">${m.dia}</text>`;
  }); }
  if(showPuls){
    const pv=list.map(m=>m.pulse), pmn=Math.min(...pv), pmx=Math.max(...pv), pmin=pmn-4, pmax=pmx+4;
    const yp=v=>+(pulBot-(v-pmin)/((pmax-pmin)||1)*(pulBot-pulTop)).toFixed(1);
    s+=`<line x1="${padL}" y1="${pulTop-10}" x2="${W-padR}" y2="${pulTop-10}" stroke="${RP.line}" stroke-width="1"/>`;
    s+=`<polyline points="${list.map((m,i)=>xs[i]+','+yp(m.pulse)).join(' ')}" fill="none" stroke="${RP.pulse.bar}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;
    list.forEach((m,i)=>{ s+=`<circle cx="${xs[i]}" cy="${yp(m.pulse)}" r="2.7" fill="${RP.pulse.bar}" stroke="#fff" stroke-width="1"/>`; });
    s+=`<text x="2" y="${pulTop-14}" font-size="9" font-weight="800" fill="${RP.pulse.ink}" letter-spacing=".08em">PULS</text>`;
    s+=`<text x="${W-padR+4}" y="${yp(pmx)+3}" font-size="9" font-weight="700" fill="${RP.pulse.ink}">${pmx}</text>`;
    s+=`<text x="${W-padR+4}" y="${yp(pmn)+3}" font-size="9" font-weight="700" fill="${RP.pulse.ink}">${pmn}</text>`;
  }
  s+=`<line x1="${padL}" y1="${axisY+6}" x2="${W-padR}" y2="${axisY+6}" stroke="${RP.line}" stroke-width="1"/>`;
  const minGap=detailed?52:56, labelIdx=[]; let lastLX=-999;
  for(let i=0;i<n;i++){ if(xs[i]-lastLX>=minGap){ labelIdx.push(i); lastLX=xs[i]; } }
  if(labelIdx[labelIdx.length-1]!==n-1){ if(xs[n-1]-xs[labelIdx[labelIdx.length-1]]<minGap*0.55) labelIdx.pop(); labelIdx.push(n-1); }
  const labelSet={}; labelIdx.forEach(i=>labelSet[i]=true);
  for(let i=0;i<n;i++){ const isL=labelSet[i];
    s+=`<line x1="${xs[i]}" y1="${axisY+6}" x2="${xs[i]}" y2="${axisY+(isL?12:9)}" stroke="${isL?RP.muted:RP.faint}" stroke-opacity="${isL?.85:.5}" stroke-width="${isL?1.4:1}"/>`;
  }
  labelIdx.forEach(i=>{ const d=new Date(list[i].ts), anchor=i===0?'start':(i===n-1?'end':'middle');
    s+=`<text x="${xs[i]}" y="${dateY}" font-size="9.5" font-weight="700" fill="${RP.muted}" text-anchor="${anchor}">${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${s}</svg>`;
}
/* ---- Wertetabelle (Sys = gefüllte Scheibe, Dia = hohler Ring – gleiche Konvention wie im Diagramm) ---- */
function rpTable(rep,opt){
  opt=opt||{}; const puls=reportState.puls;
  const cols=puls?'1fr 46px 62px 62px 46px 1.7fr':'1fr 46px 62px 62px 1.7fr';
  const dot=(cat,filled)=>{ const c=RP.amp[cat].bar; return `<span style="width:9px;height:9px;border-radius:50%;flex:none;box-sizing:border-box;background:${filled?c:'#fff'};border:${filled?'1px solid '+c:'2px solid '+c}"></span>`; };
  const valCell=(v,cat,filled)=>`<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">${dot(cat,filled)}<span style="font-size:13.5px;font-weight:800;color:${RP.amp[cat].ink}">${v}</span></div>`;
  const hc=(t,r)=>`<div style="font-size:9.5px;font-weight:800;letter-spacing:.06em${r?';text-align:right':''}">${t}</div>`;
  const head=`<div style="display:grid;grid-template-columns:${cols};gap:10px;align-items:center;padding:0 12px 8px;color:${RP.muted}">${hc('DATUM')}${hc('ZEIT')}${hc('SYS',1)}${hc('DIA',1)}${puls?hc('PULS',1):''}${hc('NOTIZ')}</div>`;
  const WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
  let rows='';
  rep.desc.forEach((m,i)=>{
    const d=new Date(m.ts), dl=WD[d.getDay()]+' '+pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.';
    rows+=`<div class="rp-trow" style="display:grid;grid-template-columns:${cols};gap:10px;align-items:center;padding:8px 12px;border-top:1px solid ${RP.line}${opt.zebra&&i%2===1?';background:'+RP.surf2:''}">`
      +`<div style="font-size:12px;font-weight:700;color:${RP.ink}">${dl}</div>`
      +`<div style="font-size:11.5px;font-weight:600;color:${RP.muted}">${fmtTime(m.ts)}</div>`
      +valCell(m.sys,catValFor('sys',m.sys),true)
      +valCell(m.dia,catValFor('dia',m.dia),false)
      +(puls?`<div style="text-align:right;font-size:12.5px;font-weight:700;color:${RP.pulse.ink}">${m.pulse}</div>`:'')
      +`<div style="font-size:11px;font-weight:500;color:${RP.muted};line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.note?escapeHtml(m.note):'—'}</div></div>`;
  });
  return head+rows;
}

/* ---- A4-Seite 1: Kompakt-Layout (Gesamt-Durchschnitt gesplittet) ---- */
function rpPage(rep){
  const acc=rpAcc(), puls=reportState.puls, namen=reportState.namen;
  const tile=(inner,extra='')=>`<div class="rp-blk" style="background:${RP.surf2};border-radius:16px;padding:13px 15px${extra}">${inner}</div>`;
  const mini=t=>`<div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${RP.muted};margin-bottom:9px">${t}</div>`;
  const field=(lab,val,blank)=>`<div style="display:flex;flex-direction:column;gap:3px;min-width:0"><div style="font-size:9.5px;font-weight:800;letter-spacing:.09em;color:${RP.muted}">${lab}</div>${blank?`<div style="height:16px;border-bottom:1.5px dotted #c2cad6"></div>`:`<div style="font-size:13px;font-weight:700;color:${RP.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val}</div>`}</div>`;
  const metaCols=namen?'1.3fr 1fr 1.2fr 1fr':'1fr 1fr';
  const header=`<div><div style="display:flex;align-items:center;gap:11px;margin-bottom:13px"><div style="width:34px;height:34px;border-radius:9px;background:${acc};display:grid;place-items:center;flex:none">${rpMark(20,'#fff')}</div><div style="flex:1"><div style="font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1">Blutdruck-Bericht</div><div style="font-size:11.5px;font-weight:600;color:${RP.muted};margin-top:2px">Auswertung für den Arztbesuch</div></div><div style="font-size:11px;font-weight:700;color:${RP.muted};text-align:right">Erstellt<br><span style="color:${RP.ink};font-weight:800">${rep.created}</span></div></div>`
    +tile(`<div style="display:grid;grid-template-columns:${metaCols};gap:16px">${field('ZEITRAUM',rep.period)}${field('MESSUNGEN',rep.count+' Messungen')}${namen?field('NAME','',true):''}${namen?field('GEBURTSDATUM','',true):''}</div>`)+`</div>`;

  if(!rep.count){
    const notice=`<div style="background:${RP.surf2};border-radius:16px;padding:44px 24px;text-align:center;color:${RP.muted};font-size:14px;font-weight:600">Für den gewählten Zeitraum liegen keine Messungen vor.</div>`;
    return `<div class="rp-page" style="width:794px;min-height:1123px;background:#fff;color:${RP.ink};display:flex;flex-direction:column;padding:38px 40px 34px"><div style="display:flex;flex-direction:column;gap:13px;flex:1">${header}${notice}</div>${rpFoot(rep)}</div>`;
  }

  const stat=(v,lab,col,last)=>`<div style="flex:1;text-align:center;padding:2px 4px${last?'':';border-right:1px solid '+RP.line}"><div style="font-size:30px;font-weight:800;color:${col};letter-spacing:-.02em;line-height:1">${v}</div><div style="font-size:9.5px;font-weight:800;letter-spacing:.07em;color:${RP.muted};margin-top:6px">${lab}</div></div>`;
  const sysdiaTile=tile(`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">${mini('DURCHSCHNITT SYS / DIA')}${rpChip(rep.catAvg,true)}</div><div style="display:flex;align-items:stretch">${stat(rep.avgSys,'Ø SYSTOLISCH',RP.amp[catValFor('sys',rep.avgSys)].ink)}${stat(rep.avgDia,'Ø DIASTOLISCH',RP.amp[catValFor('dia',rep.avgDia)].ink,true)}</div>`,';flex:2');
  const pulsTile=tile(`<div style="margin-bottom:12px">${mini('DURCHSCHNITT PULS')}</div><div style="display:flex;align-items:stretch">${stat(rep.avgPul,'Ø PULS · BPM',RP.pulse.ink,true)}</div>`,';flex:1');
  const gesamt=`<div class="rp-blk" style="display:flex;gap:13px;align-items:stretch">${sysdiaTile}${puls?pulsTile:''}</div>`;

  const todTile=(name,w)=>`<div style="flex:1;background:${RP.surf};border:1px solid ${RP.line};border-radius:12px;padding:11px 12px"><div style="font-size:11px;font-weight:800;color:${RP.ink};margin-bottom:6px">${name}</div>${w.n===0?`<div style="font-size:22px;font-weight:800;color:#c2cad6">—</div>`:`<div><div style="display:flex;align-items:baseline;gap:3px"><span style="font-size:22px;font-weight:800;color:${RP.amp[catValFor('sys',w.sys)].ink}">${w.sys}</span><span style="font-size:15px;color:#c2cad6;font-weight:500">/</span><span style="font-size:22px;font-weight:800;color:${RP.amp[catValFor('dia',w.dia)].ink}">${w.dia}</span></div><div style="font-size:10.5px;font-weight:600;color:${RP.muted};margin-top:4px">${puls?'Puls '+w.pul+' · ':''}${w.n} Messung${w.n===1?'':'en'}</div></div>`}</div>`;
  const tageszeit=tile(mini('DURCHSCHNITT NACH TAGESZEIT')+`<div style="display:flex;gap:9px">${todTile('Morgens',rep.tod.morgens)}${todTile('Tagsüber',rep.tod.tags)}${todTile('Abends',rep.tod.abends)}</div>`);

  const legRow=(cat,cnt,p)=>`<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="width:10px;height:10px;border-radius:3px;background:${RP.amp[cat].bar};flex:none"></span><span style="font-size:12px;font-weight:700;color:${RP.ink}">${RP.amp[cat].label}</span><span style="margin-left:auto;font-size:12px;font-weight:700;color:${RP.muted}"><b style="color:${RP.ink}">${cnt}</b> · ${p}%</span></div>`;
  const verteilung=tile(`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">${mini('AMPEL-VERTEILUNG')}<span style="font-size:10.5px;font-weight:700;color:${RP.muted}">aus ${rep.count} Messungen</span></div><div style="display:flex;align-items:center;gap:16px">${rpDonut(rep,104,17)}<div style="flex:1">${legRow('g',rep.dist.g,rep.pct.g)}${legRow('y',rep.dist.y,rep.pct.y)}${legRow('r',rep.dist.r,rep.pct.r)}</div></div><div style="margin-top:12px;padding-top:10px;border-top:1px solid ${RP.line};display:flex;align-items:baseline;gap:8px"><span style="font-size:22px;font-weight:800;color:${rep.above>0?RP.amp.y.ink:RP.amp.g.ink}">${rep.above}%</span><span style="font-size:11.5px;font-weight:600;color:${RP.muted};line-height:1.3">der Messungen über dem Zielbereich (erhöht oder zu hoch)</span></div>`,';flex:1.35');
  const mmRow=(lab,o,unit)=>`<div style="display:flex;align-items:baseline;justify-content:space-between;padding:5px 0"><span style="font-size:12px;font-weight:700;color:${RP.ink}">${lab}</span><span style="font-size:13px;font-weight:800;color:${RP.ink}">${o.min} – ${o.max}<span style="font-size:10px;font-weight:600;color:${RP.muted};margin-left:4px">${unit}</span></span></div>`;
  const minmax=tile(mini('HÖCHST- & TIEFSTWERTE')+`<div style="border-top:1px solid ${RP.line}">${mmRow('Systolisch',rep.minmax.sys,'mmHg')}${mmRow('Diastolisch',rep.minmax.dia,'mmHg')}${puls?mmRow('Puls',rep.minmax.pul,'bpm'):''}</div>`,';flex:1');
  const distRow=`<div class="rp-blk" style="display:flex;gap:13px;align-items:stretch">${verteilung}${minmax}</div>`;

  const chartTile=tile(mini('BLUTDRUCKVERLAUF')+rpChart(rep,686,puls,acc)+rpLegend(puls));
  const tableTile=`<div class="rp-tabletile" style="background:${RP.surf};border:1px solid ${RP.line};border-radius:16px;overflow:hidden"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${RP.muted};padding:13px 15px 6px">ALLE MESSUNGEN · ${rep.count}</div><div style="padding:0 4px 8px">${rpTable(rep,{zebra:true})}</div></div>`;

  return `<div class="rp-page" style="width:794px;min-height:1123px;background:#fff;color:${RP.ink};display:flex;flex-direction:column;padding:38px 40px 34px"><div style="display:flex;flex-direction:column;gap:13px;flex:1">${header}${gesamt}${tageszeit}${distRow}${chartTile}${tableTile}</div>${rpFoot(rep)}</div>`;
}
/* ---- A4-Seite 2 (Anhang, Querformat): nur das Detail-Diagramm, füllend ---- */
function rpLandscape(rep){
  const acc=rpAcc(), puls=reportState.puls;
  const header=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div style="display:flex;align-items:center;gap:12px"><div style="width:34px;height:34px;border-radius:9px;background:${acc};display:grid;place-items:center;flex:none">${rpMark(20,'#fff')}</div><div><div style="font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1">Blutdruck-Bericht · Anhang</div><div style="font-size:12px;font-weight:600;color:${RP.muted};margin-top:3px">Detaillierter Verlauf & alle Messwerte</div></div></div><div style="text-align:right"><div style="font-size:12.5px;font-weight:800;color:${RP.ink}">${rep.period}</div><div style="font-size:11px;font-weight:600;color:${RP.muted};margin-top:2px">${rep.count} Messungen</div></div></div>`;
  const body=!rep.count
    ? `<div style="flex:1;background:${RP.surf2};border-radius:16px;display:flex;align-items:center;justify-content:center;color:${RP.muted};font-size:14px;font-weight:600">Für den gewählten Zeitraum liegen keine Messungen vor.</div>`
    : `<div style="flex:1;background:${RP.surf2};border-radius:16px;padding:15px 17px;display:flex;flex-direction:column"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${RP.muted};margin-bottom:10px">BLUTDRUCKVERLAUF · WERT & DATUM JE MESSPUNKT</div><div style="flex:1;display:flex;align-items:stretch">${rpChart(rep,1035,puls,acc,true)}</div>${rpLegend(puls)}</div>`;
  return `<div class="rp-page rp-page-land" style="width:1123px;min-height:794px;background:#fff;color:${RP.ink};display:flex;flex-direction:column;padding:40px 44px 32px">${header}${body}${rpFoot(rep,'Seite 2 · Anhang',{noTod:true})}</div>`;
}

/* ---- Report-Screen: Menü (App-Theme) + Live-Vorschau + Druck-Container ---- */
function renderReport(){
  const {from,to}=rpRangeDates();
  if(reportState.range==='custom'){ if(!reportState.from) reportState.from=rpIso(from); if(!reportState.to) reportState.to=rpIso(to); }
  const rep=reportData(from,to);
  const card=inner=>`<div class="rp-card">${inner}</div>`;
  const lbl=t=>`<div class="rp-lbl">${t}</div>`;
  const pill=(k,t)=>`<button class="rp-pill${reportState.range===k?' active':''}" data-rp="range" data-val="${k}" type="button">${t}</button>`;
  const custom=reportState.range==='custom'
    ? `<div class="rp-dates"><label class="rp-date">VON<input type="date" id="rpFrom" value="${reportState.from||''}"></label><label class="rp-date">BIS<input type="date" id="rpTo" value="${reportState.to||''}"></label></div>`
    : '';
  const zeit=card(lbl('ZEITRAUM')+`<div class="rp-period">${rep.period}</div><div class="rp-count">${rep.count} Messungen im Zeitraum</div><div class="rp-pills">${pill('30','30 Tage')}${pill('90','90 Tage')}${pill('custom','Eigener')}</div>${custom}`);
  const swatch=l=>{ const on=reportState.accent===l; return `<button class="rp-swatch${on?' active':''}" data-rp="acc" data-val="${l}" title="${l}" type="button" style="--sw:${RP.acc[l]}">${on?'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>':''}</button>`; };
  const farbe=card(lbl('REPORT-FARBE')+`<div class="rp-swatches">${RP_ACC_ORDER.map(swatch).join('')}</div>`);
  const tog=(k,t,sub)=>`<div class="rp-opt"><div class="rp-opt-txt"><div class="rp-opt-t">${t}</div>${sub?`<div class="rp-opt-s">${sub}</div>`:''}</div><button class="rp-toggle${reportState[k]?' on':''}" data-rp="toggle" data-val="${k}" type="button" role="switch" aria-checked="${reportState[k]?'true':'false'}"><span class="rp-knob"></span></button></div>`;
  const opt=card(lbl('OPTIONEN')+tog('namen','Namensfeld zum Ausfüllen')+tog('puls','Puls einbeziehen')+tog('anhang','Anhangseite drucken','Detail-Diagramm im Querformat (Seite 2)'));
  const preview=`<div class="rp-card rp-preview">${lbl('VORSCHAU')}<div class="rp-shot" id="rpShot1"><div class="rp-scaler" id="rpScaler1">${rpPage(rep)}</div></div>${reportState.anhang?`<div class="rp-anh-lbl">ANHANG · Seite 2 · Querformat</div><div class="rp-shot" id="rpShot2"><div class="rp-scaler" id="rpScaler2">${rpLandscape(rep)}</div></div>`:''}</div>`;
  $('#rpBody').innerHTML=zeit+farbe+opt+preview;
  $('#reportPrint').innerHTML=rpPage(rep)+(reportState.anhang?rpLandscape(rep):'');
  rpScalePreview();
}
/* Vorschau: die naturgroßen A4-Seiten auf die Bildschirmbreite herunterskalieren. */
function rpScalePreview(){
  [['#rpShot1','#rpScaler1',794],['#rpShot2','#rpScaler2',1123]].forEach(cfg=>{
    const shot=$(cfg[0]), sc=$(cfg[1]); if(!shot||!sc) return;
    const w=shot.clientWidth; if(!w) return;
    const k=w/cfg[2]; sc.style.transform='scale('+k+')';
    const page=sc.firstElementChild; shot.style.height=((page?page.offsetHeight:cfg[2])*k)+'px';
  });
}
/* Report öffnen: Zustand IMMER auf Standard zurücksetzen (flüchtig), dann als eigene Ebene öffnen. */
function openReport(){
  reportState={accent:'Kobalt',range:'30',from:null,to:null,puls:true,namen:true,anhang:false};
  navPush('report',null);
}
/* Bedienung: eine delegierte Klick-/Change-Behandlung am Screen (überlebt das Neu-Rendern des Körpers).
   Alles defensiv verdrahtet (if-Guards): Sollten index.html und app.js einmal versionsverschieden aus
   dem Cache geladen werden, darf ein fehlendes Element NICHT den Rest der App (Init/Navigation) killen. */
const rpScreen=$('#tab-report');
if(rpScreen){
  rpScreen.addEventListener('click',e=>{
    const t=e.target.closest('[data-rp]'); if(!t) return;
    const a=t.dataset.rp;
    if(a==='back'){ navBack(); return; }
    if(a==='print'){ window.print(); return; }
    if(a==='range'){ if(reportState.range!==t.dataset.val){ reportState.range=t.dataset.val; renderReport(); } return; }
    if(a==='acc'){ if(reportState.accent!==t.dataset.val){ reportState.accent=t.dataset.val; renderReport(); } return; }
    if(a==='toggle'){ const k=t.dataset.val; reportState[k]=!reportState[k]; renderReport(); }
  });
  rpScreen.addEventListener('change',e=>{
    if(e.target.id==='rpFrom'){ reportState.from=e.target.value; renderReport(); }
    else if(e.target.id==='rpTo'){ reportState.to=e.target.value; renderReport(); }
  });
}
window.addEventListener('resize',()=>{ if(currentTab==='report') rpScalePreview(); });
const rpBtnChart=$('#rpOpenChart'); if(rpBtnChart) rpBtnChart.addEventListener('click',openReport);            // Einstieg: Diagramm-Kopf
const rpBtnMenu=$('#mReport'); if(rpBtnMenu) rpBtnMenu.addEventListener('click',()=>{ const d=$('#menuDlg'); if(d&&d.open) d.close(); openReport(); });  // Einstieg: Menü → Daten

/* ---------- App-Steuerung ---------- */
let currentTab='dashboard';
function showTab(name){
  currentTab=name;
  $$('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+name));
  $$('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  // Screens mit eigenem Kopf (kein „Blutdruck"-Header): Dashboard, Erfassen, Verlauf, Detail, Diagramm
  const hdr=$('header.app'); if(hdr) hdr.hidden=['dashboard','capture','table','detail','chart','report'].includes(name);
  // Vollbild ohne Tab-Bar (eigene Fußzeile): Erfassen + Detail + Arzt-Report
  const nav=$('nav.bottom'); if(nav) nav.style.display=(name==='capture'||name==='detail'||name==='report')?'none':'';
  if(name==='dashboard') renderDashboard();
  if(name==='table') renderTable();
  if(name==='detail') renderDetail(detailId);
  if(name==='chart') renderChart();
  if(name==='report') renderReport();
}
$$('.navbtn[data-tab]').forEach(b=>b.addEventListener('click',()=>goMainTab(b.dataset.tab)));   // Menü-Button (ohne data-tab) löst keinen Tab-Wechsel aus
$('#fabCapture').addEventListener('click',()=>startCapture());                                 // zentraler +-Knopf → neue Messung

/* ---------- Navigation & nativer Zurück-Knopf (Android) ----------
   Modell: Der echte Browser-Verlauf bildet die App-Navigation 1:1 ab. Jede „Ebene" – ein Screen ODER
   ein Bottom-Sheet – ist EIN echter Verlaufs-Eintrag (history.pushState). Der Handy-Zurück und jeder
   App-„Zurück"-Knopf tun exakt dasselbe: einen Eintrag zurück (history.back()). Gezeichnet wird an
   EINER einzigen Stelle – dem popstate-Handler über applyTop().

   Vorteil für künftige Features: Wer einen neuen Screen/Sheet über navPush(...) öffnet, ist damit
   automatisch „zurück-fähig" – KEINE eigene Zurück-Logik nötig. Es wird NICHTS mehr nachträglich in
   den Verlauf geschoben (das war die alte Sollbruchstelle, die auf Android Ebenen überspringen ließ).

   viewStack spiegelt die offenen Ebenen als einfache Liste (Basis = Dashboard); history.state.d hält
   die Tiefe (= Länge). Fenster (modale <dialog>: Menü/Anleitung/Bestätigen/Wiederherstellen) laufen
   bewusst NICHT über dieses Modell – die schließt Android selbst (siehe cancel unten). Sollte Android
   dabei zusätzlich einen Verlaufs-Eintrag verbrauchen, stellen wir ihn wieder her, statt eine Ebene
   zurückzugehen. Das Diagramm-Zeitraum-Popover (#dgPop) ist ein leichtes Dropdown und ebenfalls kein
   Verlaufs-Eintrag (wird beim nächsten Zeichnen mit-geschlossen). */

let viewStack=[{screen:'dashboard',sheet:null}];
const NAV_SHEETS=['#capDtSheet','#capNoteSheet','#rangeSheet','#dgPop'];
/* Sichtbares an die oberste Ebene angleichen: richtiger Screen + genau das dazugehörige Sheet. Den
   Screen NUR wechseln, wenn er sich ändert – sonst bliebe z. B. die Erfassen-Eingabe nicht erhalten. */
function applyTop(){
  const top=viewStack[viewStack.length-1]||{screen:'dashboard',sheet:null};
  if(currentTab!==top.screen) showTab(top.screen);
  NAV_SHEETS.forEach(sel=>{ const el=$(sel); if(el&&!el.hidden) el.hidden=true; });
  const cal=$('#dgCal'); if(cal) cal.classList.remove('active');
  if(top.sheet){ const el=$(top.sheet); if(el) el.hidden=false; if(top.sheet==='#dgPop'&&cal) cal.classList.add('active'); }
}
/* Eine Ebene tiefer öffnen (neuer Verlaufs-Eintrag). */
function navPush(screen,sheet){ viewStack.push({screen,sheet:sheet||null}); history.pushState({d:viewStack.length},''); applyTop(); }
/* Gleiche Ebene, anderer Inhalt (z. B. Verlauf ⇄ Diagramm über die Tab-Leiste – keine Stapelung). */
function navReplace(screen,sheet){ viewStack[viewStack.length-1]={screen,sheet:sheet||null}; history.replaceState({d:viewStack.length},''); applyTop(); }
/* Eine Ebene zurück – identisch für Handy-Zurück UND App-Knöpfe. Zeichnen übernimmt popstate. */
function navBack(){ history.back(); }
/* Bis zum nächsten passenden Screen zurück (Erfassen „Abbrechen/Speichern" → Ausgangs-Screen). */
function backToScreen(name){
  for(let i=viewStack.length-1;i>=0;i--){
    if(viewStack[i].screen===name){ const steps=viewStack.length-1-i; if(steps>0) history.go(-steps); else applyTop(); return; }
  }
  navReplace(name,null);   // nicht im Stapel gefunden → aktuelle Ebene ersetzen (Sicherheitsnetz)
}
/* Ein Sheet schließen – aber nur, wenn es wirklich die oberste Ebene ist (fängt Doppel-Schließen ab). */
function closeSheet(sel){ const t=viewStack[viewStack.length-1]; if(t&&t.sheet===sel) navBack(); }
/* Haupt-Tabs unten (Dashboard · Verlauf · Diagramm): Verlauf/Diagramm liegen EINE Ebene über dem
   Dashboard. Seitlich wechseln = ersetzen (keine Stapelung); „Dashboard" = zurück zur Basis. */
function goMainTab(name){
  if(name===currentTab) return;
  if(name==='dashboard'){ backToScreen('dashboard'); return; }
  if(currentTab==='dashboard') navPush(name,null); else navReplace(name,null);
}

let _dlgCancelAt=0;
/* Zurück-Druck (nativ oder Wisch). Fenster-Fall zuerst: Hat Android soeben ein Fenster geschlossen
   (cancel) und dabei evtl. einen Verlaufs-Eintrag verbraucht, stellen wir den Eintrag wieder her –
   und gehen NICHT zusätzlich eine Ebene zurück. Sonst: auf die hinterlegte Tiefe kürzen + neu zeichnen. */
window.addEventListener('popstate',e=>{
  const d=(e.state&&e.state.d)||1;
  if(Date.now()-_dlgCancelAt<400){
    if(d<viewStack.length) setTimeout(()=>history.pushState({d:viewStack.length},''),0);   // verbrauchten Eintrag ersetzen
    return;
  }
  if(d<viewStack.length) viewStack.length=d;
  applyTop();
});
/* Modale Fenster: Android-Zurück/Esc feuert 'cancel'. Zeitpunkt merken (für den Schutz oben) und die
   Fenster sich normal schließen lassen. Ausnahme Anleitung: zurück INS Menü statt alles zu schließen. */
$$('dialog').forEach(d=>d.addEventListener('cancel',()=>{ _dlgCancelAt=Date.now(); }));
$('#helpDlg').addEventListener('cancel',e=>{ e.preventDefault(); $('#helpDlg').close(); $('#menuDlg').showModal(); });

function refreshData(){ renderTable(); if(currentTab==='chart') renderChart(); if(currentTab==='dashboard') renderDashboard(); if(currentTab==='detail') renderDetail(detailId); }
/* Höhe der Tab-Bar messen → CSS-Variable --navh (der Verlauf-Screen lässt genau diesen Platz unten frei). */
function setNavH(){ const n=$('nav.bottom'); if(n&&n.offsetHeight) document.documentElement.style.setProperty('--navh',n.offsetHeight+'px'); }
window.addEventListener('load',setNavH);
// Das Diagramm ist ein SVG mit viewBox (skaliert flüssig mit) → kein Neuzeichnen bei Resize nötig.
window.addEventListener('resize',()=>{ setNavH(); if(currentTab==='table') positionVInk(); });
// SVG-Farben werden beim Zeichnen fest aufgelöst → bei System-Hell/Dunkel-Wechsel (Theme „Auto") neu zeichnen.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if(currentTab==='chart') renderChart(); });

/* ---------- PWA: Manifest + Icon + Service Worker ---------- */
const SVG_ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'+
  '<rect width="512" height="512" rx="104" fill="#2563eb"/>'+
  '<path d="M76 270h82l38-104 58 196 46-128 30 72h86" fill="none" stroke="#ffffff" '+
  'stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function injectPWA(){
  $('#logo').innerHTML=SVG_ICON;   // Header-Logo bleibt scharfes Inline-SVG
  // Manifest + Icons sind jetzt echte Dateien im <head> (manifest.webmanifest, icon-192/512.png),
  // damit Android die App als echte App installiert (WebAPK) statt nur als Chrome-Verknüpfung.
  if('serviceWorker' in navigator)
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

/* ---------- Start ---------- */
async function init(){
  injectPWA(); applyTheme(); applySettingsUI();
  await requestPersistence();          // Speicher dauerhaft anfordern
  await initStorage();                 // Daten aus IndexedDB laden / migrieren
  applyTheme(); applySettingsUI();     // aus IndexedDB geladene Einstellungen nachziehen (falls localStorage leer war)
  updateReminder(); setNavH();
  history.replaceState({d:1},'');   // Basis-Eintrag (Dashboard) markieren – Zurück an der Wurzel verlässt die App
  showTab('dashboard');             // Verlauf rendert beim ersten Öffnen (showTab → renderTable)

}
init();
