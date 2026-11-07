"use strict";
/* =========================================================
   Blutdruck Pro – Körpertemperatur & Sauerstoffsättigung (SpO₂)
   Wird VOR app.js geladen und enthält nur Definitionen (keine Seiteneffekte beim Laden).
   Verkabelt wird alles aus app.js heraus (initStorage, Erfassen, Dashboard, Verlauf …).
   Fachliche Regeln: vitalwerte-spezifikation.md
   ========================================================= */

/* ---------- Verzeichnis aller festen Angaben ---------- */
const IC_PATH_TEMP='M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z';
/* Sauerstoff: aufsteigende Bläschen (Entscheidung 2026-11-06, ersetzt den Tropfen). */
const IC_PATH_SPO2='M4 17a4 4 0 1 0 8 0a4 4 0 1 0-8 0M13.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0M8.1 7.5a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0M13.8 4a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0';
const IC_PATH_BP='M3 12h5l2.5-7 3 14 2.5-9 2 2h3';
const METRICS={
  temp:{key:'temp',name:'Temperatur',long:'Körpertemperatur',unit:'°C',dec:1,plaus:[34,43],seg:'TEMP',icon:IC_PATH_TEMP},
  spo2:{key:'spo2',name:'Sauerstoff',long:'Sauerstoffsättigung (SpO₂)',unit:'%',dec:0,plaus:[70,100],seg:'SpO₂',icon:IC_PATH_SPO2}
};
const VITAL_TYPES=['temp','spo2'];
/* Standard-Grenzen (gängige Richtwerte, keine Leitlinie – siehe Spezifikation Abschnitt 2). */
const VITAL_THR_DEFAULT={tempLow:36.0,tempY:37.5,tempR:38.1,spo2G:95,spo2Y:93};
const icSvg=(path,w)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2.2)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';

/* ---------- Anzeige ---------- */
/* Temperatur immer mit einer Nachkommastelle und Komma (37,0), Sauerstoff ganzzahlig. */
function fmtMetric(type,v){
  if(v==null||!Number.isFinite(+v)) return '–';
  return METRICS[type].dec ? (+v).toFixed(1).replace('.',',') : String(Math.round(+v));
}
const fmtMetricUnit=(type,v)=>fmtMetric(type,v)+' '+METRICS[type].unit;
/* Ø auf die Stelle des Werts gerundet (Temperatur 0,1 – Sauerstoff ganzzahlig). */
function meanMetric(list){
  if(!list.length) return null;
  const m=list.reduce((s,x)=>s+x.value,0)/list.length;
  return list[0].type==='temp' ? Math.round(m*10)/10 : Math.round(m);
}

/* ---------- Ampel ----------
   Liefert Farbe UND Wort, weil Gelb bei der Temperatur zwei Bedeutungen hat (zu niedrig / erhöht).
   catVal bleibt unverändert (kennt nur „höher ist schlechter"). */
function catMetric(type,v){
  const t=settings.thr;
  if(v==null||!Number.isFinite(+v)) return {c:'n',t:'–'};
  v=+v;
  if(type==='temp'){
    if(v>=t.tempR) return {c:'r',t:'Fieber'};
    if(v>=t.tempY) return {c:'y',t:'Erhöht'};
    if(v<t.tempLow) return {c:'y',t:'Niedrig'};
    return {c:'g',t:'Normal'};
  }
  if(type==='spo2'){
    if(v>=t.spo2G) return {c:'g',t:'Im Ziel'};
    if(v>=t.spo2Y) return {c:'y',t:'Niedrig'};
    return {c:'r',t:'Zu niedrig'};
  }
  return {c:'n',t:'–'};
}
/* Wörter je Ampelfarbe für Legenden (Temperatur-Gelb fasst „Niedrig“ und „Erhöht“ zusammen). */
const METRIC_LEG={temp:{g:'Normal',y:'Niedrig/Erhöht',r:'Fieber'},spo2:{g:'Im Ziel',y:'Niedrig',r:'Zu niedrig'}};

/* ---------- Ziffern-Logik im Ziffernblock (Spezifikation 1.1) ----------
   Zwei oder drei Stellen automatisch erkennen; 0 am Anfang wird ignoriert. */
const CAP_DEF={
  sys:  {key:'sys',  seg:'SYS',  name:'Systolisch', unit:'mmHg',plaus:[70,250]},
  dia:  {key:'dia',  seg:'DIA',  name:'Diastolisch',unit:'mmHg',plaus:[40,140]},
  pulse:{key:'pulse',seg:'PULS', name:'Puls',       unit:'bpm', plaus:[35,200]},
  temp: {key:'temp', seg:'TEMP', name:'Temperatur', unit:'°C',  plaus:[34,43]},
  spo2: {key:'spo2', seg:'SpO₂', name:'Sauerstoff', unit:'%',   plaus:[70,100]}
};
function digitTarget(key,raw){
  if(key==='temp') return 3;
  const f=raw.charAt(0);
  if(key==='sys') return (f==='1'||f==='2')?3:2;
  return f==='1'?3:2;                       // dia, pulse, spo2
}
const rawComplete=(key,raw)=>raw.length>0&&raw.length>=digitTarget(key,raw);
/* Rohziffern → Zahl (Temperatur: „368" → 36.8). */
function rawValue(key,raw){
  if(!raw) return null;
  const n=parseInt(raw,10);
  return key==='temp'?n/10:n;
}
/* Anzeige der Rohziffern im großen Feld (Temperatur mit Komma: „36," / „36,8"). */
function rawDisplay(key,raw){
  if(key!=='temp') return raw;
  if(raw.length===3) return raw.slice(0,2)+','+raw.slice(2);
  if(raw.length===2) return raw+',';
  return raw;
}
/* Wert → Rohziffern fürs Bearbeiten. Achtung: String(37.0) wäre „37" → über Math.round(v*10). */
function valueRaw(key,v){
  if(v==null||!Number.isFinite(+v)) return '';
  return key==='temp'?String(Math.round(+v*10)):String(Math.round(+v));
}
const spo2Over=(key,raw)=>key==='spo2'&&raw.length>0&&parseInt(raw,10)>100;
/* Ampel eines Eingabefelds – erst, wenn der Wert vollständig ist. null = (noch) keine Ampel. */
function capFieldCat(key,raw){
  if(!rawComplete(key,raw)||spo2Over(key,raw)) return null;
  const v=rawValue(key,raw);
  if(key==='sys'||key==='dia'){ const c=catValFor(key,v); return {c,t:CAT_LABEL[c]}; }
  if(key==='temp'||key==='spo2') return catMetric(key,v);
  return null;                              // Puls: keine Ampel
}
const capFieldOdd=(key,raw)=>{ if(!rawComplete(key,raw)||spo2Over(key,raw)) return false;
  const v=rawValue(key,raw), p=CAP_DEF[key].plaus; return v<p[0]||v>p[1]; };

/* ---------- Speicher (eigene Liste `vitals`, eigener IndexedDB-Store) ---------- */
const LS_VIT='bpp_vitals', STORE_V='vitals';
let vitals=[];
function loadVitals(){ try{ const a=JSON.parse(localStorage.getItem(LS_VIT)||'[]'); return Array.isArray(a)?a:[]; }catch{ return []; } }
function idbAllV(){
  return new Promise((res,rej)=>{
    const rq=_db.transaction(STORE_V,'readonly').objectStore(STORE_V).getAll();
    rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error);
  });
}
function idbWriteAllV(list){
  return new Promise((res,rej)=>{
    const tx=_db.transaction(STORE_V,'readwrite'), st=tx.objectStore(STORE_V);
    st.clear(); list.forEach(v=>st.put(v));
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  });
}
function saveVitals(){
  try{ localStorage.setItem(LS_VIT,JSON.stringify(vitals)); }catch(e){ quotaToast(e); }
  if(_db) idbWriteAllV(vitals).then(scheduleAutoBackup).catch(quotaToast);
}
/* Beim Start (aus initStorage): IndexedDB lesen, sonst einmalig aus localStorage übernehmen. */
async function initVitalsStorage(){
  const fromDb=await idbAllV();
  if(fromDb.length){ vitals=fromDb; return; }
  const fromLs=loadVitals(); vitals=fromLs;
  if(fromLs.length) await idbWriteAllV(fromLs);
}
function addVital(v){ vitals.push(v); saveVitals(); markDirty(); }
function updateVital(id,patch){ const i=vitals.findIndex(x=>x.id===id); if(i>=0){ vitals[i]={...vitals[i],...patch}; saveVitals(); markDirty(); } }
function removeVital(id){ vitals=vitals.filter(x=>x.id!==id); saveVitals(); markDirty(); }
const vitalsOf=type=>vitals.filter(v=>v.type===type);
const byTsDesc=(a,b)=>new Date(b.ts)-new Date(a.ts);
const byTsAsc=(a,b)=>new Date(a.ts)-new Date(b.ts);
/* Gültiger Vitalwert (Backup/Zusammenführen): bekannter Typ, Zahl, lesbare Zeit, Sauerstoff ≤ 100. */
function normVital(x){
  if(!x||typeof x!=='object'||!VITAL_TYPES.includes(x.type)) return null;
  const value=+x.value, t=new Date(x.ts);
  if(!Number.isFinite(value)||!x.ts||isNaN(t.getTime())) return null;
  if(x.type==='spo2'&&value>100) return null;
  return {id:x.id||uid(),ts:t.toISOString(),type:x.type,value:x.type==='temp'?Math.round(value*10)/10:Math.round(value),note:x.note?String(x.note):''};
}
const totalCount=()=>entries.length+vitals.length;
/* „42 Blutdruck · 7 Temperatur · 7 Sauerstoff" (Arten ohne Werte entfallen). */
function countParts(){
  const p=[];
  if(entries.length) p.push(entries.length+' Blutdruck');
  const t=vitalsOf('temp').length, o=vitalsOf('spo2').length;
  if(t) p.push(t+' Temperatur');
  if(o) p.push(o+' Sauerstoff');
  return p;
}

/* ---------- Diagramm für Temperatur / Sauerstoff ----------
   Eigene Grafik mit zeitgetreuer X-Achse (Rechnung wie rpChart), Ampel-Punkten (catMetric) und
   gestrichelter Ø-Linie, keine Schwellen-Linien. buildDiagChart (Blutdruck) bleibt unberührt.
   Höhen-Achse mit Mindest-Spanne (Spezifikation 4.2). */
function metricAxis(type,vals){
  const mn=Math.min(...vals), mx=Math.max(...vals);
  if(type==='temp'){
    let lo=Math.floor(mn-0.3), hi=Math.ceil(mx+0.3);
    while(hi-lo<2){ if(lo>34) lo--; else hi++; }
    return {lo,hi,step:hi-lo>4?2:1};
  }
  let lo=Math.floor((mn-2)/5)*5; const hi=100;
  if(hi-lo<10) lo=hi-10;
  return {lo,hi,step:hi-lo>20?10:5};
}
function buildMetricChart(type,list,avg){
  const n=list.length, W=326, H=210, xL=34, xR=316, top=16, bot=180, anim=!prefersReduce();
  const R={ ink:cssVar('--ink'), muted:cssVar('--muted'), line:cssVar('--line'), accent:cssVar('--accent'), surf:cssVar('--surf'),
    g:cssVar('--g-bar'), y:cssVar('--y-bar'), r:cssVar('--r-bar') };
  const ax=metricAxis(type,list.map(m=>m.value)), span=(ax.hi-ax.lo)||1;
  const Y=v=>+(bot-(v-ax.lo)/span*(bot-top)).toFixed(1);
  const tv=list.map(m=>new Date(m.ts).getTime()), tlo=Math.min(...tv), thi=Math.max(...tv), ts=(thi-tlo)||1;
  const X=i=>n===1?(xL+xR)/2:+(xL+(tv[i]-tlo)/ts*(xR-xL)).toFixed(1);
  let s='';
  for(let v=ax.lo; v<=ax.hi+1e-9; v+=ax.step){
    s+='<line x1="'+xL+'" y1="'+Y(v)+'" x2="'+xR+'" y2="'+Y(v)+'" stroke="'+R.line+'" stroke-width="1"/>';
    s+='<text x="'+(xL-6)+'" y="'+(Y(v)+3.5)+'" font-size="10" font-weight="700" fill="'+R.muted+'" text-anchor="end">'+v+'</text>';
  }
  if(avg!=null){
    const ay=Y(avg), above=ay-top>16;
    s+='<line x1="'+xL+'" y1="'+ay+'" x2="'+xR+'" y2="'+ay+'" stroke="'+R.accent+'" stroke-width="1.5" stroke-dasharray="5 4"/>';
    s+='<text x="'+xR+'" y="'+(above?ay-5:ay+13)+'" font-size="10.5" font-weight="800" fill="'+R.accent+'" text-anchor="end">Ø '+fmtMetric(type,avg)+'</text>';
  }
  if(n>1) s+='<polyline'+(anim?' class="dg-line"':'')+' points="'+list.map((m,i)=>X(i)+','+Y(m.value)).join(' ')+'" fill="none" stroke="'+R.muted+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity=".5"/>';
  list.forEach((m,i)=>{ const c=catMetric(type,m.value).c;
    s+='<circle'+(anim?' class="dg-pt"':'')+' cx="'+X(i)+'" cy="'+Y(m.value)+'" r="4.5" fill="'+(R[c]||R.muted)+'" stroke="'+R.surf+'" stroke-width="1.4"'+(anim?' style="animation-delay:'+(0.3+i*0.03).toFixed(2)+'s"':'')+'/>'; });
  /* Datums-Beschriftung: erster, mittlerer (zeitlich), letzter Punkt – ohne Überlappung. */
  const dl=(i,anchor,x)=>{ const d=new Date(list[i].ts); return '<text x="'+(x!=null?x:X(i))+'" y="'+(H-8)+'" font-size="10" font-weight="700" fill="'+R.muted+'" text-anchor="'+anchor+'">'+pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.</text>'; };
  if(n===1) s+=dl(0,'middle');
  else{
    s+=dl(0,'start',xL)+dl(n-1,'end',xR);
    if(n>2){ const mid=(tlo+thi)/2; let k=1; for(let i=1;i<n-1;i++) if(Math.abs(tv[i]-mid)<Math.abs(tv[k]-mid)) k=i;
      if(X(k)-xL>52&&xR-X(k)>52) s+=dl(k,'middle'); }
  }
  return '<svg class="dg-svg" viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block" role="img" aria-label="Verlauf '+METRICS[type].name+'">'+s+'</svg>';
}

/* ---------- Detail: Position auf der Ampel-Skala ----------
   Temperatur 34–42 °C (Gelb auf beiden Seiten), Sauerstoff 85–100 % (Reihenfolge umgedreht). */
function metricScale(type){
  const t=settings.thr;
  if(type==='temp') return {lo:34,hi:42,segs:[['y',34,t.tempLow],['g',t.tempLow,t.tempY],['y',t.tempY,t.tempR],['r',t.tempR,42]],
    ticks:[[34,'34 °C'],[t.tempLow,fmtMetric('temp',t.tempLow)],[t.tempY,fmtMetric('temp',t.tempY)],[t.tempR,fmtMetric('temp',t.tempR)],[42,'42 °C']]};
  return {lo:85,hi:100,segs:[['r',85,t.spo2Y],['y',t.spo2Y,t.spo2G],['g',t.spo2G,100]],
    ticks:[[85,'85 %'],[t.spo2Y,t.spo2Y+' %'],[t.spo2G,t.spo2G+' %'],[100,'100 %']]};
}
