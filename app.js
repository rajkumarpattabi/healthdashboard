/* HealthDashboard — app logic. Data: localStorage (primary) seeded from data/seed.js; Google Drive = backup. */
'use strict';
const LS_KEY='hd_data_v1';
function safeParse(s){try{return JSON.parse(s)||{};}catch(e){return {};}}
// config comes from config.js, overridable by in-app entry saved to localStorage
let CFG=Object.assign({},window.HD_CONFIG||{},safeParse(localStorage.getItem('hd_gcfg')));

/* ---------- parameter dictionary (also drives the upload parser) ---------- */
const SEC={DIA:'Diabetes Profile',HRT:'Heart Health',KID:'Kidney Function',LIV:'Liver Health',CBC:'Complete Blood Picture',THY:'Thyroid Function',VIT:'Vitamins & Minerals',BONE:'Bone Health',CAN:'Cancer Screening'};
const SECTIONS=[SEC.DIA,SEC.HRT,SEC.KID,SEC.LIV,SEC.CBC,SEC.THY,SEC.VIT,SEC.BONE,SEC.CAN];
const KEY=new Set(['HbA1c','Fasting Glucose','Fasting Insulin','HOMA-IR','Total Cholesterol','LDL Cholesterol','HDL Cholesterol','Triglycerides','Apolipoprotein B','Creatinine','Uric Acid','Hemoglobin','TSH','Vitamin D','Vitamin B12']);
const ORDER=['HbA1c','Fasting Glucose','Fasting Insulin','HOMA-IR','Total Cholesterol','LDL Cholesterol','HDL Cholesterol','Non-HDL Cholesterol','VLDL Cholesterol','Triglycerides','Apolipoprotein B','Apolipoprotein A1','LDL/HDL Ratio','TG/HDL Ratio','Creatinine','Urea','Uric Acid','Sodium','Chloride','Bicarbonate','SGPT (ALT)','SGOT (AST)','GGT','Alkaline Phosphatase','Bilirubin Total','Bilirubin Direct','Total Protein','Albumin','Hemoglobin','RBC Count','PCV','MCV','MCH','RDW-CV','WBC Count','Neutrophils','Lymphocytes','Eosinophils','Monocytes','Basophils','Platelet Count','TSH','Total T4','Total T3','Vitamin B12','Iron','TIBC','Vitamin D','Calcium','Phosphorus','PSA Total','CEA','CA 125'];
// lab-format upload parser dictionary (core params). Aarthi SMART REPORTs use parseAarthi().
const DICT={
 'HbA1c':{sec:SEC.DIA,unit:'%',special:'hba1c'},
 'Fasting Glucose':{sec:SEC.DIA,unit:'mg/dL',pats:['GLUCOSE FASTING','Glucose[ ,\\-]*Blood[ ,\\-]*Fasting','Fasting Plasma Glucose','Glucose \\(Fasting','Glucose, Fasting']},
 'Fasting Insulin':{sec:SEC.DIA,unit:'µIU/mL',pats:['INSULIN ?\\(F','Fasting Insulin','Insulin[ ,\\-]*Fasting','Insulin\\b']},
 'Total Cholesterol':{sec:SEC.HRT,unit:'mg/dL',pats:['Total Cholesterol','Cholesterol Total','CHOLESTEROL\\b']},
 'HDL Cholesterol':{sec:SEC.HRT,unit:'mg/dL',pats:['HDL Cholesterol','HDL CHOLESTEROL','Cholesterol[ \\-]*HDL','HDL\\b']},
 'LDL Cholesterol':{sec:SEC.HRT,unit:'mg/dL',pats:['LDL Cholesterol','LDL CHOLESTEROL','Cholesterol[ \\-]*LDL','LDL\\b']},
 'Triglycerides':{sec:SEC.HRT,unit:'mg/dL',pats:['Triglycerid']},
 'Creatinine':{sec:SEC.KID,unit:'mg/dL',pats:['Creatinine,?\\s*Serum','Creatinine\\b','Serum Creatinine']},
 'Urea':{sec:SEC.KID,unit:'mg/dL',pats:['Blood Urea\\b','Urea\\b'],skip:/ratio|nitrogen/i},
 'Uric Acid':{sec:SEC.KID,unit:'mg/dL',pats:['Uric Acid']},
 'Hemoglobin':{sec:SEC.CBC,unit:'g/dL',pats:['Haemoglobin\\b','Hemoglobin\\b']},
 'WBC Count':{sec:SEC.CBC,unit:'10^3/µL',pats:['Total WBC','WBC count','WBC Count','Total Leucocyte'],conv:'wbc'},
 'RBC Count':{sec:SEC.CBC,unit:'10^6/µL',pats:['RBC\\b']},
 'Platelet Count':{sec:SEC.CBC,unit:'10^3/µL',pats:['Platelet Count'],conv:'plt'},
 'TSH':{sec:SEC.THY,unit:'µIU/mL',pats:['TSH\\b','Thyroid Stimulating Hormone','Thyroid-stimulating']},
 'Vitamin D':{sec:SEC.BONE,unit:'ng/mL',special:'vitd'},
 'Vitamin B12':{sec:SEC.VIT,unit:'pg/mL',special:'vitb12'},
};
// classify an Aarthi SMART REPORT glance label -> {canon,sec,key}
function classifyAarthi(nm){const n=nm.toUpperCase();const R=[
 ['HBA1C','HbA1c',SEC.DIA,1],['GLUCOSE FASTING','Fasting Glucose',SEC.DIA,1],['INSULIN RESISTANCE','HOMA-IR',SEC.DIA,1],['HOMA','HOMA-IR',SEC.DIA,1],['INSULIN','Fasting Insulin',SEC.DIA,1],
 ['NON-HDL','Non-HDL Cholesterol',SEC.HRT,0],['VLDL','VLDL Cholesterol',SEC.HRT,0],['LDL/HDL','LDL/HDL Ratio',SEC.HRT,0],['TGL/HDL','TG/HDL Ratio',SEC.HRT,0],
 ['HDL CHOLESTEROL','HDL Cholesterol',SEC.HRT,1],['LDL CHOLESTEROL','LDL Cholesterol',SEC.HRT,1],['APOLIPOPROTEIN A','Apolipoprotein A1',SEC.HRT,0],['APOLIPOPROTEIN B','Apolipoprotein B',SEC.HRT,1],
 ['TRIGLYCERIDES','Triglycerides',SEC.HRT,1],['CHOLESTEROL','Total Cholesterol',SEC.HRT,1],
 ['UREA','Urea',SEC.KID,0],['CREATININE','Creatinine',SEC.KID,1],['URIC ACID','Uric Acid',SEC.KID,1],['SODIUM','Sodium',SEC.KID,0],['CHLORIDE','Chloride',SEC.KID,0],['BICARBONATE','Bicarbonate',SEC.KID,0],
 ['TOTAL PROTEIN','Total Protein',SEC.LIV,0],['ALBUMIN','Albumin',SEC.LIV,0],['BILIRUBIN TOTAL','Bilirubin Total',SEC.LIV,0],['BILIRUBIN DIRECT','Bilirubin Direct',SEC.LIV,0],
 ['ALKALINE PHOSPHATASE','Alkaline Phosphatase',SEC.LIV,0],['GAMMA GLUTAMYL','GGT',SEC.LIV,0],['GGT','GGT',SEC.LIV,0],['SGOT','SGOT (AST)',SEC.LIV,0],['SGPT','SGPT (ALT)',SEC.LIV,0],
 ['HAEMOGLOBIN (HB)','Hemoglobin',SEC.CBC,1],['RBC','RBC Count',SEC.CBC,0],['PACKED CELL','PCV',SEC.CBC,0],['PCV','PCV',SEC.CBC,0],
 ['MEAN CORPUSCULAR VOLUME','MCV',SEC.CBC,0],['MCV','MCV',SEC.CBC,0],['MEAN CORPUSCULAR HEMOGLOBIN','MCH',SEC.CBC,0],['MCH','MCH',SEC.CBC,0],['RDW','RDW-CV',SEC.CBC,0],
 ['TOTAL WBC','WBC Count',SEC.CBC,0],['WBC','WBC Count',SEC.CBC,0],['NEUTROPHIL','Neutrophils',SEC.CBC,0],['LYMPHOCYTE','Lymphocytes',SEC.CBC,0],['EOSINOPHIL','Eosinophils',SEC.CBC,0],['MONOCYTE','Monocytes',SEC.CBC,0],['BASOPHIL','Basophils',SEC.CBC,0],['PLATELET','Platelet Count',SEC.CBC,0],
 ['TSH','TSH',SEC.THY,1],['THYROID-STIMULATING','TSH',SEC.THY,1],['T4','Total T4',SEC.THY,0],['T3','Total T3',SEC.THY,0],
 ['VITAMIN B12','Vitamin B12',SEC.VIT,0],['TOTAL IRON BINDING','TIBC',SEC.VIT,0],['IRON','Iron',SEC.VIT,0],
 ['VITAMIN D','Vitamin D',SEC.BONE,1],['CALCIUM','Calcium',SEC.BONE,0],['PHOSPHORUS','Phosphorus',SEC.BONE,0],
 ['PSA','PSA Total',SEC.CAN,0],['CARCINOEMBRYONIC','CEA',SEC.CAN,0],['CEA','CEA',SEC.CAN,0],['CANCER ANTIGEN 125','CA 125',SEC.CAN,0],['CA 125','CA 125',SEC.CAN,0],
 ];
 for(const [kw,canon,sec,key] of R) if(n.includes(kw)) return {canon,sec,key:!!key};
 return null;}
function thFromRef(ref){ if(ref&&ref.includes('-')){const p=ref.replace('–','-').split('-');const lo=parseFloat(p[0]),hi=parseFloat(p[1]);
   if(!isNaN(lo)&&!isNaN(hi)) return lo===0?{type:'max',t:hi}:{type:'range',lo,hi};} return {type:'range',lo:-1e9,hi:1e9};}
function TH(name,sex){const M=sex==='Male';return ({
 'HbA1c':{type:'max',t:5.7,warn:5.7,crit:6.5},
 'Fasting Glucose':{type:'max',t:100,warn:100,crit:126},
 'Total Cholesterol':{type:'max',t:200,warn:200,crit:240},
 'LDL Cholesterol':{type:'max',t:100,warn:100,crit:160},
 'HDL Cholesterol':{type:'min',t:M?40:50},
 'Triglycerides':{type:'max',t:150,warn:150,crit:200},
 'Creatinine':{type:'range',lo:M?0.7:0.6,hi:M?1.3:1.1},
 'Uric Acid':{type:'range',lo:M?3.5:2.6,hi:M?7.2:6.0},
 'Hemoglobin':{type:'range',lo:M?13:12,hi:M?17:15},
 'TSH':{type:'range',lo:0.4,hi:4.2},
 'Fasting Insulin':{type:'range',lo:2.6,hi:24.9},
 'Urea':{type:'range',lo:17,hi:51},
 'Platelet Count':{type:'range',lo:150,hi:410},
 'WBC Count':{type:'range',lo:4.0,hi:11.0},
 'RBC Count':{type:'range',lo:M?4.5:3.8,hi:M?5.9:5.1},
 'Vitamin D':{type:'range',lo:30,hi:100},
 'Vitamin B12':{type:'range',lo:200,hi:900},
}[name])||{type:'range',lo:-1e9,hi:1e9};}
function targetStr(th){return th.type==='max'?('< '+(+th.t)):th.type==='min'?('> '+(+th.t)):(th.lo+'–'+th.hi);}

/* ---------- state ---------- */
let HD, person, view='dash', reportMode='latest', trendRange='all';
const collapsed=new Set();
const ms=d=>{const[y,m,dd]=d.split('-');return Date.UTC(+y,+m-1,+dd);};
function msToShort(v){const d=new Date(v);return MON[d.getUTCMonth()]+' '+d.getUTCFullYear();}
function windowBounds(){const TS=HD.dates.map(ms); if(!TS.length)return[0,1]; const end=Math.max(...TS);
  if(trendRange==='all')return[Math.min(...TS),end];
  const yrs={'3y':3,'2y':2,'1y':1}[trendRange]||99; return[end-Math.round(yrs*365.25*864e5),end];}
function toggleSection(sl){const b=document.getElementById('sb-'+sl),c=document.getElementById('cr-'+sl);if(!b)return;
  const hide=b.style.display!=='none'; b.style.display=hide?'none':''; if(c)c.textContent=hide?'▸':'▾';
  hide?collapsed.add(sl):collapsed.delete(sl);}
function scrollToSection(sl){ if(collapsed.has(sl)){collapsed.delete(sl);const b=document.getElementById('sb-'+sl),c=document.getElementById('cr-'+sl);if(b)b.style.display='';if(c)c.textContent='▾';}
  const h=document.getElementById('sec-'+sl); if(h){h.scrollIntoView({behavior:'smooth',block:'start'});h.classList.remove('flash');void h.offsetWidth;h.classList.add('flash');}}
function setTrendRange(k){trendRange=k;renderTrends();}
// Safe default so the app still boots if data/seed.js is removed (data-free public repo).
const DEFAULT_EMPTY={dates:[],labels:[],sections:SECTIONS,profiles:[
  {id:'rajkumar',name:'Rajkumar',age:43,sex:'Male',labs:[],params:{}},
  {id:'baskari', name:'Baskari', age:39,sex:'Female',labs:[],params:{}}]};
function load(){ try{const s=localStorage.getItem(LS_KEY); if(s)return JSON.parse(s);}catch(e){}
  const base = (typeof window!=='undefined'&&window.SEED)?window.SEED:DEFAULT_EMPTY;
  return JSON.parse(JSON.stringify(base)); }
function persist(){ try{localStorage.setItem(LS_KEY, JSON.stringify(HD));}catch(e){} }
function prof(id){ return HD.profiles.find(p=>p.id===(id||person)); }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function lbl(iso){const [y,m,d]=iso.split('-');return `${(+d)<10?'0':''}${+d} ${MON[+m-1]} ${y}`;}
function shortDate(iso){const [y,m]=iso.split('-');return `${MON[+m-1]} ${y}`;}

/* ---------- status ---------- */
function statusOf(th,v){ if(v==null)return 'na';
 if(th.type==='max'){ if(th.crit&&v>=th.crit)return 'crit'; return v>=th.t?'warn':'good'; }
 if(th.type==='min') return v>=th.t?'good':'warn';
 return (v<th.lo||v>th.hi)?'warn':'good'; }
const ST={good:{c:'p-good',lb:'Normal',ic:'✓'},warn:{c:'p-warn',lb:'Watch',ic:'▲'},crit:{c:'p-crit',lb:'High',ic:'▲'}};
function pill(th,v){ let s=statusOf(th,v); if(s==='na')return '';
 let lb=ST[s].lb, ic=ST[s].ic;
 if(s==='warn'){ if(th.type==='range') lb=v<th.lo?'Low':'High'; else if(th.type==='min') lb='Low'; else lb='Borderline'; }
 if(s==='crit') lb='High';
 ic = lb==='Low'?'▼':(s==='good'?'✓':'▲');
 return `<span class="pill ${ST[s].c}"><span class="ic">${ic}</span>${lb}</span>`; }

/* ---------- helpers on a param ---------- */
const measuredIdx=v=>v.map((x,i)=>x==null?-1:i).filter(i=>i>=0);
function lastMeasured(p){for(let i=p.values.length-1;i>=0;i--) if(p.values[i]!=null) return {v:p.values[i],idx:i}; return {v:null,idx:-1};}
function hasTrend(name,p){return KEY.has(name)&&measuredIdx(p.values).length>=2;}
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');

/* ---------- charts ---------- */
function sparkline(vals,th){const w=56,h=30,pad=3,mi=measuredIdx(vals),mv=mi.map(i=>vals[i]);
 if(!mi.length)return '';const mn=Math.min(...mv),mx=Math.max(...mv),rng=(mx-mn)||1,n=(vals.length-1)||1;
 const X=i=>pad+i*((w-2*pad)/n),Y=v=>h-pad-((v-mn)/rng)*(h-2*pad);
 const s=statusOf(th,mv[mv.length-1]),col=s==='good'?'var(--series)':(s==='crit'?'var(--critical)':'var(--warning)');
 let seg='';for(let k=0;k<mi.length-1;k++){const a=mi[k],b=mi[k+1],dash=(b-a>1)?'stroke-dasharray="3 2.5"':'';
  seg+=`<line x1="${X(a).toFixed(1)}" y1="${Y(vals[a]).toFixed(1)}" x2="${X(b).toFixed(1)}" y2="${Y(vals[b]).toFixed(1)}" stroke="${col}" stroke-width="2" stroke-linecap="round" ${dash}/>`;}
 const last=mi[mi.length-1];
 return `<svg class="spark" viewBox="0 0 ${w} ${h}">${seg}<circle cx="${X(last).toFixed(1)}" cy="${Y(vals[last]).toFixed(1)}" r="2.6" fill="${col}"/></svg>`;}

function lineChart(vals,th,unit,d0,d1){const W=372,H=150,L=34,R=14,T=14,B=26,iw=W-L-R,ih=H-T-B;
 const TS=HD.dates.map(ms);
 const mi=measuredIdx(vals),mv=mi.map(i=>vals[i]);let lo=Math.min(...mv),hi=Math.max(...mv);
 const marks=th.type==='range'?[th.lo,th.hi]:[th.t];marks.forEach(m=>{lo=Math.min(lo,m);hi=Math.max(hi,m);});
 const pv=(hi-lo)*0.15||1;lo-=pv;hi+=pv;
 const t0=(d0!=null?d0:TS[0]),t1=(d1!=null?d1:TS[TS.length-1]);const span=(t1-t0)||1;
 const X=i=>L+((TS[i]-t0)/span)*iw,Y=v=>T+ih-((v-lo)/(hi-lo))*ih;
 let band='';if(th.type==='max'){const y=Y(th.t);band=`<rect x="${L}" y="${y}" width="${iw}" height="${(T+ih)-y}" fill="var(--good-soft)"/>`;}
 else if(th.type==='min'){const y=Y(th.t);band=`<rect x="${L}" y="${T}" width="${iw}" height="${y-T}" fill="var(--good-soft)"/>`;}
 else{const y1=Y(th.hi),y2=Y(th.lo);band=`<rect x="${L}" y="${y1}" width="${iw}" height="${y2-y1}" fill="var(--good-soft)"/>`;}
 const tline=(v,t)=>{const y=Y(v);return `<line x1="${L}" y1="${y}" x2="${L+iw}" y2="${y}" stroke="var(--warning)" stroke-width="1" stroke-dasharray="4 3" opacity=".8"/><text x="${L+iw}" y="${y-3}" fill="var(--warning)" font-size="9" text-anchor="end">${t}</text>`;};
 let thl=th.type==='max'?tline(th.t,'target '+(+th.t)):th.type==='min'?tline(th.t,'min '+(+th.t)):tline(th.hi,''+th.hi)+tline(th.lo,''+th.lo);
 const grid=`<line x1="${L}" y1="${T+ih}" x2="${L+iw}" y2="${T+ih}" stroke="var(--baseline)" stroke-width="1"/>`;
 let yt='';for(let k=0;k<=2;k++){const v=lo+(hi-lo)*k/2,y=Y(v);yt+=`<text x="${L-6}" y="${y+3}" fill="var(--muted)" font-size="9" text-anchor="end">${(+v.toFixed(v>20?0:1))}</text>`;}
 const s=statusOf(th,mv[mv.length-1]),col=s==='good'?'var(--series)':(s==='crit'?'var(--critical)':'var(--warning)');
 let seg='';for(let k=0;k<mi.length-1;k++){const a=mi[k],b=mi[k+1],dash=(b-a>1)?'stroke-dasharray="6 4" opacity="0.8"':'';
  seg+=`<line x1="${X(a).toFixed(1)}" y1="${Y(vals[a]).toFixed(1)}" x2="${X(b).toFixed(1)}" y2="${Y(vals[b]).toFixed(1)}" stroke="${col}" stroke-width="2" stroke-linecap="round" ${dash}/>`;}
 let dots=mi.map((i,k)=>{const last=k===mi.length-1;return `<circle cx="${X(i).toFixed(1)}" cy="${Y(vals[i]).toFixed(1)}" r="${last?4:2.8}" fill="${last?col:'var(--surface)'}" stroke="${col}" stroke-width="2"/>`;}).join('');
 const xl=`<text x="${L}" y="${H-8}" fill="var(--muted)" font-size="9">${msToShort(t0)}</text><text x="${L+iw}" y="${H-8}" fill="var(--muted)" font-size="9" text-anchor="end">${msToShort(t1)}</text>`;
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${band}${grid}${yt}${thl}${seg}${dots}${xl}</svg>`;}

function inference(name,vals,th,unit,slots){const mi=measuredIdx(vals);if(mi.length<2)return '';
 const first=vals[mi[0]],last=vals[mi[mi.length-1]];
 const dir=last>first?'rose':(last<first?'fell':'held steady'),ar=last>first?'↗':(last<first?'↘':'→');
 const s=statusOf(th,last);let pos;
 if(th.type==='max')pos=last>=th.t?`still above the ${+th.t} ${unit} target`:`within the healthy range (target &lt; ${+th.t})`;
 else if(th.type==='min')pos=last>=th.t?`at a healthy level (target ≥ ${+th.t})`:`below the ${+th.t} ${unit} target`;
 else pos=(last<th.lo)?`below the normal ${th.lo}–${th.hi} range`:(last>th.hi?`above the normal ${th.lo}–${th.hi} range`:`inside the normal ${th.lo}–${th.hi} range`);
 const verb=s==='good'?'and is now':'but is',miss=(slots!=null?slots:vals.length)-mi.length;
 const gap=miss?` <span style="color:var(--muted)">(${miss} report${miss>1?'s':''} didn't include it)</span>`:'';
 const col=s==='good'?'var(--good)':(s==='crit'?'var(--critical)':'var(--warning)');
 return `<b class="ar" style="color:${col}">${ar}</b><span>${name} ${dir} from <b>${first}</b> to <b>${last} ${unit}</b> across ${mi.length} readings${gap}, ${verb} ${pos}.</span>`;}

/* ---------- renderers ---------- */
function renderToggle(){document.getElementById('toggle').innerHTML=HD.profiles.map(p=>
  `<button data-p="${p.id}" class="${p.id===person?'active':''}" onclick="setPerson('${p.id}')">${p.name} <span class="sub">(${p.age}/${(p.sex||'')[0]||''})</span></button>`).join('');}
function populateReports(){let o='<option value="latest">Combined (latest)</option>';
 const p=prof();for(let i=HD.dates.length-1;i>=0;i--){const has=Object.values(p.params).some(x=>x.values[i]!=null);if(!has)continue;
  o+=`<option value="${i}">${lbl(HD.dates[i])} · ${p.labs[i]||''}</option>`;}
 const s=document.getElementById('reportSel');s.innerHTML=o;s.value=reportMode;}

function paramsBySection(){const p=prof(),map={};SECTIONS.forEach(s=>map[s]=[]);
 ORDER.forEach(n=>{const pp=p.params[n];if(pp&&map[pp.section])map[pp.section].push([n,pp]);});
 // include any params not in ORDER
 Object.entries(p.params).forEach(([n,pp])=>{if(!ORDER.includes(n)&&map[pp.section])map[pp.section].push([n,pp]);});
 return map;}

function renderDash(){ reportMode==='latest'?renderLatest():renderReport(+reportMode); }
function healthCard(){
  const p=prof(); const sys={}; let inr=0,tot=0;
  SECTIONS.forEach(s=>sys[s]={any:false,concern:0});
  Object.values(p.params).forEach(pp=>{const lm=lastMeasured(pp); if(lm.idx<0)return;
    if(!sys[pp.section])sys[pp.section]={any:false,concern:0}; sys[pp.section].any=true; tot++;
    if(statusOf(pp.th,lm.v)==='good')inr++; else sys[pp.section].concern++;});
  if(!tot) return '';
  const score=Math.round(100*inr/tot);
  const chips=SECTIONS.filter(s=>sys[s]&&sys[s].any).map(s=>`<div class="hs-sys ${sys[s].concern?'bad':'ok'}" onclick="scrollToSection('${slug(s)}')"><span class="hi">${sys[s].concern?'!':'✓'}</span>${s}${sys[s].concern?` <em>${sys[s].concern}</em>`:''}</div>`).join('');
  return `<div class="hs-card"><div class="hs-top"><div class="hsn">${score}<span>/100</span></div>
    <div class="hsl">Health Score<br><span>${p.name} · latest results</span></div></div>
    <div class="hs-grid">${chips}</div></div>`;
}
function renderLatest(){let html=healthCard()+'',map=paramsBySection();
 SECTIONS.forEach(sec=>{const rows=map[sec].filter(([n,p])=>lastMeasured(p).idx>=0);if(!rows.length)return;
  const sl=slug(sec),col=collapsed.has(sl);
  html+=`<div class="section sec-h" id="sec-${sl}" onclick="toggleSection('${sl}')">${sec} <span class="count">${rows.length}</span><span class="sec-caret" id="cr-${sl}">${col?'▸':'▾'}</span></div><div class="sec-body" id="sb-${sl}" ${col?'style="display:none"':''}><div class="card">`;
  rows.forEach(([name,p])=>{const lm=lastMeasured(p),v=lm.v,stale=lm.idx!==p.values.length-1&&lm.idx>=0;
   const ref=p.refs&&p.refs[lm.idx]?p.refs[lm.idx]:'—';
   const sub=stale?`Target ${p.target} ${p.unit} · <span style="color:var(--warning)">last measured ${shortDate(HD.dates[lm.idx])}</span>`
                  :`Target ${p.target} ${p.unit} · lab range ${ref}`;
   const tap=hasTrend(name,p);
   html+=`<div class="row ${tap?'tappable':''}" ${tap?`onclick="gotoTrend('${slug(name)}')"`:''}>
     <div class="name"><div class="t">${name}</div><div class="r">${sub}</div></div>
     ${sparkline(p.values,p.th)}
     <div class="val-wrap"><div class="val"><span class="v">${v}</span><span class="u">${p.unit}</span></div>${pill(p.th,v)}</div>
     <span class="chev">›</span></div>`;});
  html+='</div></div>';});
 document.getElementById('v-dash').innerHTML=html||emptyState('No data for this profile yet.');}

function renderReport(idx){let html='',map=paramsBySection(),p=prof(),total=0;
 html+=`<div class="snap-note">📄 <span>Showing the <b style="color:var(--ink)">${lbl(HD.dates[idx])}</b> report exactly as recorded</span><span class="lab">${p.labs[idx]||''}</span></div>`;
 SECTIONS.forEach(sec=>{const rows=map[sec].filter(([n,pp])=>pp.values[idx]!=null);if(!rows.length)return;total+=rows.length;
  const sl=slug(sec),col=collapsed.has(sl);
  html+=`<div class="section sec-h" id="sec-${sl}" onclick="toggleSection('${sl}')">${sec} <span class="count">${rows.length}</span><span class="sec-caret" id="cr-${sl}">${col?'▸':'▾'}</span></div><div class="sec-body" id="sb-${sl}" ${col?'style="display:none"':''}><div class="card">`;
  rows.forEach(([name,pp])=>{const v=pp.values[idx],tap=hasTrend(name,pp),ref=pp.refs&&pp.refs[idx]?pp.refs[idx]:pp.target;
   const sub=`Reference ${ref} ${pp.unit}`+(tap?'':' · <span style="color:var(--muted)">no trend</span>');
   html+=`<div class="row ${tap?'tappable':''}" ${tap?`onclick="gotoTrend('${slug(name)}')"`:''}>
     <div class="name"><div class="t">${name}</div><div class="r">${sub}</div></div>
     <div class="val-wrap"><div class="val"><span class="v">${v}</span><span class="u">${pp.unit}</span></div>${pill(pp.th,v)}</div>
     <span class="chev">›</span></div>`;});
  html+='</div></div>';});
 html+=`<p class="muted-note">${total} parameters recorded in this report. Tap any with a “›” to see its trend across reports.</p>`;
 document.getElementById('v-dash').innerHTML=html;}

function renderTrends(){const p=prof();let html='';const [d0,d1]=windowBounds();
 ORDER.filter(n=>KEY.has(n)).forEach(name=>{const pp=p.params[name];if(!pp)return;
  if(measuredIdx(pp.values).length<2) return;                       // req6: need ≥2 total readings
  const lm=lastMeasured(pp),v=lm.v,stale=lm.idx>=0&&lm.idx!==pp.values.length-1;
  const st=statusOf(pp.th,v),staleTxt=stale?` · <span style="color:var(--warning)">last measured ${shortDate(HD.dates[lm.idx])}</span>`:'';
  const fv=pp.values.map((x,i)=> (ms(HD.dates[i])>=d0 && ms(HD.dates[i])<=d1)? x : null);   // window filter
  const inWin=measuredIdx(fv).length;
  let mid;
  if(inWin===0) mid=`<div class="muted-note" style="padding:16px 2px">No readings in this range — widen the range.</div>`;
  else mid=`<div class="chart-wrap">${lineChart(fv,pp.th,pp.unit,d0,d1)}</div>`+
       (inWin>=2?`<div class="infer">${inference(name,fv,pp.th,pp.unit,HD.dates.filter(dd=>ms(dd)>=d0&&ms(dd)<=d1).length)}</div>`
                :`<div class="muted-note" style="margin-top:8px">Only one reading in this range — widen it to see the trend.</div>`);
  html+=`<div class="tcard" id="tc-${slug(name)}">
    <div class="thead"><div><div class="tt">${name}</div><div class="tgt">Target <b>${pp.target} ${pp.unit}</b> · for ${p.sex.toLowerCase()}, ${p.age}y${staleTxt}</div></div>
      <div class="now"><div class="v" style="color:${st==='good'?'var(--ink)':(st==='crit'?'#ff8a8a':'#ffcf6b')}">${v}</div><div class="u">${pp.unit}</div></div></div>
    ${mid}</div>`;});
 if(!html) html=`<div class="empty"><div class="big">📈</div><b>No trends in this range.</b><div class="muted-note">Try a wider range, or add more reports.</div></div>`;
 document.getElementById('trendsBody').innerHTML=html;
 const chips=[['all','All'],['3y','3y'],['2y','2y'],['1y','1y']];
 document.getElementById('rangeChips').innerHTML=chips.map(([k,l])=>`<span class="chip ${trendRange===k?'active':''}" onclick="setTrendRange('${k}')">${l}</span>`).join('');}

const RECO={
 'HbA1c':['Cut added sugar and refined carbs; favour whole grains, legumes and vegetables.','Aim for 30 min of brisk activity most days.','Recheck HbA1c in about 3 months.'],
 'Fasting Glucose':['Keep dinner earlier and lighter on carbs.','Add a short post-meal walk.','Read alongside the HbA1c trend.'],
 'Triglycerides':['Reduce fried food, sugary drinks and alcohol.','Increase omega-3 (fish, flax) and fibre.','Recheck lipid profile in 8–12 weeks.'],
 'LDL Cholesterol':['Limit saturated fat (fried snacks, red meat, full-fat dairy).','Add soluble fibre — oats, beans, fruit.','Discuss with your doctor if it stays ≥ 100.'],
 'Total Cholesterol':['Favour unsaturated fats; cut fried and processed food.','Stay active and keep a healthy weight.'],
 'HDL Cholesterol':['Regular aerobic exercise raises HDL.','Prefer healthy fats (nuts, olive oil, fish).'],
 'Hemoglobin':['Include iron-rich foods (greens, dates, legumes) with vitamin-C.','If low and persistent, ask your doctor to check iron studies.'],
 'Uric Acid':['Reduce red meat, organ meats, shellfish and alcohol.','Stay well hydrated.','Discuss with your doctor if you get joint pain.'],
 'TSH':['Borderline TSH is common — recheck to confirm.','Discuss thyroid symptoms (fatigue, weight change) with your doctor.'],
 'Creatinine':['Stay hydrated.','Review any regular painkillers/supplements with your doctor.'],
};
const RECO_DEF=['This value is outside the target band — recheck at the next test.','Share the trend with your doctor.'];
RECO['Apolipoprotein B']=['ApoB reflects the number of artery-clogging particles — lower is better.','Cut saturated/trans fat, add soluble fibre, exercise regularly.','Discuss with your doctor if it stays above 100.'];
RECO['HOMA-IR']=['A raised HOMA-IR suggests insulin resistance.','Reduce refined carbs/sugar; build muscle with resistance + aerobic exercise.','Weight loss of even 5–7% notably improves it; discuss with your doctor.'];
RECO['Vitamin D']=['Get 15–20 min of morning sun most days.','Eat vitamin-D foods (egg yolk, fatty fish, fortified milk).','Ask your doctor about a supplement — deficiency often needs one.'];
function severity(th,v){ let dist=0,dir='';
 if(th.type==='max'){dir='high';dist=(v-th.t)/(th.t||1);}
 else if(th.type==='min'){dir='low';dist=(th.t-v)/(th.t||1);}
 else { if(v>th.hi){dir='high';dist=(v-th.hi)/(th.hi||1);} else if(v<th.lo){dir='low';dist=(th.lo-v)/(th.lo||1);} }
 if(dist<=0) return '';
 return (dist>0.2?'Significantly ':'Mildly ')+dir; }
function renderActions(){const p=prof();let html='',n=0;
 ORDER.filter(x=>KEY.has(x)).forEach(name=>{const pp=p.params[name];if(!pp)return;const lm=lastMeasured(pp);if(lm.idx<0)return;
  const s=statusOf(pp.th,lm.v);if(s==='good')return;n++;const recos=RECO[name]||RECO_DEF;const sev=severity(pp.th,lm.v);
  const recheck = s==='crit'?'recheck in ~6 weeks':'recheck in ~3 months';
  html+=`<div class="act ${s==='crit'?'crit':''}"><div class="ahead"><div class="an">${name}</div>${pill(pp.th,lm.v)}</div>
   <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${sev?sev.charAt(0).toUpperCase()+sev.slice(1)+' · ':''}Latest ${lm.v} ${pp.unit} · target ${pp.target}${lm.idx!==pp.values.length-1?' · '+shortDate(HD.dates[lm.idx]):''}</div>
   <ul>${recos.map(r=>`<li>${r}</li>`).join('')}<li>Suggested follow-up: ${recheck} (your doctor knows best).</li></ul>
   <div class="disc"><span>ⓘ</span><span>General guidance only — not a diagnosis. Please review with your doctor.</span></div></div>`;});
 if(!n)html=`<div class="empty"><div class="big">✅</div><b>All key parameters are within target.</b><div class="muted-note">Keep up the current routine.</div></div>`;
 document.getElementById('v-actions').innerHTML=html;
 const b=document.getElementById('actBadge');b.style.display=n?'grid':'none';b.textContent=n;}

function emptyState(msg){return `<div class="empty"><div class="big">📄</div>${msg}</div>`;}

/* ---------- Sync tab ---------- */
function renderSync(){const cfgOK=!!CFG.GOOGLE_CLIENT_ID;const st=Drive.state;
 let body;
 if(!cfgOK){ const inS='width:100%;margin:6px 0;padding:11px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);font:500 12.5px var(--font)';
   body=`<div class="section" style="margin-left:2px">Set up Google Drive backup</div>
   <div class="synccard" style="padding:12px 14px">
     <p class="muted-note" style="margin:2px 0 10px">Your data is safe on this device. To also back up to Drive, create a free Google <b>OAuth Client ID</b> (Google Cloud Console → enable Drive API — full steps in the README) and paste it here. The app makes its own <b>HealthDashboard</b> folder in your Drive.</p>
     <input id="gcId" style="${inS}" placeholder="Client ID (…apps.googleusercontent.com)" value="${CFG.GOOGLE_CLIENT_ID||''}">
     <input id="gcKey" style="${inS}" placeholder="API key (optional — not needed)" value="${CFG.GOOGLE_API_KEY||''}">
   </div>
   <div class="sync-actions"><button class="btn" onclick="saveGCfg()">Save</button></div>
   <p class="muted-note">Add your app’s address as an “authorised JavaScript origin” on the Client ID — e.g. <b>http://localhost:8000</b> for local, or your GitHub Pages URL. Everything else in the app works without Drive.</p>`; }
 else if(!st.connected){ body=`<div class="sync-hero"><div class="ok" style="background:var(--surface-2);color:var(--muted)">☁</div>
    <div class="st">Not connected</div><div class="ss">Back up to a HealthDashboard folder in your Drive</div></div>
    <div class="sync-actions"><button class="btn" onclick="Drive.connect()">Connect Google Drive</button></div>
    <p class="muted-note">Uses the narrow <b>drive.file</b> scope — the app can only see the files &amp; folder it creates, nothing else in your Drive.</p>`; }
 else { body=`<div class="sync-hero"><div class="ok">✓</div><div class="st">${st.last?('Backed up to '+st.folderName):'Connected'}</div>
    <div class="ss">${st.last?('Last synced '+st.last):'Tap Sync now to create your backup'}</div></div>
   <div class="section" style="margin-left:2px">Connection</div>
   <div class="synccard"><div class="kv"><span class="k">Backup folder</span><span class="v on">${st.folderName} (auto)</span></div>
     <div class="kv"><span class="k">Scope</span><span class="v">This app's files only</span></div></div>
   <div class="sync-actions">
     <button class="btn" id="syncNowBtn" onclick="Drive.syncNow()">⟳ Sync now</button>
     <button class="btn ghost" onclick="Drive.restore()">⭳ Restore from Drive</button>
     <button class="btn ghost" onclick="Drive.disconnect()">Disconnect account</button></div>
   <p class="muted-note">Auto-sync runs on app open when it’s been ≥24h since the last sync. A web app can’t sync while fully closed.</p>`; }
 body+=`<div class="section" style="margin-left:2px">Local backup file</div>
   <div class="synccard" style="padding:12px 14px"><p class="muted-note" style="margin:2px 0 8px">Save all your data to a file, or load it back on another device — works offline, no Google needed. Keep this file private (don't commit it to a public repo).</p></div>
   <div class="sync-actions"><button class="btn ghost" onclick="exportBackup()">⬇ Export backup file</button>
     <button class="btn ghost" onclick="document.getElementById('jsonInput').click()">⬆ Import backup file</button></div>`;
 document.getElementById('v-sync').innerHTML=body;
 // header chip
 const dot=document.getElementById('syncDot'),txt=document.getElementById('syncTxt');
 if(!cfgOK){dot.style.background='var(--muted)';txt.textContent='Backup';}
 else if(st.connected){dot.style.background='var(--good)';txt.textContent=st.last?('Synced '+st.last):'Connected';}
 else {dot.style.background='var(--warning)';txt.textContent='Connect';}}

/* ---------- controls ---------- */
function setPerson(id){person=id;reportMode='latest';document.getElementById('mMode').textContent='All parameters · latest';
 renderToggle();populateReports();renderAll();}
function setView(v){view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.v===v));
 ['dash','trends','actions','sync'].forEach(x=>document.getElementById('v-'+x).classList.toggle('active',v===x));
 if(v==='sync')renderSync(); document.querySelector('main').scrollTop=0;}
function onReport(val){reportMode=val;const s=document.getElementById('reportSel');if(s.value!==val)s.value=val;
 document.getElementById('mMode').textContent=val==='latest'?'All parameters · latest':'Individual report';
 renderDash();setView('dash');}
function gotoTrend(sl){setView('trends');const el=document.getElementById('tc-'+sl);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}}
function renderAll(){renderDash();renderTrends();renderActions();if(view==='sync')renderSync();}

/* ---------- Upload (browse PDF → parse → confirm → save) ---------- */
function openUpload(){uploadSheet(`<div class="grab"></div><h3>Upload a report</h3>
  <p class="sub">Browse a PDF from this device. It’s read on-device — nothing is sent to a server.</p>
  <div class="drop" onclick="document.getElementById('fileInput').click()"><div class="big">📄</div><b>Tap to browse PDF</b><br><small>a lab report for ${prof().name} or ${HD.profiles.map(p=>p.name).join(' / ')}</small></div>
  <button class="btn ghost" onclick="close_('uploadBg')">Cancel</button>`);
 document.getElementById('uploadBg').classList.add('open');}
function uploadSheet(html){document.getElementById('uploadSheet').innerHTML=html;}
function close_(id){document.getElementById(id).classList.remove('open');}

document.getElementById('fileInput').addEventListener('change',async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 uploadSheet(`<div class="grab"></div><h3>Reading report…</h3><p class="sub"><span class="spin"></span>Extracting values from ${f.name}</p>`);
 try{ const text=await pdfText(f); const parsed=parseReport(text,f.name); showConfirm(parsed,f.name); }
 catch(err){ uploadSheet(`<div class="grab"></div><h3>Couldn’t read that file</h3><p class="err">${err.message||err}</p><button class="btn ghost" onclick="close_('uploadBg')">Close</button>`); }
});
function exportBackup(){ const blob=new Blob([JSON.stringify(HD)],{type:'application/json'});
 const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='healthdashboard-backup.json';
 document.body.appendChild(a); a.click(); a.remove(); toast('Backup file downloaded'); }
document.getElementById('jsonInput').addEventListener('change',async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f)return;
 try{ const d=JSON.parse(await f.text()); if(!d||!d.profiles||!d.dates) throw new Error('Not a HealthDashboard backup');
   HD=d; persist(); person=HD.profiles[0].id; reportMode='latest';
   renderToggle(); populateReports(); renderAll(); setView('dash'); toast('Backup imported'); }
 catch(err){ alert('Import failed: '+(err.message||err)); } });
async function pdfText(file){ if(!window.pdfjsLib) throw new Error('PDF engine not loaded (needs internet the first time).');
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const buf=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:buf}).promise;let out='';
 for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();
  // group items into lines by y
  const lines={};tc.items.forEach(it=>{const y=Math.round(it.transform[5]);(lines[y]=lines[y]||[]).push(it.str);});
  Object.keys(lines).sort((a,b)=>b-a).forEach(y=>out+=lines[y].join(' ')+'\n');}
 return out;}

const VALID_UNIT=/^(mg|mg\/dl|g\/dl|gm\/dl|%|µiu|uiu|miu|iu\/l|u\/l|ng\/ml|pg\/ml|fl|pg|million|millions|lakh|lakhs|cells|10\^\d)/i;
function findValue(line){const re=/([-+]?\d+(?:\.\d+)?)\s*([A-Za-zµ%/][\w%µ/^.\-]*)/g;let m;
 while((m=re.exec(line))){ if(VALID_UNIT.test(m[2])){const ref=line.slice(re.lastIndex).match(/([<>]?\s*\d[\d.]*\s*[-–]?\s*\d*\.?\d*)/);return {v:parseFloat(m[1]),u:m[2],ref:ref?ref[1].trim():''};}}
 return null;}
function parseAarthi(text,fname){
 const low=(text+' '+fname).toLowerCase();
 const personId= low.includes('baskari')?'baskari':(low.includes('rajkumar')||low.includes('raj kumar'))?'rajkumar':person;
 let iso=null; const m=text.match(/Date of test\s*:?\s*(\d{2})-(\d{2})-(\d{4})/i); if(m) iso=`${m[3]}-${m[2]}-${m[1]}`;
 if(!iso){const d=fname.match(/(\d{4})(\d{2})(\d{2})/); if(d) iso=`${d[1]}-${d[2]}-${d[3]}`;}
 const params={}, U={'mu/l':'µIU/mL','uiu/ml':'µIU/mL','millon':'10^6/µL','million':'10^6/µL','cells':'10^3/µL','lakhs':'10^3/µL'};
 const re=/([A-Z][A-Z0-9()/.,%\- ]{2,}?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s+([A-Za-zµ%/]+|-)/g; let mm;
 while((mm=re.exec(text))){ const c=classifyAarthi(mm[1].trim()); if(!c||params[c.canon])continue;
   let v=parseFloat(mm[2]); const u=mm[5];
   if(c.canon==='Platelet Count'&&(/lakh/i.test(u)||v<20)) v=Math.round(v*1000)/10;
   if(c.canon==='WBC Count'&&v>200) v=Math.round(v/10)/100;
   let unit=U[u.toLowerCase()]||u; if(['LDL/HDL Ratio','TG/HDL Ratio','HOMA-IR'].includes(c.canon))unit='ratio';
   params[c.canon]={value:v,unit_raw:unit,ref:`${mm[3]}-${mm[4]}`,section:c.sec,key:c.key}; }
 return {personId,iso,lab:'Iswaryam (Aarthi)',params};
}
function parseReport(text,fname){
 if(/SMART REPORT|RESULTS AT A GLANCE/i.test(text)) return parseAarthi(text,fname);
 const low=(text+' '+fname).toLowerCase();
 const personId= low.includes('baskari')?'baskari': (low.includes('rajkumar')||low.includes('raj kumar'))?'rajkumar':person;
 // date: prefer collection date; else any dd/mm/yyyy or dd-Mon-yyyy
 let iso=null;const mdmy=text.match(/(?:Coll|Collected|Drawn)[^0-9]{0,20}(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i)||text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
 if(mdmy){iso=`${mdmy[3]}-${mdmy[2]}-${mdmy[1]}`;}
 const dmon=fname.match(/(\d{1,2})[ \-]?([A-Za-z]{3})[ \-]?(\d{4})/);
 if(!iso&&dmon){const mm=('0'+(MON.indexOf(dmon[2][0].toUpperCase()+dmon[2].slice(1,3).toLowerCase())+1)).slice(-2);iso=`${dmon[3]}-${mm}-${('0'+dmon[1]).slice(-2)}`;}
 const lab= low.includes('lucid')?'Lucid': low.includes('iswaryam')?'Iswaryam':'PharmEasy';
 const lines=text.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
 const params={};
 for(const name of ORDER){const d=DICT[name];
  if(d.special==='hba1c'){for(const l of lines){if(l.includes('%')&&/hba1c|glycosylated/i.test(l)&&!/mmol/i.test(l)){const m=l.match(/(\d+(?:\.\d+)?)\s*%/);if(m&&+m[1]>=3&&+m[1]<=15){params[name]={value:+m[1],unit_raw:'%',ref:'',line:l};break;}}}continue;}
  if(d.special==='vitd'){for(const l of lines){if(/vitamin d|25\s*\(?\s*oh/i.test(l)){const m=l.match(/(\d+(?:\.\d+)?)\s*ng\/ml/i);if(m){params[name]={value:+m[1],unit_raw:'ng/mL',ref:'',line:l};break;}}}continue;}
  if(d.special==='vitb12'){for(const l of lines){if(/vitamin b\s*-?\s*12|cyanocobalamin/i.test(l)){const m=l.match(/(\d+(?:\.\d+)?)\s*pg\/ml/i);if(m){params[name]={value:+m[1],unit_raw:'pg/mL',ref:'',line:l};break;}}}continue;}
  for(const l of lines){ if(!d.pats.some(p=>new RegExp('^\\*?\\s*'+p,'i').test(l)))continue;
   if(d.skip&&d.skip.test(l))continue; const got=findValue(l);if(!got||got.v<=0)continue;
   let v=got.v; if(d.conv==='plt'){v=(/lakh/i.test(got.u)||v<20)?Math.round(v*100*10)/10:(v>5000?Math.round(v/1000*10)/10:v);}
   if(d.conv==='wbc'&&v>200)v=Math.round(v/10)/100;
   params[name]={value:v,unit_raw:got.u,ref:got.ref,line:l};break;}
 }
 return {personId,iso,lab,params};
}
function showConfirm(P,fname){const p=prof(P.personId);const names=Object.keys(P.params);
 if(!p||!P.iso||!names.length){uploadSheet(`<div class="grab"></div><h3>Couldn’t auto-read this report</h3>
   <p class="sub">Detected person: ${P.personId||'?'}, date: ${P.iso||'?'}, values: ${names.length}. You can still add it manually later.</p>
   <button class="btn ghost" onclick="close_('uploadBg')">Close</button>`);return;}
 const existing=new Set(Object.keys(p.params));
 const rows=names.map(n=>{const isNew=!existing.has(n);return `<div class="pr"><span class="k">${n}${isNew?' <span class="nv">NEW</span>':''}</span><span><b>${P.params[n].value} ${DICT[n]?DICT[n].unit:P.params[n].unit_raw}</b></span></div>`;}).join('');
 window.__pending={P,fname};
 uploadSheet(`<div class="grab"></div><h3>Confirm &amp; save</h3>
  <p class="sub" style="font-weight:600;color:var(--ink-2)">✓ ${p.name} · ${lbl(P.iso)} · ${P.lab} — ${names.length} values</p>
  <div class="preview">${rows}</div>
  <button class="btn" onclick="commitUpload()">Save to ${p.name}</button>
  <button class="btn ghost row2" onclick="close_('uploadBg')">Cancel</button>
  <p class="muted-note">Existing dates aren’t overwritten and re-uploading the same report won’t duplicate rows. New parameters are added automatically.</p>`);}
function commitUpload(){ saveReport(window.__pending.P); }
function saveReport(P){
 const p=prof(P.personId);
 const oldDates=HD.dates.slice();
 if(!oldDates.includes(P.iso)) HD.dates=oldDates.concat([P.iso]).sort();
 HD.labels=HD.dates.map(lbl);
 const map={}; oldDates.forEach((d,i)=>map[d]=i);          // date -> old index
 HD.profiles.forEach(pr=>{                                 // realign arrays to new date list
   pr.labs = HD.dates.map(d=> (d in map)&&pr.labs ? (pr.labs[map[d]]||'') : '');
   Object.values(pr.params).forEach(par=>{
     const ov=par.values, orf=par.refs||[];
     par.values = HD.dates.map(d=> (d in map) ? (ov[map[d]]!=null?ov[map[d]]:null) : null);
     par.refs   = HD.dates.map(d=> (d in map) ? (orf[map[d]]||'') : '');
   });
 });
 const idx=HD.dates.indexOf(P.iso);
 p.labs[idx]=P.lab;
 Object.entries(P.params).forEach(([name,info])=>{
   let par=p.params[name];
   if(!par){ const th=TH(name,p.sex)||thFromRef(info.ref); const d=DICT[name]||{};
     par={section:info.section||d.sec||'Vitamins & Minerals',unit:d.unit||info.unit_raw||'',
          values:HD.dates.map(()=>null),refs:HD.dates.map(()=>''),th,target:targetStr(th),
          key:(info.key!=null?info.key:KEY.has(name))};
     p.params[name]=par; }
   par.values[idx]=info.value; par.refs[idx]=info.ref||'';
 });
 persist(); close_('uploadBg');
 reportMode='latest'; document.getElementById('mMode').textContent='All parameters · latest';
 renderToggle(); populateReports(); renderAll(); setView('dash');
 toast(`Saved ${p.name}'s ${lbl(P.iso)} report`);
}
function toast(msg){const t=document.createElement('div');t.textContent=msg;
 t.style.cssText='position:fixed;left:50%;bottom:86px;transform:translateX(-50%);background:var(--series);color:#fff;padding:10px 16px;border-radius:20px;font:600 13px var(--font);z-index:99;box-shadow:0 6px 20px rgba(0,0,0,.4)';
 document.body.appendChild(t);setTimeout(()=>t.remove(),2600);}

/* ---------- Google Drive (client-side, drive.file). Loads Google libs on demand. ---------- */
// Client-side Drive backup using drive.file scope. No Picker: the app creates & uses
// its own "HealthDashboard" folder (drive.file can always access files/folders it made).
const Drive={ state:{connected:false,email:'',folderId:'',folderName:'HealthDashboard',last:''}, token:null, _libs:false,
 async _load(){ if(this._libs)return; await loadScript('https://accounts.google.com/gsi/client');
   await loadScript('https://apis.google.com/js/api.js'); await new Promise(r=>gapi.load('client',r));
   await gapi.client.init({}); await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'); this._libs=true; },
 async connect(){ if(!CFG.GOOGLE_CLIENT_ID){alert('Add your Google Client ID first (Sync tab form).');return;}
   try{ await this._load();
     const tc=google.accounts.oauth2.initTokenClient({client_id:CFG.GOOGLE_CLIENT_ID,scope:'https://www.googleapis.com/auth/drive.file',
       callback:async (resp)=>{ if(resp&&resp.error){alert('Google sign-in error: '+resp.error);return;}
         this.token=resp.access_token; gapi.client.setToken({access_token:resp.access_token});
         this.state.connected=true; this._loadRestore(); renderSync();
         try{ await this.ensureFolder(); }catch(e){} renderSync(); }});
     tc.requestAccessToken({prompt:'consent'});
   }catch(e){alert('Google connect failed: '+e);} },
 async ensureFolder(){ if(this.state.folderId) return this.state.folderId;
   const r=await gapi.client.drive.files.list({q:"mimeType='application/vnd.google-apps.folder' and name='HealthDashboard' and trashed=false",fields:'files(id,name)'});
   if(r.result.files && r.result.files.length){ this.state.folderId=r.result.files[0].id; }
   else { const c=await gapi.client.drive.files.create({resource:{name:'HealthDashboard',mimeType:'application/vnd.google-apps.folder'},fields:'id'}); this.state.folderId=c.result.id; }
   localStorage.setItem('hd_folder',this.state.folderId); return this.state.folderId; },
 async _file(){ const q=`name='healthdashboard-data.json' and '${this.state.folderId}' in parents and trashed=false`;
   const r=await gapi.client.drive.files.list({q,fields:'files(id,name)'}); return (r.result.files||[])[0]||null; },
 async syncNow(){ const btn=document.getElementById('syncNowBtn'); if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>Syncing…';}
   try{ await this.ensureFolder(); const body=JSON.stringify(HD); const existing=await this._file();
     const meta={name:'healthdashboard-data.json',mimeType:'application/json'}; if(!existing)meta.parents=[this.state.folderId];
     const boundary='hdb'+Math.floor(performance.now());
     const multipart=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
     const path='https://www.googleapis.com/upload/drive/v3/files'+(existing?('/'+existing.id):'')+'?uploadType=multipart';
     await gapi.client.request({path,method:existing?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:multipart});
     this.state.last='just now'; localStorage.setItem('hd_lastsync', Date.now()); toast('Backed up to Drive');
   }catch(e){alert('Sync failed: '+(e.result&&e.result.error?e.result.error.message:(e.message||e)));}
   finally{ renderSync(); } },
 async restore(){ try{ await this.ensureFolder(); const f=await this._file(); if(!f){alert('No backup in Drive yet — tap Sync now first.');return;}
     const r=await gapi.client.drive.files.get({fileId:f.id,alt:'media'}); const data=JSON.parse(r.body);
     if(confirm('Replace this device’s data with the Drive backup?')){ HD=data; persist(); person=HD.profiles[0].id; renderToggle();populateReports();renderAll(); toast('Restored from Drive'); } }
   catch(e){alert('Restore failed: '+(e.message||e));} },
 disconnect(){ if(this.token&&window.google)google.accounts.oauth2.revoke(this.token,()=>{}); this.token=null; this.state=Object.assign(this.state,{connected:false,email:''}); renderSync(); },
 _loadRestore(){ const fid=localStorage.getItem('hd_folder'); if(fid)this.state.folderId=fid;
   const t=localStorage.getItem('hd_lastsync'); if(t){const h=(Date.now()-+t)/36e5; this.state.last=h<1?'under an hour ago':Math.round(h)+'h ago';} },
 autoSync(){ if(!CFG.GOOGLE_CLIENT_ID)return; const t=+localStorage.getItem('hd_lastsync')||0; if(Date.now()-t>=864e5 && this.state.connected){ this.syncNow(); } },
};
function saveGCfg(){
 const g={GOOGLE_CLIENT_ID:(document.getElementById('gcId').value||'').trim(),
          GOOGLE_API_KEY:((document.getElementById('gcKey')||{}).value||'').trim()};
 if(!g.GOOGLE_CLIENT_ID){alert('Please paste your Google Client ID.');return;}
 localStorage.setItem('hd_gcfg',JSON.stringify(g)); CFG=Object.assign({},CFG,g);
 renderSync(); toast('Drive keys saved — tap Connect');
}
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();
 const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('load '+src));document.head.appendChild(s);});}

/* ---------- boot ---------- */
HD=load(); person=HD.profiles[0].id;
renderToggle(); populateReports(); renderAll();
if(CFG.GOOGLE_CLIENT_ID){ Drive._loadRestore(); }
