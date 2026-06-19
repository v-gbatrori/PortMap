/* PortMap Offline v1.0 — Clean rebuild from v0.3.9 base
   All duplicate function definitions removed.
   Topology: single normalized renderer from Port Map data.
   Click on topology device → glowing line + port details panel.
   Export/Import: single normalizeProject, single saveLocal, STORAGE_KEY consistent.
   No fake WAN/ISP/router nodes ever generated.
*/

// ── Category styles ────────────────────────────────────────────────────────
const catStyle = {
  Dante:    {cls:'Dante',    key:'dante',    label:'Dante',        color:'#ff8a24'},
  Video:    {cls:'Video',    key:'video',    label:'Video',        color:'#3c8dff'},
  MTR:      {cls:'MTR',      key:'mtr',      label:'MTR/Teams',    color:'#ad64ff'},
  IoT:      {cls:'IoT',      key:'iot',      label:'IoT',          color:'#46c667'},
  AP:       {cls:'AP',       key:'ap',       label:'AP',           color:'#3bd5d8'},
  Trunk:    {cls:'Trunk',    key:'trunk',    label:'Trunk/Uplink', color:'#f14fa6'},
  Critical: {cls:'Critical', key:'critical', label:'Critical',     color:'#ff4c55'},
  Spare:    {cls:'Spare',    key:'spare',    label:'Spare/Unused', color:'#7d858f'}
};
const STORAGE_KEY = 'portmap-project-v1';

let activeSwitchFilter = 'all';
let selected = null;
let editingSwitchId = null;
let dragState = null;
let topologyZoom = 1;
let highlightedPortId = null; // for topology glow click

// ── Base / seed data ───────────────────────────────────────────────────────
const baseProject = {
  name:'NETGEAR AV Network Template', selected:null,
  switches:[
    {
      id:'core-a',
      name:'NETGEAR M4500 CORE XSM4556',
      model:'M4500-48XF8C (XSM4556) · 48x10/25G SFP28 + 8x100G QSFP28',
      role:'Core',
      ip:'192.168.100.1',
      uptime:'demo',
      ports:56,
      rows:2,
      sfpPorts:56,
      location:'Core / Spine Rack',
      x:50,
      y:35
    },
    {
      id:'av-b',
      name:'NETGEAR M4350 AV DISTRIBUTION MSM4332',
      model:'M4350-24M4X4V (MSM4332) · 2.5G PoE++ + 10G/25G uplinks',
      role:'AV',
      ip:'192.168.100.20',
      uptime:'demo',
      ports:32,
      rows:2,
      sfpPorts:8,
      location:'AV / Production Rack',
      x:30,
      y:60
    },
    {
      id:'edge-c',
      name:'NETGEAR M4250 ACCESS GSM4230PX',
      model:'M4250-26G4XF-PoE+ (GSM4230PX) · 24x1G PoE+ + 4xSFP+',
      role:'Edge',
      ip:'192.168.100.30',
      uptime:'demo',
      ports:30,
      rows:2,
      sfpPorts:4,
      location:'Edge / Room Rack',
      x:70,
      y:60
    }
  ],
  ports:[], topologyDevices:[]
};

function makeId(prefix='id'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;}
function metric(){return `${(Math.random()*13+1).toFixed(2)} K`;}
function emptyPort(switchId,n){
  return {switchId,port:n,status:'Available',category:'Spare',name:`Port ${n}`,vlan:'',speed:'—',poe:'Off',
    notes:'Available',profile:'Spare',tx:'0 bps',rx:'0 bps',ip:'',mac:'',patch:'',connectionType:'',
    power:'',duplex:'—',nativeVlan:'1 (Default)',critical:false,connectedTo:'',tags:[],
    connection:{type:'device',switchId:'',port:'',name:'',role:'access'}};
}
function vlanNumber(value){
  const m=String(value||'').match(/\d+/);
  return m?Number(m[0]):null;
}
function demoHostBase(switchId){
  return ({'core-a':10,'av-b':80,'edge-c':140}[switchId]||200);
}
function demoIpFor(switchId,port,vlan,category){
  if(String(category||'').toLowerCase()==='trunk') return '';
  const v=vlanNumber(vlan);
  if(!v) return '';
  return `192.168.${v}.${demoHostBase(switchId)+Number(port)}`;
}
function demoMacFor(switchId,port,category){
  if(String(category||'').toLowerCase()==='trunk') return '';
  const sw=({'core-a':'A0','av-b':'B0','edge-c':'C0'}[switchId]||'D0');
  const p=Number(port).toString(16).padStart(2,'0').toUpperCase();
  return `02:PM:${sw}:00:${p}:01`.replace('PM','50');
}
function demoPowerFor(poe,category){
  if(!poe||poe==='Off'||poe==='—') return '';
  const cat=String(category||'').toLowerCase();
  if(cat==='ap') return poe.includes('++')?'18.6 W':'11.8 W';
  if(cat==='dante') return '7.4 W';
  if(cat==='video') return '8.9 W';
  if(cat==='mtr') return '6.5 W';
  if(cat==='iot') return '3.2 W';
  return '5.0 W';
}
function makePort(switchId,n,category,name='',vlan='',speed='1 Gbps',poe='PoE+',notes='',extra={}){
  const isTrunk=String(category||'').toLowerCase()==='trunk'||!!extra.connectedTo;
  const deviceName=name||`Port ${n}`;
  return {switchId,port:n,status:extra.status||'In Use',category,name:deviceName,vlan,speed,poe,notes,
    profile:extra.profile||category,tx:extra.tx||metric(),rx:extra.rx||metric(),
    ip:extra.ip!==undefined?extra.ip:demoIpFor(switchId,n,vlan,category),
    mac:extra.mac!==undefined?extra.mac:demoMacFor(switchId,n,category),patch:extra.patch||'',connectionType:extra.connectionType||category,
    power:extra.power!==undefined?extra.power:demoPowerFor(poe,category),
    duplex:extra.duplex||'Full',nativeVlan:extra.nativeVlan||'1 (Default)',critical:extra.critical||false,
    connectedTo:extra.connectedTo||(!isTrunk?deviceName:''),tags:[],
    connection:extra.connectedTo
      ? {type:'switch',switchId:extra.connectedTo,port:'',name:'',role:'trunk'}
      : {type:'device',switchId:'',port:'',name:deviceName,role:'access'}
  };
}
function seedPorts(){
  const p=[];
  for(let i=1;i<=56;i++) p.push(emptyPort('core-a',i));
  [[1,'Dante','Amp - Zone A','40 (Dante)','1 Gbps','PoE+','QSC CX-Q 2K4'],[2,'Dante','DSP - Rack 1','40 (Dante)','1 Gbps','PoE+','Biamp TesiraFORTÉ'],
   [3,'Dante','Amp - Zone B','40 (Dante)','1 Gbps','PoE+','Dante audio'],[4,'Dante','Stagebox - Left','40 (Dante)','1 Gbps','PoE+','Dante stage device'],
   [5,'Video','PTZ Camera - Stage','20 (Video)','1 Gbps','PoE+','Lumens VC-TR60'],[6,'Video','Encoder - Conf Room','20 (Video)','1 Gbps','PoE+','Video over IP'],
   [7,'Video','Display - Lobby','20 (Video)','1 Gbps','PoE','Samsung QB85R'],[8,'Video','NDI Decoder','20 (Video)','1 Gbps','PoE+','NDI endpoint'],
   [9,'Video','Camera - Warehouse','20 (Video)','1 Gbps','PoE+','PTZ'],[10,'Video','Camera - Rear','20 (Video)','1 Gbps','PoE+','PTZ'],
   [11,'Video','Display - Conf Room','20 (Video)','1 Gbps','PoE','Display'],
   [12,'MTR','MTR Table Hub','30 (MTR)','1 Gbps','PoE+','Teams device'],[13,'MTR','Teams Room - Conf Room 1','30 (MTR)','1 Gbps','PoE+','HP Poly Studio X52'],
   [14,'MTR','Teams Room - Conf Room 2','30 (MTR)','1 Gbps','PoE+','MTR device'],[15,'MTR','Room Scheduler A','30 (MTR)','1 Gbps','PoE','Room panel'],
   [16,'MTR','Room Scheduler B','30 (MTR)','1 Gbps','PoE','Room panel'],[17,'Video','PTZ Camera - Balcony','20 (Video)','1 Gbps','PoE+','Camera'],
   [33,'AP','NETGEAR WBE758 AP - Lobby','60 (WiFi)','2.5 Gbps','PoE++','Ceiling Mount'],[35,'AP','NETGEAR WBE718 AP - Warehouse','60 (WiFi)','2.5 Gbps','PoE++','Ceiling Mount'],
   [36,'AP','NETGEAR WBE718 AP - Garden','60 (WiFi)','2.5 Gbps','PoE++','Outdoor AP'],
   [37,'MTR','Control Touch Panel','50 (IoT)','100 Mbps','PoE','TSW-1070'],[38,'MTR','MTR Touch Console','30 (MTR)','1 Gbps','PoE','MTR console'],
   [39,'MTR','MTR Front Display Ctrl','30 (MTR)','1 Gbps','PoE','Control endpoint'],
   [47,'Trunk','Uplink to M4350 AV Distribution','Trunk','25 Gbps','—','SFP28 DAC 1m',{connectedTo:'av-b'}],
   [48,'Trunk','Uplink to M4250 Access','Trunk','10 Gbps','—','SFP+ DAC 2m',{connectedTo:'edge-c'}]
  ].forEach(r=>Object.assign(p.find(x=>x.switchId==='core-a'&&x.port===r[0]),makePort('core-a',r[0],r[1],r[2],r[3],r[4],r[5],r[6],{...(r[7]||{}),patch:`A-${r[0]}`})));
  Object.assign(p.find(x=>x.switchId==='core-a'&&x.port===13),{ip:'192.168.30.21',mac:'02:50:A0:00:0D:01',power:'7.8 W',profile:'Teams-Room',connectionType:'Teams Room (MTR)',critical:true,patch:'A-13'});
  for(let i=1;i<=32;i++) p.push(emptyPort('av-b',i));
  [[1,'Dante','DSP - Stage Rack','40 (Dante)','1 Gbps','PoE+','Audio DSP'],[2,'Dante','Amp - Hall','40 (Dante)','1 Gbps','PoE+','Amplifier'],
   [3,'Dante','Amp - Zone 1','40 (Dante)','1 Gbps','PoE+','QSC CX-Q 2K4'],[4,'Dante','Dante AVIO','40 (Dante)','1 Gbps','PoE','AVIO adapter'],
   [5,'Video','PTZ Camera - Room A','20 (Video)','1 Gbps','PoE+','Camera'],[6,'Video','Video Encoder - Room A','20 (Video)','1 Gbps','PoE+','Encoder'],
   [7,'Video','NDI Decoder - Stage','20 (Video)','1 Gbps','PoE+','Decoder'],[8,'Video','Display - Room 1','20 (Video)','1 Gbps','PoE','Display'],
   [9,'MTR','Display - Conf Room 1','30 (MTR)','1 Gbps','PoE','Samsung QB85R'],[10,'MTR','MTR Camera','30 (MTR)','1 Gbps','PoE+','Poly camera'],
   [11,'MTR','Teams Tablet','30 (MTR)','1 Gbps','PoE','Tablet'],[12,'MTR','Room Sensor','30 (MTR)','100 Mbps','PoE','Presence sensor'],
   [13,'MTR','Conf Room Aux','30 (MTR)','1 Gbps','PoE','Aux'],
   [15,'IoT','Lighting Controller','50 (IoT)','100 Mbps','PoE','Crestron'],[16,'IoT','Blind Controller','50 (IoT)','100 Mbps','PoE','Building control'],
   [17,'IoT','Door Controller','50 (IoT)','100 Mbps','PoE','Access control'],[18,'IoT','Environmental Sensor','50 (IoT)','100 Mbps','PoE','Sensor'],
   [31,'Trunk','Uplink to Core M4500','Trunk','25 Gbps','—','SFP28 uplink',{connectedTo:'core-a'}]
  ].forEach(r=>Object.assign(p.find(x=>x.switchId==='av-b'&&x.port===r[0]),makePort('av-b',r[0],r[1],r[2],r[3],r[4],r[5],r[6],{...(r[7]||{}),patch:`B-${r[0]}`})));
  for(let i=1;i<=30;i++) p.push(emptyPort('edge-c',i));
  [[1,'Video','Camera - Entry','20 (Video)','1 Gbps','PoE+','Door camera'],[2,'Video','Camera - Rack','20 (Video)','1 Gbps','PoE+','Rack camera'],
   [3,'AP','NETGEAR WBE718 AP - Office','60 (WiFi)','2.5 Gbps','PoE++','AP'],[4,'AP','NETGEAR WBE718 AP - Lab','60 (WiFi)','2.5 Gbps','PoE++','AP'],
   [5,'AP','NETGEAR WBE718 AP - Store','60 (WiFi)','2.5 Gbps','PoE++','AP'],
   [6,'Video','Mini PC - Signage','20 (Video)','1 Gbps','PoE','Digital signage'],[7,'Video','Display - Lobby 2','20 (Video)','1 Gbps','PoE','Display'],
   [9,'AP','Access Point Spare','60 (WiFi)','1 Gbps','PoE+','Spare AP'],[10,'AP','AP - Conference','60 (WiFi)','2.5 Gbps','PoE++','Conference AP'],
   [11,'AP','Outdoor AP','60 (WiFi)','2.5 Gbps','PoE++','Outdoor'],
   [28,'Trunk','Uplink to Core M4500','Trunk','10 Gbps','—','SFP+ uplink',{connectedTo:'core-a'}]
  ].forEach(r=>Object.assign(p.find(x=>x.switchId==='edge-c'&&x.port===r[0]),makePort('edge-c',r[0],r[1],r[2],r[3],r[4],r[5],r[6],{...(r[7]||{}),patch:`C-${r[0]}`})));
  return p;
}
function createBaseProject(){return {...JSON.parse(JSON.stringify(baseProject)),ports:seedPorts(),topologyDevices:[]};}
function createEmptyProject(){return {name:'Real Network Project',selected:null,switches:[],ports:[],topologyDevices:[]};}

// ── Tag system ────────────────────────────────────────────────────────────
function parseTags(value){
  if(Array.isArray(value)) return [...new Set(value.map(v=>String(v||'').trim().toLowerCase()).filter(Boolean))];
  return [...new Set(String(value||'').split(/[;,\n]/).flatMap(x=>x.split(/\s+/)).map(v=>v.trim().toLowerCase()).filter(Boolean))];
}
function humanTag(tag){
  const map={dante:'Dante',audio:'Audio',video:'Video',mtr:'MTR',teams:'Teams',iot:'IoT',control:'Control',ap:'AP',wifi:'Wi-Fi',trunk:'Trunk',uplink:'Uplink',critical:'Critical',spare:'Spare',available:'Available',disabled:'Disabled'};
  return map[tag]||String(tag).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

const EDIT_TAG_LIBRARY={
  General:['av','network','ip','management','linked','monitoring','production','broadcast','studio','rack','rack-a','rack-b','room','control','poe','poe+','poe++','1gbps','2.5gbps','10gbps','25gbps','fiber','copper','sfp','sfp+','sfp28','vlan:10','vlan:20','vlan:40','vlan:50','vlan:60','vlan:70','vlan:110','vlan:121'],
  Dante:['dante','audio','av','aes67','avb','milan','ptp','clocking','dsp','amp','mixer','stagebox','audio-console','dante-primary','dante-secondary','vlan:40'],
  Video:['video','ndi','ndi-hx','st2110','st-2110','rtsp','sdi','hdmi','ptz','camera','encoder','decoder','display','multiview','monitor-wall','production','vlan:20'],
  MTR:['mtr','teams','room','meeting-room','console','scheduler','touch-panel','hdmi-ingest','camera','display','room-control','vlan:110'],
  IoT:['iot','control','crestron','lighting','sensor','door','blind','bms','automation','relay','environment','vlan:50'],
  AP:['ap','wifi','wi-fi','wireless','ssid','wbe','u7','mobile','gig-wireless-control','gps','ptp','clocking','vlan:60','vlan:70','vlan:121'],
  Trunk:['trunk','uplink','lacp','linked','core-link','backbone','fiber','sfp','sfp+','sfp28','10gbps','25gbps'],
  Critical:['critical','priority','core','redundant','backup','monitoring','ups','clocking','ptp'],
  Spare:['spare','available','disabled','reserve','unused']
};
function allExistingProjectTags(){
  const out=new Set();
  (project?.ports||[]).forEach(p=>parseTags(p.tags).forEach(t=>out.add(t)));
  (project?.topologyDevices||[]).forEach(d=>parseTags(d.tags).forEach(t=>out.add(t)));
  (project?.switches||[]).forEach(sw=>parseTags(sw.tags).forEach(t=>out.add(t)));
  return [...out];
}
function vlanSortKey(v){
  const n=vlanNumber(v);
  return Number.isFinite(n)?n:999999;
}
function collectExistingProjectVlans(category=''){
  const seen=new Map();
  const cat=String(category||'').trim().toLowerCase();
  const add=(value,sourceCategory='')=>{
    const raw=String(value||'').trim();
    if(!raw)return;
    const key=raw.toLowerCase();
    if(!seen.has(key)) seen.set(key,{value:raw,category:String(sourceCategory||'').trim().toLowerCase()});
  };
  (project?.ports||[]).forEach(p=>{
    add(p.vlan,p.category);
    parseTags(p.tags).forEach(t=>{
      const m=String(t||'').match(/^vlan[:\-]?(\d+)$/i);
      if(m) add(m[1],p.category);
    });
  });
  const arr=[...seen.values()];
  arr.sort((a,b)=>{
    const ac=cat&&a.category===cat?0:1,bc=cat&&b.category===cat?0:1;
    if(ac!==bc)return ac-bc;
    const an=vlanSortKey(a.value),bn=vlanSortKey(b.value);
    if(an!==bn)return an-bn;
    return a.value.localeCompare(b.value);
  });
  return arr.map(x=>x.value);
}
function refreshVlanSuggestions(){
  const form=document.getElementById('editForm');
  const list=document.getElementById('editVlanSuggestions');
  if(!form||!list)return;
  const current=String(form.elements.vlan?.value||selected?.vlan||'').trim();
  const cat=form.elements.category?.value||selected?.category||'';
  const vlans=collectExistingProjectVlans(cat);
  if(current && !vlans.some(v=>v.toLowerCase()===current.toLowerCase())) vlans.unshift(current);
  list.innerHTML=vlans.map(v=>`<option value="${escapeHtml(v)}"></option>`).join('');
}
function editTagSuggestionsForCurrentForm(){
  const form=document.getElementById('editForm');
  const cat=form?.elements?.category?.value||selected?.category||'Spare';
  const p={...(selected||{})};
  if(form){
    ['status','name','category','protocol','vlan','poe','speed','ip','mac','profile','patch','notes','connectionType','connectedTo'].forEach(k=>{if(form.elements[k])p[k]=form.elements[k].value;});
    p.critical=!!form.elements.critical?.checked;
  }
  const ordered=[...(EDIT_TAG_LIBRARY.General||[]),...(EDIT_TAG_LIBRARY[cat]||[]),...inferPortTags(p),...allExistingProjectTags()];
  return [...new Set(ordered.map(t=>String(t||'').trim().toLowerCase()).filter(Boolean))];
}
function editTagInput(){return document.getElementById('editForm')?.elements?.tags||null;}
function setEditTagList(tags){
  const input=editTagInput(); if(!input)return;
  input.value=[...new Set(tags.map(t=>String(t||'').trim().toLowerCase()).filter(Boolean))].join(', ');
  renderEditTagSuggestions();
}
function toggleEditTag(tag){
  const input=editTagInput(); if(!input||!tag)return;
  const tags=parseTags(input.value);
  const idx=tags.indexOf(tag);
  if(idx>=0) tags.splice(idx,1); else tags.push(tag);
  setEditTagList(tags);
}
function renderEditTagSuggestions(){
  const box=document.getElementById('editTagSuggestions');
  const input=editTagInput();
  if(!box||!input)return;
  const current=parseTags(input.value);
  const suggestions=editTagSuggestionsForCurrentForm();
  box.innerHTML=suggestions.map(tag=>`<button type="button" class="tag-suggestion${current.includes(tag)?' active':''}" data-tag="${escapeHtml(tag)}">${escapeHtml(humanTag(tag))}</button>`).join('');
  box.querySelectorAll('[data-tag]').forEach(btn=>btn.addEventListener('click',()=>toggleEditTag(btn.getAttribute('data-tag'))));
}
function installEditTagSuggestions(){
  const form=document.getElementById('editForm');
  if(!form || form.dataset.tagSuggestBound==='1') return;
  form.dataset.tagSuggestBound='1';
  ['category','protocol','vlan','speed','poe','name','profile','notes','connectionType','connectedTo'].forEach(k=>{
    const el=form.elements[k];
    if(el) el.addEventListener('input',()=>{renderEditTagSuggestions();refreshVlanSuggestions();});
    if(el) el.addEventListener('change',()=>{renderEditTagSuggestions();refreshVlanSuggestions();});
  });
  form.elements.tags?.addEventListener('input',renderEditTagSuggestions);
}

function rawSwitchTargetForPort(p){
  const conn=p?.connection||{};
  const rawTarget=conn.switchId||conn.targetSwitchId||p?.targetSwitchId||p?.connectedSwitchId||p?.connectedTo||'';
  return findSwitchRef(rawTarget);
}
function isRealSwitchLinkRaw(p){
  const conn=p?.connection||{};
  const cat=String(p?.category||'').toLowerCase();
  const vlan=String(p?.vlan||'').toLowerCase();
  const text=[p?.name,p?.profile,p?.connectionType,p?.notes].join(' ').toLowerCase();
  const target=rawSwitchTargetForPort(p);
  const hasSwitchConn=(conn.type==='switch'||!!conn.switchId||!!conn.targetSwitchId) && !!target;
  const hasTrunkHint=cat.includes('trunk')||cat.includes('uplink')||vlan==='trunk'||/\b(trunk|uplink|lacp|sfp)\b/.test(text);
  return !!target && (hasSwitchConn||hasTrunkHint);
}
function inferPortTags(p){
  const tags=[]; const cat=String(p.category||'Spare').toLowerCase();
  if(cat) tags.push(cat);
  const status=String(p.status||'').toLowerCase().replace(/\s+/g,'-'); if(status) tags.push(status);
  if(p.critical) tags.push('critical');
  if(p.connectedTo) tags.push('linked');
  if(isRealSwitchLinkRaw(p)) tags.push('trunk','uplink');
  const vNo=vlanNumber(p.vlan);
  if(vNo) tags.push('vlan:'+vNo);
  if(p.speed) tags.push(String(p.speed).toLowerCase().replace(/\s+/g,''));
  if(p.poe&&p.poe!=='Off'&&p.poe!=='—') tags.push(String(p.poe).toLowerCase().replace(/\s+/g,''));
  const text=[p.name,p.profile,p.connectionType,p.notes].join(' ').toLowerCase();
  if(/dante|audio|dsp|amp|stagebox/.test(text)) tags.push('dante','audio','av');
  if(/video|camera|display|ndi|ptz|encoder|decoder/.test(text)) tags.push('video','av');
  if(/mtr|teams|room|poly|scheduler|console/.test(text)) tags.push('mtr','teams','room');
  if(/ap|wifi|wi-fi|wireless|u7/.test(text)) tags.push('ap','wifi');
  if(/iot|control|crestron|lighting|door|sensor|blind/.test(text)) tags.push('iot','control');
  if(isRealSwitchLinkRaw(p) && /trunk|uplink|lacp|sfp/.test(text)) tags.push('trunk','uplink');
  return [...new Set(tags.filter(Boolean))];
}
function ensurePortTags(p){
  const realSwitchLink=isRealSwitchLinkRaw(p);
  const manual=parseTags(p.tags).filter(t=>realSwitchLink || !['trunk','uplink','lacp'].includes(t));
  const auto=inferPortTags(p);
  p.tags=[...new Set([...manual,...auto])]; return p.tags;
}
function ensureAllTags(){
  project.ports.forEach(ensurePortTags);
  project.topologyDevices.forEach(d=>{d.tags=[...new Set([...parseTags(d.tags),String(d.category||'').toLowerCase(),'manual'].filter(Boolean))];});
}
function renderOneTagChip(tag){
  return `<span class="tag-chip">${escapeHtml(humanTag(tag))}</span>`;
}
function renderTagChips(tags,limit=5){
  const arr=parseTags(tags); if(!arr.length) return '<span class="tag-muted">—</span>';
  const shown=arr.slice(0,limit); const more=arr.length>limit?`<span class="tag-chip more">+${arr.length-limit}</span>`:'';
  return `<span class="tag-list">${shown.map(t=>renderOneTagChip(t)).join('')}${more}</span>`;
}

// ── Category helpers ──────────────────────────────────────────────────────
function categoryInfo(cat){return catStyle[cat]||catStyle.Spare;}
function primaryGraphTag(p){
  const tags=parseTags(p.tags); const cat=String(p.category||'Spare');
  if(tags.includes('critical')) return 'Critical';
  if(tags.includes('trunk')||cat==='Trunk') return 'Trunk';
  if(tags.includes('dante')||tags.includes('audio')) return 'Dante';
  if(tags.includes('video')) return 'Video';
  if(tags.includes('mtr')||tags.includes('teams')||tags.includes('room')) return 'MTR';
  if(tags.includes('ap')||tags.includes('wifi')) return 'AP';
  if(tags.includes('iot')||tags.includes('control')) return 'IoT';
  return catStyle[cat]?cat:'Spare';
}
function categoryToIcon(cat){return ({Dante:'DSP',Video:'Display',MTR:'MTR',IoT:'Server',AP:'AP',Trunk:'RJ45',Critical:'RJ45',Spare:'RJ45'}[cat]||'RJ45');}
function cssCat(cat){return ({Dante:'orange',Video:'blue',MTR:'purple',IoT:'green',AP:'cyan',Trunk:'magenta',Critical:'red',Spare:'gray'}[cat]||'gray');}

// ── Connection model ──────────────────────────────────────────────────────
function findSwitchRef(ref){
  if(!ref) return null; const v=String(ref).trim().toLowerCase();
  const source=globalThis.__normalizingProject||globalThis.__portmapProject||{switches:[]};
  return (source.switches||[]).find(s=>String(s.id||'').toLowerCase()===v||String(s.name||'').toLowerCase()===v||String(s.ip||'').toLowerCase()===v)||null;
}
function inferConnectionFromLegacy(p){
  const conn=p.connection||{};
  let legacy=typeof p.connectedTo==='string'?p.connectedTo.trim():'';
  let target=findSwitchRef(conn.switchId||legacy);
  const roleTag=primaryGraphTag(p)==='Trunk'?'trunk':(parseTags(p.tags).includes('uplink')?'uplink':'access');
  if(conn&&(conn.type||conn.switchId||conn.name||conn.port)){
    const type=conn.type||(conn.switchId?'switch':'device');
    return {type,switchId:conn.switchId||target?.id||'',port:conn.port||'',name:conn.name||legacy||'',role:conn.role||roleTag};
  }
  if(target) return {type:'switch',switchId:target.id,port:'',name:target.name,role:roleTag};
  if(legacy) return {type:'device',switchId:'',port:'',name:legacy,role:roleTag};
  return {type:'device',switchId:'',port:'',name:'',role:roleTag};
}
function normalizeConnectionModel(prj){
  (prj.ports||[]).forEach(p=>{
    ensurePortTags(p);
    p.connection=inferConnectionFromLegacy(p);
    if(p.connection.type==='switch'){
      p.connectedTo=p.connection.switchId||p.connectedTo||'';
      if(p.category==='Spare') p.category='Trunk';
      const tags=new Set(parseTags(p.tags)); tags.add('trunk'); tags.add('linked');
      if(String(p.speed||'').includes('10')) tags.add('10gbps');
      p.tags=[...tags];
    }
  });
}
function portConnectionLabel(p){
  const c=p.connection||inferConnectionFromLegacy(p);
  if(c.type==='switch'){const sw=bySwitch(c.switchId)||findSwitchRef(c.switchId);return `${sw?.name||'Switch'}${c.port?` / Port ${c.port}`:''}`;}
  return c.name||p.connectedTo||p.name||'';
}

// ── Project load/save ──────────────────────────────────────────────────────
function syncSwitchPorts(sw){
  const existing=portsFor(sw.id); const want=Number(sw.ports)||1;
  for(let i=1;i<=want;i++) if(!existing.find(p=>p.port===i)) project.ports.push(emptyPort(sw.id,i));
  project.ports=project.ports.filter(p=>p.switchId!==sw.id||p.port<=want);
}
function normalizeProject(prj){
  prj=prj||createEmptyProject();
  globalThis.__normalizingProject=prj;
  prj.name||='Real Network Project'; prj.switches||=[]; prj.ports||=[]; prj.topologyDevices||=[];
  const legacyIds=new Set(['td-dsp','td-cam','td-display','td-ap','td-touch','td-sensor']);
  prj.topologyDevices=prj.topologyDevices.filter(d=>!legacyIds.has(d.id));
  prj.switches.forEach((sw,idx)=>{
    sw.id||=makeId('sw'); sw.name||=`SWITCH ${idx+1}`; sw.ports=Number(sw.ports||24);
    sw.rows=Math.max(1,Number(sw.rows||1)); sw.sfpPorts=Number(sw.sfpPorts||0);
    sw.role||='Other'; sw.x??=30+idx*20; sw.y??=45+idx*8;
    sw.tags=[...new Set([...parseTags(sw.tags),String(sw.role||'switch').toLowerCase(),'switch'])];
  });
  prj.switches.forEach(sw=>{ // inline syncSwitchPorts without touching global project
    const want=Number(sw.ports)||1;
    for(let i=1;i<=want;i++) if(!prj.ports.find(p=>p.switchId===sw.id&&p.port===i)) prj.ports.push(emptyPort(sw.id,i));
    prj.ports=prj.ports.filter(p=>p.switchId!==sw.id||p.port<=want);
  });
  prj.ports.forEach(p=>{
    p.status||=(p.category==='Spare'?'Available':'In Use'); p.category||='Spare';
    p.name||=`Port ${p.port}`; p.tx||='0 bps'; p.rx||='0 bps'; p.poe||='Off';
    p.speed||='—'; p.profile||=p.category; p.nativeVlan||='1 (Default)'; p.protocol||=''; p.critical=!!p.critical;
    ensurePortTags(p);
    p.connection=inferConnectionFromLegacy(p);
  });
  prj.topologyDevices.forEach(d=>{
    d.id||=makeId('dev'); d.category||='Spare'; d.icon||='RJ45';
    d.x=Number(d.x||50); d.y=Number(d.y||78);
    d.tags=[...new Set([...parseTags(d.tags),String(d.category).toLowerCase(),'manual'])];
  });
  prj.selected=null;
  return prj;
}
function loadProject(){
  // Try newest key first, then fallback to old keys.
  // Do not load an accidentally saved completely blank project.
  const keys=['portmap-project-v1','portmap-project-v030-real-topology-engine','portmap-project-v027'];
  for(const k of keys){
    try{
      const raw=localStorage.getItem(k);
      if(!raw) continue;
      const candidate=normalizeProject(JSON.parse(raw));
      const hasData=(candidate.switches&&candidate.switches.length)||(candidate.ports&&candidate.ports.length)||(candidate.topologyDevices&&candidate.topologyDevices.length);
      if(hasData) return candidate;
    }catch(e){console.warn(e);}
  }
  return createBaseProject();
}
function saveLocal(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(project));}catch(e){console.warn(e);}
  const last=document.getElementById('lastSaved'); if(last) last.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

let project=loadProject();
globalThis.__portmapProject=project;

// ── Project helpers ───────────────────────────────────────────────────────
function bySwitch(id){return project.switches.find(s=>s.id===id);}
function portsFor(id){return project.ports.filter(p=>p.switchId===id).sort((a,b)=>a.port-b.port);}
function usedPorts(){return project.ports.filter(p=>p.status==='In Use'||(p.category!=='Spare'&&p.status!=='Disabled'));}
function switchRoleGroup(sw){
  const role=String(sw?.role||'').trim().toLowerCase();
  if(role.includes('core')) return 'Core';
  if(role==='av'||role.includes(' av')||role.includes('av ')) return 'AV';
  if(role.includes('edge')) return 'Edge';
  return 'Other';
}
function switchMatchesRoleFilter(sw){
  if(activeSwitchFilter==='all') return true;
  if(activeSwitchFilter==='Other') return switchRoleGroup(sw)==='Other';
  return switchRoleGroup(sw)===activeSwitchFilter || String(sw?.role||'')===activeSwitchFilter;
}
function switchSearchTerm(){return (document.getElementById('switchSearchFilter')?.value||'').toLowerCase().trim();}
function switchMatchesSearch(sw){
  const term=switchSearchTerm();
  if(!term) return true;
  const searchable=[sw?.name,sw?.model,sw?.role,sw?.ip,sw?.location,sw?.uptime].join(' ').toLowerCase();
  return searchable.includes(term);
}
function visiblePorts(){
  const showAll=document.getElementById('showAllPorts')?.checked??true;
  const term=(document.getElementById('portFilter')?.value||'').toLowerCase().trim();
  return project.ports.filter(p=>{
    const sw=bySwitch(p.switchId); if(!sw) return false;
    if(!switchMatchesRoleFilter(sw)) return false;
    if(!switchMatchesSearch(sw)) return false;
    if(!showAll&&p.status!=='In Use') return false;
    if(term){
      const searchable=[
        sw.name, sw.ip, p.port, p.status, p.name, p.category, p.connectionType,
        p.vlan, p.vlanNumber, p.ip, p.mac, p.connectedTo, p.patch, p.profile,
        p.poe, p.speed, p.notes, parseTags(p.tags).join(' ')
      ].join(' ').toLowerCase();
      if(!searchable.includes(term)) return false;
    }
    return true;
  });
}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

// ── RJ45 icon ─────────────────────────────────────────────────────────────
function rj45Icon(){return `<img class="rj45-img" src="assets/rj45_jack_only.png" alt="RJ45" loading="eager" draggable="false">`;}
function protocolPortIcon(port,size='normal'){
  const cls=size==='large'?'port-rj45-colored large':'port-rj45-colored';
  const protocol=String(port?.protocol||'').trim();
  const status=String(port?.status||'').trim().toLowerCase();
  const category=String(port?.category||'').trim().toLowerCase();
  const hasName=String(port?.name||'').trim()!=='';
  const hasConnection=String(port?.connectedTo||'').trim()!=='';
  const isUnused=status==='available'||status==='disabled'||category==='spare'||category==='spare/unused'||(!hasName && !hasConnection && !protocol);
  let color='#f3f6fb';
  if(protocol){
    const catColor=categoryInfo(port?.category).color;
    color=topologyProtocolColor(protocol,catColor);
  }else if(isUnused){
    color=status==='disabled' ? '#586270' : '#8e99a8';
  }
  return `<span class="${cls}" style="--proto-color:${escapeHtml(color)}" aria-hidden="true"></span>`;
}
function deviceIconHTML(icon){
  if(icon==='RJ45') return rj45Icon();
  const map={Camera:'◉',AP:'⌁',Display:'▣',Router:'◎',Server:'▥',DSP:'♪',MTR:'▤'};
  return map[icon]||rj45Icon();
}
function topologyIcon(icon,category=''){
  if(icon==='RJ45'||icon==='Switch') return rj45Icon();
  const map={Camera:'◉',AP:'⌁',Display:'▣',Router:'◎',Server:'▥',DSP:'♪',MTR:'▤'};
  return `<span class="topo-glyph ${category}">${map[icon]||'▣'}</span>`;
}

// ── Render switches ────────────────────────────────────────────────────────
function legendHtml(){
  const entries=[['Dante','Dante'],['Video','Video'],['MTR','MTR/Teams'],['IoT','IoT'],['AP','AP'],['Trunk','Trunk/Uplink'],['Critical','Critical'],['Spare','Spare/Unused']];
  return `<div class="legend">${entries.map(([k,l])=>`<span><i class="dot" style="background:${categoryInfo(k).color}"></i>${l}</span>`).join('')}</div>`;
}
function renderSwitches(){
    const wrap=document.getElementById('switches'); if(!wrap)return; wrap.innerHTML='';
  const switches=project.switches.filter(sw=>switchMatchesRoleFilter(sw)&&switchMatchesSearch(sw));
  for(const sw of switches){
    syncSwitchPorts(sw);
    const perRow=Math.ceil(Number(sw.ports||1)/Math.max(1,Number(sw.rows||1)));
    const minWidth=54+12+Math.max(perRow*50,520)+28;
    const card=document.createElement('section');
    card.className='switch-card'; card.style.setProperty('--per-row',perRow); card.style.minWidth=`${minWidth}px`;
    card.innerHTML=`<div class="switch-icon">${rj45Icon()}</div><div class="switch-content"><div class="switch-head"><div class="switch-title"><strong>${escapeHtml(sw.name)}</strong><small>${escapeHtml(sw.model||'Switch')}</small></div><div class="switch-meta">IP: ${escapeHtml(sw.ip||'—')} &nbsp;|&nbsp; Uptime: ${escapeHtml(sw.uptime||'—')} &nbsp;|&nbsp; ${sw.ports} Ports &nbsp;|&nbsp; ${sw.rows} Row(s)<span class="switch-tools"><button data-edit-switch="${sw.id}">⚙ Edit</button></span></div></div>${legendHtml()}<div class="ports-grid"></div></div>`;
    const grid=card.querySelector('.ports-grid');
    for(const port of portsFor(sw.id)){
      const info=categoryInfo(port.category);
      const div=document.createElement('button');
      const isSel=selected&&selected.switchId===port.switchId&&selected.port===port.port;
      div.className=`port category-${info.cls} status-${(port.status||'Available').replace(/\s/g,'')}${isSel?' selected':''}`;
      div.title=`${sw.name} Port ${port.port} - ${port.name||'Available'}`;
      div.innerHTML=`<span class="num">${port.port}</span>${protocolPortIcon(port)}`;
      div.addEventListener('click',()=>selectPort(port.switchId,port.port));
      div.addEventListener('dblclick',()=>{selectPort(port.switchId,port.port);openEditDialog();});
      grid.appendChild(div);
    }
    wrap.appendChild(card);
  }
}

// ── Port selection & details ───────────────────────────────────────────────
function selectPort(swId,portNo){
  const port=project.ports.find(p=>p.switchId===swId&&p.port===portNo); if(!port)return;
  selected=port; project.selected={switchId:swId,port:portNo};
  document.getElementById('portLayout').classList.remove('details-hidden');
  document.getElementById('detailsPanel').classList.remove('hidden');
  renderSwitches(); renderDetails(); renderTable(); renderMiniTopo(); saveLocal();
}
function closeDetails(){
  selected=null; project.selected=null;
  document.getElementById('detailsPanel').classList.add('hidden');
  document.getElementById('portLayout').classList.add('details-hidden');
  renderSwitches(); renderTable(); saveLocal();
}
function renderDetails(){
  if(!selected){closeDetails();return;}
  ensurePortTags(selected);
  const sw=bySwitch(selected.switchId),info=categoryInfo(selected.category);
  const statusBadge=selected.critical?'<span class="badge">Critical</span>':`<span class="badge" style="background:#1d2a3a;color:#bcd0e7">${escapeHtml(selected.status)}</span>`;
  document.getElementById('selectedCard').innerHTML=`<div class="selected-tile category-${info.cls}" style="color:${info.color}"><b>${selected.port}</b>${rj45Icon()}</div><div><b>${escapeHtml(selected.name||'Available')}</b><small>${escapeHtml(sw?.name||'—')} &nbsp;•&nbsp; Port ${selected.port}</small>${statusBadge}</div>`;
  const rows=[['Switch',sw?.name||'—'],['Port',selected.port],['Status',selected.status||'Available'],['Name',selected.name||'—'],
    ['Connection Type',selected.connectionType||selected.category],['Category',selected.category],['Protocol',selected.protocol||'—'],
    ['Tags',parseTags(selected.tags).join(', ')||'—'],['VLAN',selected.vlan||'—'],['PoE Mode',selected.poe],
    ['Speed',selected.speed],['IP Address',selected.ip||'—'],['MAC Address',selected.mac||'—'],
    ['Connected To',portConnectionLabel(selected)||'—'],['Link Role',selected.connection?.role||'access'],
    ['Notes',selected.notes||'—'],['Cable Label',selected.patch||'—']];
  document.getElementById('detailList').innerHTML=rows.map(([k,v])=>`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
}
function syncTableSearchMirror(){
  const main=document.getElementById('portFilter');
  const mini=document.getElementById('tableSearchInput');
  if(main&&mini&&mini.value!==main.value) mini.value=main.value;
}
function setPortListSearchActive(active){
  const list=document.getElementById('portListTabBtn');
  const search=document.getElementById('portSearchTabBtn');
  const box=document.getElementById('tableSearchMini');
  list?.classList.toggle('active',!active);
  search?.classList.toggle('active',!!active);
  box?.classList.toggle('hidden',!active);
  if(active){syncTableSearchMirror();setTimeout(()=>document.getElementById('tableSearchInput')?.focus(),0);}
}
function updatePortFilterValue(value){
  const v=String(value||'');
  const main=document.getElementById('portFilter');
  const mini=document.getElementById('tableSearchInput');
  if(main&&main.value!==v) main.value=v;
  if(mini&&mini.value!==v) mini.value=v;
  renderSwitches();
  renderTable();
}
function renderTable(){
  ensureAllTags();
  syncTableSearchMirror();
    const tbody=document.querySelector('#portTable tbody'); if(!tbody)return; tbody.innerHTML='';
  const rows=visiblePorts();
  for(const p of rows){
    const sw=bySwitch(p.switchId),info=categoryInfo(p.category);
    const tr=document.createElement('tr');
    if(selected&&selected.switchId===p.switchId&&selected.port===p.port) tr.className='selected';
    const statusClass=(p.status||'Available').toLowerCase().replace(/\s/g,'');
    tr.innerHTML=`<td><span class="check"></span></td><td><span style="color:${info.color}">■</span> ${p.port}</td><td><span class="status-pill ${statusClass}">${escapeHtml(p.status)}</span></td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(sw?.name||'—')}</td><td>${escapeHtml(p.poe)}</td><td>${escapeHtml(p.speed)}</td><td style="color:${info.color}">${escapeHtml(p.vlan||'—')}</td><td>${escapeHtml(p.ip||'—')}</td><td>${escapeHtml(p.mac||'—')}</td><td>${escapeHtml(p.profile)}</td><td>${renderTagChips(p.tags,4)}</td><td>${escapeHtml(p.tx)}</td><td>${escapeHtml(p.rx)}</td><td>${escapeHtml(p.notes)}</td>`;
    tr.addEventListener('click',()=>selectPort(p.switchId,p.port));
    tbody.appendChild(tr);
  }
  const total=project.ports.length,used=usedPorts().length,percent=total?Math.round((used/total)*100):0;
  document.getElementById('tablePortCount').textContent=`${rows.length} shown / ${total} Ports`;
  document.getElementById('deviceCount').textContent=used;
  document.getElementById('switchCount').textContent=project.switches.length;
  document.getElementById('portCount').textContent=`${used} / ${total}`;
  document.getElementById('useProgress').style.width=`${percent}%`;
  document.getElementById('usePercent').textContent=`${percent}%`;
  document.getElementById('rowSelected').textContent=selected?`Selected: ${bySwitch(selected.switchId)?.name||''} Port ${selected.port}`:'No port selected';
}
function renderDeviceList(){
  const el=document.getElementById('deviceList'); if(!el)return; el.innerHTML='';
  [...usedPorts().map(p=>({name:p.name,cat:p.category,sub:`${bySwitch(p.switchId)?.name} / Port ${p.port}`,notes:p.notes})),
   ...project.topologyDevices.map(d=>({name:d.name,cat:d.category,sub:`Topology extra / linked to ${bySwitch(d.connectedTo)?.name||d.connectedTo}`,notes:d.notes}))
  ].forEach(d=>{
    const info=categoryInfo(d.cat); const card=document.createElement('div'); card.className='device-card';
    card.innerHTML=`<b style="color:${info.color}">■ ${escapeHtml(d.name)}</b><small>${escapeHtml(d.sub)}</small><small>${escapeHtml(d.notes||'')}</small>`;
    el.appendChild(card);
  });
}

// ── Mini topology ─────────────────────────────────────────────────────────
function makeLine(parent,x1,y1,x2,y2,cls=''){
  const line=document.createElement('div'); line.className='line '+cls;
  const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy),ang=Math.atan2(dy,dx)*180/Math.PI;
  line.style.left=x1+'%'; line.style.top=y1+'%'; line.style.width=len+'%'; line.style.transform=`rotate(${ang}deg)`; parent.appendChild(line);
}
function makeNode(parent,x,y,label,icon='RJ45',cls=''){
  const node=document.createElement('div'); node.className='node '+cls; node.style.left=x+'%'; node.style.top=y+'%';
  node.innerHTML=`<div class="bubble">${deviceIconHTML(icon)}</div><span>${escapeHtml(label)}</span>`; parent.appendChild(node);
}
function renderMiniTopo(){
  const el=document.getElementById('miniTopo'); if(!el)return; el.innerHTML='';
  makeLine(el,50,24,28,55,'pink'); makeLine(el,50,24,72,55,'green');
  makeLine(el,28,55,16,80,''); makeLine(el,28,55,28,80,''); makeLine(el,28,55,40,80,'');
  makeLine(el,72,55,60,80,'green'); makeLine(el,72,55,72,80,'green'); makeLine(el,72,55,84,80,'green');
  makeNode(el,50,22,'CORE SWITCH A','RJ45'); makeNode(el,28,54,'AV SWITCH B','RJ45','pink'); makeNode(el,72,54,'EDGE SWITCH C','RJ45','green');
  makeNode(el,16,80,'DSP','DSP','gray'); makeNode(el,28,80,'Display','Display','gray'); makeNode(el,40,80,'Camera','Camera','gray');
  makeNode(el,60,80,'AP','AP','gray'); makeNode(el,72,80,'Touch Panel','MTR','gray'); makeNode(el,84,80,'Sensor','RJ45','gray');
}

// ── Topology renderer: one normalized data source only ────────────────────
const TOPOLOGY_GROUP_ORDER = ['Dante','Video','MTR','AP','IoT','Critical','Other'];
const TOPOLOGY_LABEL = {Dante:'Dante',Video:'Video',MTR:'MTR / Teams',AP:'AP',IoT:'IoT / Control',Critical:'Critical',Other:'Other',Trunk:'Trunk / Uplink',Spare:'Spare / Unused'};
const TOPOLOGY_COLOR = {Dante:'#ff8a24',Video:'#3c8dff',MTR:'#ad64ff',AP:'#3bd5d8',IoT:'#46c667',Critical:'#ff4c55',Other:'#8b949e',Trunk:'#f14fa6',Spare:'#7d858f'};
function topologyText(v){return String(v ?? '').trim();}
function topologyLow(v){return topologyText(v).toLowerCase();}
function topologyKey(v){return topologyLow(v).replace(/[^a-z0-9]+/g,'');}
function topologyEscape(v){return topologyText(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function topologyFirst(obj,names){for(const name of names){if(obj && Object.prototype.hasOwnProperty.call(obj,name) && obj[name]!==undefined && obj[name]!==null && topologyText(obj[name])!=='')return obj[name];}return '';}
function topologyFindSwitch(ref){
  if(ref && typeof ref==='object') ref=ref.switchId || ref.id || ref.name || ref.switch || ref.Switch || ref.switchName;
  const k=topologyKey(ref); if(!k) return null;
  return (project.switches||[]).find(sw=>topologyKey(sw.id)===k || topologyKey(sw.name)===k || topologyKey(sw.switchName)===k || topologyKey(sw.Switch)===k) || null;
}
function topologyNormalizeSwitch(sw,idx){return {id:topologyText(sw.id||sw.switchId||sw.switch||sw.Switch||sw.name||`switch-${idx+1}`),name:topologyText(sw.name||sw.switchName||sw.Switch||sw.switch||`SWITCH ${idx+1}`),model:topologyText(sw.model||sw.Model||'Switch'),role:topologyText(sw.role||sw.Role||''),ip:topologyText(sw.ip||sw.IP||sw.ipAddress||''),location:topologyText(sw.location||sw.Location||''),ports:sw.ports??sw.Ports??'',rows:sw.rows??sw.Rows??'',sfpPorts:sw.sfpPorts??sw.SFPPorts??sw.sfp??'',raw:sw};}
function topologyTags(raw){
  const input=Array.isArray(raw)?raw.join(' '):topologyText(raw);
  const clean=input
    .replace(/vlan\s*:\s*(\d+)\s*([a-z]+)/ig,'vlan:$1 $2')
    .replace(/(\d+)(dante|video|mtr|teams|iot|control|ap|trunk|uplink|lacp)/ig,'$1 $2')
    .replace(/[|/\\]+/g,' ');
  const out=[];
  clean.split(/[;,\n\s]+/).forEach(part=>{
    const t=topologyLow(part).trim();
    if(!t)return;
    out.push(t);
    const vlan=t.match(/^vlan:?(\d+)$/); if(vlan){out.push('vlan');out.push(vlan[1]);}
  });
  return[...new Set(out)];
}
function topologyVlanNumber(vlan,tags=[]){
  const text=topologyText(vlan);
  let m=text.match(/\d+/); if(m)return Number(m[0]);
  const joined=(tags||[]).join(' ');
  m=joined.match(/vlan:?(\d+)/i)||joined.match(/\b(20|30|40|50|60)\b/);
  return m?Number(m[1]):null;
}
function topologyInferCategory(rawCategory,vlan,tags,name,critical){
  const c=topologyLow(rawCategory),vtxt=topologyLow(vlan),n=topologyLow(name),t=(tags||[]).join(' '),vnum=topologyVlanNumber(vlan,tags);
  const explicitTrunk=c.includes('trunk')||c.includes('uplink')||vtxt==='trunk'||/\b(trunk|uplink|lacp)\b/.test(t);
  if(explicitTrunk)return'Trunk';

  // VLAN/IP is the strongest network evidence. This prevents noisy tags from putting nodes into the wrong graph cloud.
  if(vnum===40)return'Dante';
  if(vnum===20)return'Video';
  if(vnum===30)return'MTR';
  if(vnum===50)return'IoT';
  if(vnum===60)return'AP';

  if(c.includes('dante')||/\b(dante|audio)\b/.test(t)||/dante|dsp|amp|stagebox|avio/.test(n))return'Dante';
  if(c==='ap'||c.includes('access point')||c.includes('wifi')||/\b(ap|wifi|wireless)\b/.test(t)||/\bap\b|u7|wifi|access point/.test(n))return'AP';
  if(c.includes('iot')||c.includes('control')||/\b(iot|control)\b/.test(t)||/sensor|controller|lighting|door|blind|control|hvac|touch panel/.test(n))return'IoT';
  if(c.includes('mtr')||c.includes('teams')||/\b(mtr|teams)\b/.test(t)||/teams|mtr|room scheduler|touch console|tablet|room sensor/.test(n))return'MTR';
  if(c.includes('video')||/\b(video|ndi|ptz|camera|display)\b/.test(t)||/camera|ptz|display|encoder|decoder|ndi|signage/.test(n))return'Video';
  if(c.includes('critical')||(critical&&!c))return'Critical';
  if(c.includes('spare')||c.includes('available')||c.includes('unused'))return'Spare';
  return'Other';
}

function topologyInferProtocol(p){
  const explicit=topologyText(topologyFirst(p.raw||{},['protocol','Protocol','protocols','Protocols'])).trim();
  if(explicit) return explicit;
  const text=[p.name,p.vlan,p.category,p.connectedTo,(p.tags||[]).join(' '),topologyFirst(p.raw||{},['profile','Profile','connectionType','Connection Type','notes','Notes','protocol','Protocol','protocols','Protocols'])].map(topologyLow).join(' ');
  const cat=p.category;
  if(/\bst\s*2110\b|\bsmpte\s*2110\b|\b2110\b/.test(text))return'ST 2110';
  if(/\bndi[-\s]?hx\b|\bndihx\b/.test(text))return'NDI-HX';
  if(/\bndi\b/.test(text))return'NDI';
  if(/\brtsp\b/.test(text))return'RTSP';
  if(/\bsdi\b|\b12g\b|\b3g-sdi\b|\b6g-sdi\b/.test(text))return'SDI';
  if(/\bhdmi\b|\bhdbaset\b/.test(text))return'HDMI';
  if(/\bdante\b/.test(text))return'Dante';
  if(/\baes67\b/.test(text))return'AES67';
  if(/\bmilan\b|\bavb\b/.test(text))return'AVB/Milan';
  if(/\bmadi\b/.test(text))return'MADI';
  if(/\bq[-\s]?sys\b|\bqsc\b/.test(text))return'Q-SYS';
  if(/\banalog\b|\bxlr\b|\baudio\b/.test(text))return'Analog Audio';
  if(/\bssh\b/.test(text))return'SSH';
  if(/\bsnmp\b/.test(text))return'SNMP';
  if(/\bhttps\b/.test(text))return'HTTPS';
  if(/\bhttp\b/.test(text))return'HTTP';
  if(/\btelnet\b/.test(text))return'Telnet';
  if(/\bapi\b|\bcontrol\b/.test(text))return'API / Control';
  if(/\bwifi\b|\bwi-fi\b|\bwireless\b|\bap\b|\bu7\b/.test(text))return'Wi‑Fi';
  if(/\bpoe\+?\b|\bpoe\+\+\b/.test(text))return'PoE';
  if(cat==='Dante')return'Dante';
  if(cat==='Video')return /camera|ptz/.test(text)?'NDI-HX':'Video IP';
  if(cat==='MTR')return /teams/.test(text)?'Teams / MTR':'Room Control';
  if(cat==='AP')return'Wi‑Fi';
  if(cat==='IoT')return'API / Control';
  return'Generic IP';
}
function topologyNormalizeConnection(p){
  const raw=p.connection??p.connectedTo??p['Connected To']??p.ConnectedTo??p.target??p.link??null;
  if(raw&&typeof raw==='object')return{type:topologyText(raw.type||raw.kind||''),switchId:topologyText(raw.switchId||raw.targetSwitchId||raw.id||raw.switch||raw.Switch||raw.switchName||''),port:raw.port??raw.targetPort??raw.Port??raw.number??raw.num??'',name:topologyText(raw.name||raw.deviceName||raw.label||''),role:topologyText(raw.role||raw.connectionRole||'')};
  const text=topologyText(raw),sw=topologyFindSwitch(text);
  return sw?{type:'switch',switchId:sw.id,port:'',name:sw.name,role:'trunk'}:(text?{type:'device',switchId:'',port:'',name:text,role:'access'}:null);
}
function topologyCollectRawPorts(){
  const raw=[...(project.ports||[])];
  (project.switches||[]).forEach(sw=>{if(Array.isArray(sw.portsList))sw.portsList.forEach(p=>raw.push({...p,switchId:p.switchId||sw.id,switchName:p.switchName||sw.name}));if(Array.isArray(sw.ports))sw.ports.forEach?.(p=>{if(typeof p==='object')raw.push({...p,switchId:p.switchId||sw.id,switchName:p.switchName||sw.name});});});
  const seen=new Set();
  return raw.filter(p=>{const sw=topologyFirst(p,['switchId','Switch','switch','switchName'])||p.switchId;const port=topologyFirst(p,['port','Port','number','num'])||p.port;const key=topologyKey(sw)+'|'+port;if(seen.has(key))return false;seen.add(key);return true;});
}
function topologyNormalizePort(p){
  const sw=topologyFindSwitch(topologyFirst(p,['switchId','Switch','switch','switchName']));
  const switchId=sw?.id||topologyText(topologyFirst(p,['switchId','Switch','switch','switchName']));
  const switchName=sw?.name||topologyText(topologyFirst(p,['switchName','Switch','switch'])||switchId);
  const portNo=Number(topologyFirst(p,['port','Port','number','num'])||0);
  const tags=topologyTags(topologyFirst(p,['tags','Tags','tag','Tag']));
  const conn=topologyNormalizeConnection(p);
  let name=topologyText(topologyFirst(p,['name','Name','deviceName','device','Device','label','Label']));
  const rawConnected=topologyText(topologyFirst(p,['connectedTo','Connected To','ConnectedTo']));
  if(!name && conn && conn.type!=='switch') name=conn.name;
  if(!name && rawConnected && !topologyFindSwitch(rawConnected)) name=rawConnected;
  const vlan=topologyText(topologyFirst(p,['vlan','VLAN','vlanName','network','Network']));
  const status=topologyText(topologyFirst(p,['status','Status','state','State']) || (name && !/^port\s*\d+$/i.test(name)?'In Use':''));
  const critical=!!p.critical||!!p.Critical||tags.includes('critical');
  const category=topologyInferCategory(topologyFirst(p,['category','Category','profile','Profile','connectionType','Connection Type']),vlan,tags,name,critical);
  const obj={switchId,switchName,port:portNo,status,name,category,vlan,vlanNumber:topologyVlanNumber(vlan,tags),ip:topologyText(topologyFirst(p,['ip','IP','ipAddress','IP Address'])),mac:topologyText(topologyFirst(p,['mac','MAC','macAddress','MAC Address'])),tags,connectedTo:rawConnected||(conn?.name||conn?.switchId||''),connection:conn,critical,raw:p};obj.protocol=topologyInferProtocol(obj);return obj;
}
function topologyIsRealPort(p){return!!topologyFindSwitch(p.switchId||p.switchName)&&Number(p.port)>0;}
function topologyIsNamedDevice(p){return!!p.name&&!/^port\s*\d+$/i.test(p.name);}
function topologyIsUnavailable(p){const s=topologyLow(p.status);return s.includes('disabled')||s.includes('available')||s==='down';}
function topologyHasTrunkHint(p){return p.category==='Trunk'||p.tags.some(t=>['trunk','uplink','lacp'].includes(t))||topologyLow(p.vlan)==='trunk'||p.connection?.type==='switch';}
function topologyIsTrunk(p){return !!topologyTargetSwitchFromPort(p) && topologyHasTrunkHint(p);}
function topologyIsActiveDevicePort(p){if(!topologyIsRealPort(p)||!topologyIsNamedDevice(p)||topologyIsTrunk(p))return false;if(topologyIsUnavailable(p))return false;return topologyLow(p.status)==='in use'||(p.category&&p.category!=='Spare')||!!p.ip||!!p.mac;}
function topologyTargetSwitchFromPort(p){return p.connection?.switchId?topologyFindSwitch(p.connection.switchId):topologyFindSwitch(p.connectedTo);}
function topologyBuildTrunkLinks(ports){const links=[],seen=new Set();for(const p of ports.filter(topologyIsTrunk)){const a=topologyFindSwitch(p.switchId),b=topologyTargetSwitchFromPort(p);if(!a||!b||a.id===b.id)continue;const key=[a.id,b.id].sort().join('|');if(seen.has(key))continue;seen.add(key);const rev=ports.find(q=>q.switchId===b.id&&topologyIsTrunk(q)&&topologyTargetSwitchFromPort(q)?.id===a.id);links.push({a:topologyNormalizeSwitch(a,0),b:topologyNormalizeSwitch(b,0),aPort:p.port,bPort:rev?.port||p.connection?.port||''});}return links;}
function getTopologyData(){
  const switches=(project.switches||[]).map(topologyNormalizeSwitch);
  const ports=topologyCollectRawPorts().map(topologyNormalizePort).filter(topologyIsRealPort);
  let activeDevicePorts=ports.filter(topologyIsActiveDevicePort);
  if(!activeDevicePorts.length){
    activeDevicePorts=ports.filter(p=>
      topologyIsRealPort(p) &&
      topologyIsNamedDevice(p) &&
      !topologyIsUnavailable(p) &&
      p.category!=='Spare' &&
      p.category!=='Trunk' &&
      !topologyIsTrunk(p)
    );
  }
  const trunkLinks=topologyBuildTrunkLinks(ports);
  return{switches,ports,activeDevicePorts,trunkLinks};
}

function topologyRootSwitch(data){return data.switches.find(s=>topologyLow(s.role).includes('core'))||data.switches.find(s=>topologyLow(s.name).includes('core'))||data.switches[0]||null;}
function topologyLinkForRoot(data,root){return data.trunkLinks.map(l=>l.a.id===root.id?{parent:l.a,child:l.b,parentPort:l.aPort,childPort:l.bPort}:l.b.id===root.id?{parent:l.b,child:l.a,parentPort:l.bPort,childPort:l.aPort}:{parent:l.a,child:l.b,parentPort:l.aPort,childPort:l.bPort});}
function topologyOrderedSwitches(data,root,rootLinks){const ordered=[],seen=new Set();function add(sw){if(sw&&!seen.has(sw.id)){seen.add(sw.id);ordered.push(sw);}}add(root);rootLinks.forEach(l=>add(l.child));data.switches.forEach(add);return ordered;}
function topologyMetaLine(p){const out=[];if(p.vlanNumber)out.push('VLAN '+p.vlanNumber);else if(p.vlan)out.push('VLAN '+p.vlan);if(p.protocol)out.push(p.protocol);if(p.ip)out.push(p.ip);return out.join(' · ');}
function topologyShortSwitchName(name){
  const s=topologyText(name).replace(/switch/ig,'SW').replace(/core/ig,'CORE').replace(/edge/ig,'EDGE').replace(/av/ig,'AV').trim();
  const m=s.match(/\b(CORE|AV|EDGE|STAGE|FOH)\b.*?\b([A-Z])\b/i);
  if(m)return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`;
  return s.split(/\s+/).slice(0,3).join(' ');
}
function topologyClearPathHighlight(){const graph=document.querySelector('#topologyCanvas .tg-graph');graph?.classList.remove('has-active-path');document.querySelectorAll('#topologyCanvas .tg-node.is-selected, #topologyCanvas .tg-node.is-path, #topologyCanvas .tg-edge.is-path').forEach(x=>x.classList.remove('is-selected','is-path'));}
function topologyHighlightPath(p,button){const graph=document.querySelector('#topologyCanvas .tg-graph');if(!graph||!p||!button)return;topologyClearPathHighlight();graph.classList.add('has-active-path');button.classList.add('is-selected','is-path');const nodeIds=[button.getAttribute('data-switch-node')||`sw-${p.switchId}`,button.getAttribute('data-vlan-node')||`hub-${topologyCatKey(p)}`,button.getAttribute('data-proto-node')||`proto-${topologyKey(topologyCatKey(p))}-${topologyKey(p.protocol||'Generic IP')}`,button.getAttribute('data-id')||topologyDeviceId(p)].filter(Boolean);nodeIds.forEach(id=>graph.querySelector(`.tg-node[data-id="${CSS.escape(id)}"]`)?.classList.add('is-path'));graph.querySelectorAll('.tg-edge').forEach(line=>{const a=line.getAttribute('data-a'),b=line.getAttribute('data-b');const pair=nodeIds.includes(a)&&nodeIds.includes(b);if(pair)line.classList.add('is-path');});}
function topologyHighlightSwitchConnections(sw,data,node){
  const graph=document.querySelector('#topologyCanvas .tg-graph');
  if(!graph||!sw)return;
  topologyClearPathHighlight();
  graph.classList.add('has-active-path');
  const pathIds=new Set();
  const addId=id=>{const s=topologyText(id);if(s)pathIds.add(s);};
  const markNode=el=>{if(!el)return;el.classList.add('is-path');addId(el.getAttribute('data-id'));};
  const markNodeById=id=>{addId(id);if(id)graph.querySelector(`.tg-node[data-id="${CSS.escape(String(id))}"]`)?.classList.add('is-path');};
  const switchNodeId=node?.getAttribute('data-id')||`sw-${sw.id}`;
  if(node){node.classList.add('is-selected','is-path');addId(switchNodeId);}else{markNodeById(switchNodeId);}

  const devices=(data?.activeDevicePorts||[]).filter(p=>p.switchId===sw.id);
  devices.forEach(p=>{
    const devNode=graph.querySelector(`.tg-device[data-switch="${CSS.escape(String(sw.id))}"][data-port="${CSS.escape(String(p.port))}"]`)||graph.querySelector(`.tg-node[data-id="${CSS.escape(topologyDeviceId(p))}"]`);
    if(devNode){
      devNode.classList.add('is-path');
      [devNode.getAttribute('data-switch-node')||switchNodeId,devNode.getAttribute('data-vlan-node'),devNode.getAttribute('data-proto-node'),devNode.getAttribute('data-id')].filter(Boolean).forEach(markNodeById);
    }else{
      markNodeById(topologyDeviceId(p));
    }
  });

  (data?.trunkLinks||[]).filter(l=>l.a?.id===sw.id||l.b?.id===sw.id).forEach(l=>{
    const peer=l.a?.id===sw.id?l.b:l.a;
    const peerId=peer?.id?`sw-${peer.id}`:'';
    if(peerId)markNodeById(peerId);
  });

  graph.querySelectorAll('.tg-edge').forEach(line=>{
    const a=line.getAttribute('data-a'),b=line.getAttribute('data-b');
    if(pathIds.has(a)&&pathIds.has(b))line.classList.add('is-path');
  });
}

function topologyInfoValue(v,fallback='—'){
  const s=topologyText(v);
  return s?s:fallback;
}
function topologyInfoRow(label,value,wide=false){
  const s=topologyText(value);
  if(!s)return '';
  return `<div class="tg-info-row ${wide?'wide':''}"><span>${topologyEscape(label)}</span><b>${topologyEscape(s)}</b></div>`;
}
function topologyInfoListRow(label,items){
  const list=(items||[]).map(x=>topologyText(x)).filter(Boolean);
  if(!list.length)return '';
  return `<div class="tg-info-row wide"><span>${topologyEscape(label)}</span><b>${list.map(topologyEscape).join('<br>')}</b></div>`;
}
function topologyPortRaw(p,names){return topologyText(topologyFirst(p?.raw||{},names));}
function topologySelectActualSilently(p){
  if(!p)return null;
  const actual=(project.ports||[]).find(x=>topologyFindSwitch(x.switchId??x.Switch??x.switch??x.switchName)?.id===p.switchId&&String(x.port??x.Port??x.number??x.num)===String(p.port));
  if(actual){selected=actual;project.selected={switchId:actual.switchId,port:actual.port};}
  return actual;
}
function topologyHideInfoPopup(){
  document.querySelectorAll('.tg-info-popup').forEach(x=>x.remove());
}
function topologyPlaceInfoPopup(box,ev){
  const margin=14;
  let x=ev?.clientX?ev.clientX+18:window.innerWidth-390;
  let y=ev?.clientY?ev.clientY+18:88;
  document.body.appendChild(box);
  requestAnimationFrame(()=>{
    const w=box.offsetWidth||360,h=box.offsetHeight||260;
    x=Math.min(Math.max(margin,x),window.innerWidth-w-margin);
    y=Math.min(Math.max(margin,y),window.innerHeight-h-margin);
    box.style.left=x+'px';
    box.style.top=y+'px';
  });
}
function topologyShowInfoPopup(title,subtitle,rows,ev){
  topologyHideInfoPopup();
  const box=document.createElement('div');
  box.className='tg-info-popup';
  box.innerHTML=`<button type="button" class="tg-info-close" aria-label="Close">×</button><div class="tg-info-kicker">Topology Info</div><h3>${topologyEscape(title||'Selected item')}</h3>${subtitle?`<p>${topologyEscape(subtitle)}</p>`:''}<div class="tg-info-grid">${rows.filter(Boolean).join('')}</div>`;
  box.querySelector('.tg-info-close')?.addEventListener('click',topologyHideInfoPopup);
  topologyPlaceInfoPopup(box,ev);
}
function topologyShowPortInfo(p,ev,button){
  if(!p)return;
  topologyHighlightPath(p,button);
  topologySelectActualSilently(p);
  const rows=[
    topologyInfoRow('Switch',p.switchName||p.switchId),
    topologyInfoRow('Port','P'+p.port),
    topologyInfoRow('Category',p.category),
    topologyInfoRow('VLAN',p.vlan),
    topologyInfoRow('IP address',p.ip),
    topologyInfoRow('Speed',topologyPortRaw(p,['speed','Speed','linkSpeed','Link Speed'])),
    topologyInfoRow('PoE / Power',topologyPortRaw(p,['poe','PoE','power','Power'])),
    topologyInfoRow('Protocol',p.protocol||topologyPortRaw(p,['protocol','Protocol'])),
    topologyInfoRow('Connection',topologyPortRaw(p,['connectionType','Connection Type','profile','Profile'])),
    topologyInfoRow('Status',p.status),
    topologyInfoRow('Patch',topologyPortRaw(p,['patch','Patch','patchPanel','Patch Panel'])),
    topologyInfoRow('Notes',topologyPortRaw(p,['notes','Notes','description','Description']),true)
  ];
  topologyShowInfoPopup(p.name||'Connected device',`Device on ${p.switchName||p.switchId} · Port ${p.port}`,rows,ev);
}
function topologyShowSwitchInfo(sw,data,ev,node){
  if(!sw)return;
  topologyHighlightSwitchConnections(sw,data,node);
  const devices=(data?.activeDevicePorts||[]).filter(p=>p.switchId===sw.id).sort((a,b)=>Number(a.port||0)-Number(b.port||0));
  const trunkList=(data?.trunkLinks||[]).filter(l=>l.a?.id===sw.id||l.b?.id===sw.id);
  const active=devices.length;
  const trunks=trunkList.length;
  const categoryCounts={};
  devices.forEach(p=>{const key=p.category||p.protocol||'Device';categoryCounts[key]=(categoryCounts[key]||0)+1;});
  const typeSummary=Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([k,v])=>`${k}: ${v}`).join(' · ');
  const deviceItems=devices.slice(0,12).map(p=>`P${p.port} — ${p.name||'Device'}${p.protocol?` · ${p.protocol}`:''}${p.ip?` · ${p.ip}`:''}`);
  if(devices.length>12)deviceItems.push(`+${devices.length-12} more connected devices`);
  const trunkItems=trunkList.slice(0,8).map(l=>{
    const ownIsA=l.a?.id===sw.id;
    const ownPort=ownIsA?l.aPort:l.bPort;
    const peer=ownIsA?l.b:l.a;
    const peerPort=ownIsA?l.bPort:l.aPort;
    return `P${ownPort||'?'} ⇄ ${peer?.name||peer?.id||'Switch'}${peerPort?` P${peerPort}`:''}`;
  });
  if(trunkList.length>8)trunkItems.push(`+${trunkList.length-8} more switch links`);
  const rows=[
    topologyInfoRow('Role',sw.role),
    topologyInfoRow('Model',sw.model),
    topologyInfoRow('IP address',sw.ip),
    topologyInfoRow('Location',sw.location,true),
    topologyInfoRow('Ports / Rows',sw.ports?`${sw.ports}${sw.rows?` / ${sw.rows}`:''}`:''),
    topologyInfoRow('SFP ports',sw.sfpPorts),
    topologyInfoRow('Connected devices',active),
    topologyInfoRow('Device types',typeSummary,true),
    topologyInfoRow('Trunk links',trunks),
    topologyInfoListRow('Connected list',deviceItems),
    topologyInfoListRow('Switch links',trunkItems)
  ];
  topologyShowInfoPopup(sw.name||'Switch',`${active} connected device${active===1?'':'s'} · ${trunks} trunk/uplink link${trunks===1?'':'s'}`,rows,ev);
}

function topologySelectPort(p,button){if(!p)return;topologyHighlightPath(p,button);const actual=project.ports.find(x=>topologyFindSwitch(x.switchId??x.Switch??x.switch??x.switchName)?.id===p.switchId&&String(x.port??x.Port??x.number??x.num)===String(p.port));if(actual){selected=actual;project.selected={switchId:actual.switchId,port:actual.port};document.getElementById('portLayout')?.classList.remove('details-hidden');document.getElementById('detailsPanel')?.classList.remove('hidden');renderDetails();renderTable();renderSwitches();}}
function topologyVlanLabel(p){return p.vlanNumber?`VLAN ${p.vlanNumber}`:(p.vlan?`VLAN ${p.vlan}`:'VLAN');}
function topologyCatKey(p){return p.critical?'Critical':(TOPOLOGY_COLOR[p.category]?p.category:'Other');}
function topologyHashColor(str){let h=0;const s=String(str||'');for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return `hsl(${h%360} 82% 62%)`;}
function topologyProtocolColor(proto,catColor){
  const key=topologyLow(proto).replace(/[\s_/]+/g,'-');
  const map={
    'dante':'#ff8a24','aes67':'#ffb347','avb-milan':'#ffd166','madi':'#f97316','q-sys':'#ff6b35','analog-audio':'#c084fc',
    'ndi':'#3c8dff','ndi-hx':'#00b4ff','st-2110':'#00d4ff','rtsp':'#4cc9f0','hdmi':'#4361ee','sdi':'#4895ef','video-ip':'#5aa2ff',
    'teams-mtr':'#ad64ff','room-control':'#c77dff','api-control':'#4ade80','ssh':'#22c55e','http':'#38bdf8','https':'#60a5fa','snmp':'#84cc16','telnet':'#a3e635',
    'wi‑fi':'#3bd5d8','wi-fi':'#3bd5d8','poe':'#facc15','trunk':'#f14fa6','uplink':'#ff69c7','lacp':'#ff85d2','generic-ip':catColor||'#8b949e'
  };
  return map[key]||topologyHashColor(proto);
}
function topologyDeviceId(p){return `dev-${topologyKey(p.switchId)}-${p.port}`;}
function topologySvgLine(a,b,cls,label='',color=''){
  const midx=(a.x+b.x)/2, midy=(a.y+b.y)/2;
  const style=color?` style="stroke:${topologyEscape(color)}"`:'';
  return `<line class="tg-edge ${cls}"${style} data-a="${topologyEscape(a.id||'')}" data-b="${topologyEscape(b.id||'')}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>${label?`<text class="tg-edge-text" x="${midx}" y="${midy-8}">${topologyEscape(label)}</text>`:''}`;
}
function topologyNodeHtml(n){
  const style=`left:${n.x}px;top:${n.y}px;--cat:${n.color||'#3c8dff'}`;
  if(n.type==='switch'){const swId=String(n.id||'').replace(/^sw-/,'');return `<div class="tg-node tg-switch ${n.kind||''}" data-id="${topologyEscape(n.id)}" data-switch="${topologyEscape(swId)}" style="${style}"><span class="tg-rj45">${rj45Icon()}</span><b>${topologyEscape(n.label)}</b><small>${topologyEscape(n.sub||'')}</small></div>`;}
  if(n.type==='vlan') return `<div class="tg-node tg-vlan" data-id="${topologyEscape(n.id)}" style="${style}"><i></i><b>${topologyEscape(n.label)}</b><small>${topologyEscape(n.sub||'')}</small></div>`;
  if(n.type==='protocol') return `<div class="tg-node tg-protocol" data-id="${topologyEscape(n.id)}" style="${style}"><i></i><b>${topologyEscape(n.label)}</b><small>${topologyEscape(n.sub||'')}</small></div>`;
  const p=n.portData, meta=topologyMetaLine(p), sw=topologyShortSwitchName(p.switchName||p.switchId);
  const switchNodeId=n.switchNodeId||('sw-'+p.switchId);
  const vlanNodeId=n.vlanNodeId||('hub-'+topologyCatKey(p));
  const protoNodeId=n.protoNodeId||('proto-'+topologyKey(topologyCatKey(p))+'-'+topologyKey(p.protocol||'Generic IP'));
  return `<button type="button" class="tg-node tg-device ${p.critical?'tg-critical':''}" data-id="${topologyEscape(n.id)}" data-switch="${topologyEscape(p.switchId)}" data-port="${topologyEscape(p.port)}" data-vlan-node="${topologyEscape(vlanNodeId)}" data-proto-node="${topologyEscape(protoNodeId)}" data-switch-node="${topologyEscape(switchNodeId)}" style="${style}"><i></i><b>${topologyEscape(sw)} · P${topologyEscape(p.port)}</b><em>${topologyEscape(p.name)}</em>${meta?`<small>${topologyEscape(meta)}</small>`:''}</button>`;
}

function topologyLargeZoneMetrics(ports){
  const cats=TOPOLOGY_GROUP_ORDER.map(cat=>({cat,ports:ports.filter(p=>topologyCatKey(p)===cat)})).filter(x=>x.ports.length);
  let height=260;
  const rowGap=156;
  cats.forEach(g=>{
    height+=118;
    const protocols=[...new Set(g.ports.map(p=>p.protocol||'Generic IP'))].sort();
    protocols.forEach(proto=>{
      const count=g.ports.filter(p=>(p.protocol||'Generic IP')===proto).length;
      const cols=count>12?3:(count>5?2:1);
      const rows=Math.max(1,Math.ceil(count/cols));
      height+=118+(rows*rowGap)+34;
    });
    height+=42;
  });
  return Math.max(560,height+120);
}
function topologyLargeSwitchGroup(sw,root){
  const txt=topologyLow([sw.name,sw.role,sw.model,sw.location].join(' '));
  if(sw.id===root?.id || txt.includes('core'))return{key:'backbone',title:'BACKBONE / CORE',sub:'Main and remote core switching',order:0,color:TOPOLOGY_COLOR.Trunk};
  if(txt.includes('remote'))return{key:'remote',title:'REMOTE 10 KM BUILDING',sub:'Remote control, production and engineering',order:80,color:'#6fa8ff'};
  if(txt.includes('mtr')||txt.includes('room control')||txt.includes('review room')||txt.includes('meeting'))return{key:'rooms',title:'ROOM / MTR MINI NETWORKS',sub:'Meeting rooms and local room-control islands',order:20,color:TOPOLOGY_COLOR.MTR};
  if(txt.includes('studio'))return{key:'studios',title:'BROADCAST STUDIOS',sub:'Studio production racks and local control',order:30,color:TOPOLOGY_COLOR.Video};
  if(txt.includes('audio')||txt.includes('dante'))return{key:'audio',title:'AUDIO / DANTE',sub:'DSP, stageboxes, amplifiers and audio clocking',order:40,color:TOPOLOGY_COLOR.Dante};
  if(txt.includes('video')||txt.includes('prod'))return{key:'video',title:'VIDEO PRODUCTION',sub:'Routing, ST2110/NDI gateways, playout and ingest',order:50,color:TOPOLOGY_COLOR.Video};
  if(txt.includes('monitor')||txt.includes('engineering'))return{key:'monitoring',title:'MONITORING / ENGINEERING',sub:'Multiview, scopes, return feeds and engineering',order:60,color:TOPOLOGY_COLOR.Critical};
  if(txt.includes('wireless')||txt.includes('ap')||txt.includes('gig')||txt.includes('mobile'))return{key:'wireless',title:'WIRELESS / GIG CONTROL',sub:'AP edge, mobile production and roaming IP control',order:70,color:TOPOLOGY_COLOR.AP};
  if(txt.includes('lighting')||txt.includes('stage'))return{key:'stage',title:'STAGE / LIGHTING',sub:'Stage floor, Art-Net/sACN and show-control edge',order:75,color:TOPOLOGY_COLOR.IoT};
  return{key:'other',title:'OTHER SYSTEMS',sub:'Supporting systems and edge switches',order:90,color:TOPOLOGY_COLOR.Other};
}
function topologySwitchSortScore(sw,root){
  const g=topologyLargeSwitchGroup(sw,root);
  const name=topologyLow(sw.name+' '+sw.role);
  let n=0;
  if(sw.id===root?.id)n-=500;
  if(name.includes('remote')&&name.includes('core'))n-=420;
  if(name.includes('main')&&name.includes('core'))n-=430;
  if(name.includes('studio 1'))n-=30;
  if(name.includes('studio 2'))n-=20;
  return g.order*1000+n;
}
function topologyLargeGroupList(switches,root){
  const defs=[];
  const byKey=new Map();
  switches.forEach(sw=>{
    const g=topologyLargeSwitchGroup(sw,root);
    if(!byKey.has(g.key)){byKey.set(g.key,{...g,switches:[]});defs.push(byKey.get(g.key));}
    byKey.get(g.key).switches.push(sw);
  });
  defs.sort((a,b)=>a.order-b.order||a.title.localeCompare(b.title));
  defs.forEach(g=>g.switches.sort((a,b)=>topologySwitchSortScore(a,root)-topologySwitchSortScore(b,root)||a.name.localeCompare(b.name)));
  return defs;
}
function topologyBuildGraphLarge(data,root,rootLinks){
  const active=data.activeDevicePorts.slice().sort((a,b)=>a.switchName.localeCompare(b.switchName)||topologyCatKey(a).localeCompare(topologyCatKey(b))||(a.protocol||'').localeCompare(b.protocol||'')||a.port-b.port);
  const switches=topologyOrderedSwitches(data,root,rootLinks).slice().sort((a,b)=>topologySwitchSortScore(a,root)-topologySwitchSortScore(b,root)||a.name.localeCompare(b.name));
  const groups=topologyLargeGroupList(switches,root);
  const portsBySwitch=new Map();
  active.forEach(p=>{if(!portsBySwitch.has(p.switchId))portsBySwitch.set(p.switchId,[]);portsBySwitch.get(p.switchId).push(p);});

  const zoneW=680, zoneGapX=150, groupGapY=275, chunkGapY=165, marginX=250, overviewTop=95, overviewH=345, topPad=overviewTop+overviewH+130;
  const maxCols=4;
  const maxChunk=Math.max(1,...groups.map(g=>Math.min(maxCols,Math.max(1,g.switches.length))));
  const W=Math.max(1900,marginX*2+maxChunk*zoneW+Math.max(0,maxChunk-1)*zoneGapX);
  const nodes=[],edgeDefs=[],zones=[];
  const swPos={};

  const backbone={id:'ov-backbone',type:'vlan',label:'SYSTEM OVERVIEW',sub:`${data.switches.length} switches · ${data.trunkLinks.length} trunk links`,x:W/2,y:overviewTop+30,color:TOPOLOGY_COLOR.Trunk};
  nodes.push(backbone);
  const overviewGroups=groups.filter(g=>g.key!=='backbone');
  const overviewStartX=marginX+120;
  const overviewEndX=W-marginX-120;
  const ovCount=Math.max(overviewGroups.length,1);
  overviewGroups.forEach((g,i)=>{
    const x=ovCount===1?W/2:overviewStartX+i*((overviewEndX-overviewStartX)/(ovCount-1));
    const n={id:'ov-'+g.key,type:'protocol',label:g.title.replace(/\s*\/\s*/g,' / '),sub:`${g.switches.length} switches`,x,y:overviewTop+205,color:g.color};
    nodes.push(n);
    edgeDefs.push({a:backbone,b:n,cls:'tg-trunk-edge',color:g.color});
  });
  zones.push(`<div class="tg-system-map" style="left:${marginX-38}px;top:${overviewTop-72}px;width:${W-(marginX*2)+76}px;height:${overviewH}px"><b>NETWORK OVERVIEW</b><small>Top layer shows the main system blocks. Detailed switch zones start below.</small></div>`);

  let cursorY=topPad;
  groups.forEach(g=>{
    const chunks=[];
    for(let i=0;i<g.switches.length;i+=maxCols)chunks.push(g.switches.slice(i,i+maxCols));
    chunks.forEach((chunk,chunkIndex)=>{
      const layouts=chunk.map(sw=>{const ports=portsBySwitch.get(sw.id)||[];return{sw,ports,height:topologyLargeZoneMetrics(ports)};});
      const rowWidth=layouts.length*zoneW+Math.max(0,layouts.length-1)*zoneGapX;
      const rowH=Math.max(560,...layouts.map(x=>x.height));
      let cursorX=(W-rowWidth)/2;
      const laneTop=cursorY-78;
      const laneH=rowH+126;
      zones.push(`<div class="tg-system-lane tg-system-${topologyEscape(g.key)}" style="left:${cursorX-40}px;top:${laneTop}px;width:${rowWidth+80}px;height:${laneH}px;--lane:${topologyEscape(g.color)}"><b>${topologyEscape(chunkIndex?g.title+' CONTINUED':g.title)}</b><small>${topologyEscape(g.sub)} · ${g.switches.length} switches</small></div>`);
      layouts.forEach(layout=>{
        layout.x=cursorX;layout.y=cursorY;layout.rowH=rowH;layout.group=g;
        cursorX+=zoneW+zoneGapX;
      });
      layouts.forEach(layout=>{
        const sw=layout.sw, ports=layout.ports, zoneX=layout.x, zoneY=layout.y, centerX=zoneX+zoneW/2;
        const swNode={id:'sw-'+sw.id,type:'switch',kind:sw.id===root.id?'root':'child',label:sw.name,sub:sw.model||'',x:centerX,y:zoneY+88,color:sw.id===root.id?TOPOLOGY_COLOR.Trunk:(layout.group?.color||'#4d83ff')};
        swPos[sw.id]=swNode;nodes.push(swNode);
        zones.push(`<div class="tg-switch-zone" style="left:${zoneX}px;top:${zoneY}px;width:${zoneW}px;height:${layout.height}px"><b>${topologyEscape(topologyShortSwitchName(sw.name))}</b><small>${topologyEscape(sw.role||'Switch')} · ${ports.length} active ports</small></div>`);
      });
      cursorY+=rowH+(chunkIndex<chunks.length-1?chunkGapY:groupGapY);
    });
  });

  data.trunkLinks.forEach(l=>{
    const a=swPos[l.a.id],b=swPos[l.b.id];
    if(a&&b)edgeDefs.push({a,b,cls:'tg-trunk-edge',label:`P${l.aPort||'?'} ⇄ P${l.bPort||'?'}`});
  });

  const sectionRowGap=156;
  const deviceColGap=224;
  groups.forEach(g=>{
    g.switches.forEach(sw=>{
      const ports=portsBySwitch.get(sw.id)||[];
      const switchNode=swPos[sw.id];
      if(!switchNode)return;
      const zoneX=switchNode.x-zoneW/2, zoneY=switchNode.y-88, centerX=switchNode.x;
      let y=zoneY+250;
      const cats=TOPOLOGY_GROUP_ORDER.map(cat=>({cat,ports:ports.filter(p=>topologyCatKey(p)===cat)})).filter(x=>x.ports.length);
      cats.forEach(catGroup=>{
        const color=TOPOLOGY_COLOR[catGroup.cat]||TOPOLOGY_COLOR.Other;
        const vlanNums=[...new Set(catGroup.ports.map(p=>p.vlanNumber).filter(Boolean))].sort((a,b)=>a-b);
        const catId=`hub-${topologyKey(sw.id)}-${topologyKey(catGroup.cat)}`;
        const hubNode={id:catId,type:'vlan',label:TOPOLOGY_LABEL[catGroup.cat]||catGroup.cat,sub:(vlanNums.length?`VLAN ${vlanNums.join(' / ')}`:'VLAN')+` · ${catGroup.ports.length} ports`,x:centerX,y,color};
        nodes.push(hubNode);
        edgeDefs.push({a:switchNode,b:hubNode,cls:'tg-'+topologyLow(catGroup.cat)+'-edge',color});
        y+=132;
        const protocols=[...new Set(catGroup.ports.map(p=>p.protocol||'Generic IP'))].sort();
        protocols.forEach(proto=>{
          const protoPorts=catGroup.ports.filter(p=>(p.protocol||'Generic IP')===proto).sort((a,b)=>a.port-b.port);
          const pColor=topologyProtocolColor(proto,color);
          const protoId=`proto-${topologyKey(sw.id)}-${topologyKey(catGroup.cat)}-${topologyKey(proto)}`;
          const protoNode={id:protoId,type:'protocol',label:proto,sub:`${protoPorts.length} ports`,x:centerX,y,color:pColor,categoryColor:color};
          nodes.push(protoNode);
          edgeDefs.push({a:hubNode,b:protoNode,cls:'tg-'+topologyLow(catGroup.cat)+'-edge',color:pColor});
          const cols=protoPorts.length>12?3:(protoPorts.length>5?2:1);
          const startX=centerX-((cols-1)*deviceColGap)/2;
          const baseY=y+126;
          protoPorts.forEach((p,idx)=>{
            const col=idx%cols,row=Math.floor(idx/cols);
            const x=startX+col*deviceColGap;
            const py=baseY+row*sectionRowGap;
            const deviceNode={id:topologyDeviceId(p),type:'device',label:p.name,sub:topologyMetaLine(p),x,y:py,color:pColor,categoryColor:color,portData:p,groupCat:catGroup.cat,protocol:proto,switchNodeId:switchNode.id,vlanNodeId:catId,protoNodeId:protoId};
            nodes.push(deviceNode);
            edgeDefs.push({a:protoNode,b:deviceNode,cls:'tg-'+topologyLow(catGroup.cat)+'-edge',color:pColor});
          });
          y=baseY+(Math.max(1,Math.ceil(protoPorts.length/cols))*sectionRowGap)+50;
        });
        y+=54;
      });
    });
  });

  const finalH=Math.max(1200,cursorY+90);
  const edges=edgeDefs.map(e=>topologySvgLine(e.a,e.b,e.cls,e.label||'',e.color||''));
  const protoCount=new Set(active.map(p=>p.switchId+'|'+topologyCatKey(p)+'|'+(p.protocol||'Generic IP'))).size;
  const badge=`<div class="tg-badge"><b>System topology:</b><span>Switches: ${data.switches.length}</span><span>Active device ports: ${active.length}</span><span>Local protocol groups: ${protoCount}</span><span>Trunk links: ${data.trunkLinks.length}</span><span>Structure: overview + system lanes</span></div>`;
  const empty=active.length?'':`<div class="tg-empty">No active named device ports found. Load demo or check Port Map status/name/category fields.</div>`;
  const legend=`<div class="tg-legend"><b>Network graph</b><span style="--cat:${TOPOLOGY_COLOR.Trunk}">Trunk</span><span style="--cat:${TOPOLOGY_COLOR.Dante}">Audio</span><span style="--cat:${TOPOLOGY_COLOR.Video}">Video</span><span style="--cat:${TOPOLOGY_COLOR.MTR}">MTR / Teams</span><span style="--cat:${TOPOLOGY_COLOR.AP}">AP</span><span style="--cat:${TOPOLOGY_COLOR.IoT}">Control</span><span style="--cat:${TOPOLOGY_COLOR.Critical}">Critical</span></div>`;
  return {html:`<div class="tg-graph tg-large-layout tg-overview-layout" style="width:${W}px;height:${finalH}px">${badge}<svg class="tg-svg" viewBox="0 0 ${W} ${finalH}" preserveAspectRatio="none">${edges.join('')}</svg>${zones.join('')}${nodes.map(topologyNodeHtml).join('')}${empty}${legend}</div>`,width:W,height:finalH};
}

function topologyBuildGraph(data,root,rootLinks){
  if((data.activeDevicePorts||[]).length>80 || (data.switches||[]).length>10)return topologyBuildGraphLarge(data,root,rootLinks);
  const switches=topologyOrderedSwitches(data,root,rootLinks);
  const active=data.activeDevicePorts.slice().sort((a,b)=>topologyCatKey(a).localeCompare(topologyCatKey(b))||(a.protocol||'').localeCompare(b.protocol||'')||a.switchName.localeCompare(b.switchName)||a.port-b.port);
  const nodes=[];
  const edgeDefs=[];
  const swPos={};

  const groups=[];
  for(const cat of TOPOLOGY_GROUP_ORDER){
    const ports=active.filter(p=>topologyCatKey(p)===cat);
    if(ports.length) groups.push({cat,ports});
  }

  function buildProtocolLayouts(g){
    const protocols=[...new Set(g.ports.map(p=>p.protocol||'Generic IP'))].sort();
    const protocolGap=260;
    const laneGap=120;
    const colGap=250;
    const rowGap=178;
    const deviceBaseY=190;
    const layouts=protocols.map(proto=>{
      const protoPorts=g.ports.filter(p=>(p.protocol||'Generic IP')===proto);
      const switchIds=[...new Set(protoPorts.map(p=>p.switchId))].sort((a,b)=>(swPos[a]?.x||0)-(swPos[b]?.x||0));
      const lanes=switchIds.map(sid=>{
        const lanePorts=protoPorts.filter(p=>p.switchId===sid).sort((a,b)=>a.port-b.port);
        const rows=Math.min(8,Math.max(4,Math.ceil(Math.sqrt(Math.max(lanePorts.length,1)*1.25))));
        const cols=Math.max(1,Math.ceil(lanePorts.length/rows));
        const width=Math.max(260,cols*colGap);
        const height=deviceBaseY+Math.max(1,rows)*rowGap+120;
        return {sid,lanePorts,rows,cols,width,height};
      });
      const width=Math.max(360,lanes.reduce((s,l)=>s+l.width,0)+Math.max(0,lanes.length-1)*laneGap+180);
      const height=Math.max(460,...lanes.map(l=>l.height));
      return {proto,protoPorts,switchIds,lanes,width,height,protocolGap,laneGap,colGap,rowGap,deviceBaseY};
    });
    const width=Math.max(560,layouts.reduce((s,l)=>s+l.width,0)+Math.max(0,layouts.length-1)*protocolGap);
    const height=Math.max(720,...layouts.map(l=>l.height+260));
    return {layouts,width,height,protocolGap};
  }

  const groupLayouts=groups.map(g=>({g,...buildProtocolLayouts(g)}));
  const row1Cats=['Dante','Video','MTR','Other'];
  const row2Cats=['AP','IoT','Critical'];
  const rows=[
    groupLayouts.filter(x=>row1Cats.includes(x.g.cat)),
    groupLayouts.filter(x=>row2Cats.includes(x.g.cat)),
    groupLayouts.filter(x=>!row1Cats.includes(x.g.cat)&&!row2Cats.includes(x.g.cat))
  ].filter(r=>r.length);

  const groupGap=560;
  const sidePad=650;
  const rowWidths=rows.map(row=>row.reduce((s,x)=>s+x.width,0)+Math.max(0,row.length-1)*groupGap+sidePad*2);
  const W=Math.max(6200,...rowWidths);
  const rootX=W/2;

  swPos[root.id]={id:'sw-'+root.id,x:rootX,y:150};
  const childLinks=rootLinks.filter(l=>l.child&&l.child.id!==root.id);
  childLinks.forEach((l,i)=>{
    const count=Math.max(childLinks.length,1);
    const x=count===1?rootX:(sidePad+i*((W-sidePad*2)/(count-1)));
    swPos[l.child.id]={id:'sw-'+l.child.id,x,y:420};
  });
  switches.forEach((sw,i)=>{
    if(!swPos[sw.id]){
      const cols=Math.max(1,switches.length);
      swPos[sw.id]={id:'sw-'+sw.id,x:sidePad+i*((W-sidePad*2)/Math.max(cols-1,1)),y:420};
    }
  });

  switches.forEach(sw=>nodes.push({id:'sw-'+sw.id,type:'switch',kind:sw.id===root.id?'root':'child',label:sw.name,sub:sw.model||'',x:swPos[sw.id].x,y:swPos[sw.id].y,color:sw.id===root.id?TOPOLOGY_COLOR.Trunk:'#4d83ff'}));
  for(const l of rootLinks){
    const a=swPos[l.parent.id]||swPos[root.id],b=swPos[l.child.id];
    if(a&&b) edgeDefs.push({a,b,cls:'tg-trunk-edge',label:`P${l.parentPort||'?'} ⇄ P${l.childPort||'?'}`});
  }

  const hubPos={};
  let rowY=820;
  rows.forEach(row=>{
    const rowWidth=row.reduce((s,x)=>s+x.width,0)+Math.max(0,row.length-1)*groupGap;
    let cursor=(W-rowWidth)/2;
    const rowHeight=Math.max(...row.map(x=>x.height));
    row.forEach(gl=>{
      const g=gl.g;
      const color=TOPOLOGY_COLOR[g.cat]||TOPOLOGY_COLOR.Other;
      const vlanNums=[...new Set(g.ports.map(p=>p.vlanNumber).filter(Boolean))].sort((a,b)=>a-b);
      const label=TOPOLOGY_LABEL[g.cat]||g.cat;
      const sub=(vlanNums.length?`VLAN ${vlanNums.join(' / ')}`:'VLAN')+` · ${g.ports.length} ports`;
      const hubNode={id:'hub-'+g.cat,type:'vlan',label,sub,x:cursor+gl.width/2,y:rowY,color};
      hubPos[g.cat]=hubNode;
      nodes.push(hubNode);
      cursor += gl.width + groupGap;
    });
    rowY += rowHeight + 760;
  });

  groups.forEach(g=>{
    const h=hubPos[g.cat];
    const bySwitch=[...new Set(g.ports.map(p=>p.switchId))].sort((a,b)=>(swPos[a]?.x||0)-(swPos[b]?.x||0));
    for(const sid of bySwitch){
      const sp=swPos[sid];
      if(sp) edgeDefs.push({a:sp,b:h,cls:'tg-'+topologyLow(g.cat)+'-edge'});
    }
  });

  const protocolNodes=[];
  let maxY=1700;
  groupLayouts.forEach(gl=>{
    const g=gl.g;
    const h=hubPos[g.cat], color=h.color;
    let cursor=h.x-gl.width/2;
    gl.layouts.forEach(layout=>{
      const pColor=topologyProtocolColor(layout.proto,color);
      const pNode={id:'proto-'+topologyKey(g.cat)+'-'+topologyKey(layout.proto),type:'protocol',label:layout.proto,sub:`${layout.protoPorts.length} ports`,x:cursor+layout.width/2,y:h.y+230,color:pColor,categoryColor:color};
      cursor += layout.width + gl.protocolGap;
      nodes.push(pNode); protocolNodes.push(pNode);
      edgeDefs.push({a:h,b:pNode,cls:'tg-'+topologyLow(g.cat)+'-edge',color:pColor});

      let laneCursor=pNode.x-layout.width/2+90;
      layout.lanes.forEach(lane=>{
        const laneLeft=laneCursor;
        const baseY=pNode.y+layout.deviceBaseY;
        lane.lanePorts.forEach((p,idx)=>{
          const col=Math.floor(idx/lane.rows), row=idx%lane.rows;
          const x=laneLeft+(col*layout.colGap)+(layout.colGap/2);
          const y=baseY+row*layout.rowGap;
          const deviceNode={id:topologyDeviceId(p),type:'device',label:p.name,sub:topologyMetaLine(p),x,y,color:pColor,categoryColor:color,portData:p,groupCat:g.cat,protocol:layout.proto};
          nodes.push(deviceNode);
          edgeDefs.push({a:pNode,b:deviceNode,cls:'tg-'+topologyLow(g.cat)+'-edge',color:pColor});
          maxY=Math.max(maxY,y);
        });
        laneCursor += lane.width + layout.laneGap;
      });
    });
  });

  const allPoints=[...nodes];
  edgeDefs.forEach(e=>{allPoints.push(e.a,e.b);});
  const minX=Math.min(...allPoints.map(p=>p.x))-420;
  const maxX=Math.max(...allPoints.map(p=>p.x))+520;
  const minY=Math.min(...allPoints.map(p=>p.y))-180;
  const maxBoundY=Math.max(maxY,...allPoints.map(p=>p.y))+520;
  const shiftX=minX<0?Math.abs(minX)+120:120;
  const shiftY=minY<0?Math.abs(minY)+100:100;
  const moved=new Set();
  allPoints.forEach(p=>{if(!p||moved.has(p))return;moved.add(p);p.x+=shiftX;p.y+=shiftY;});
  const finalW=Math.ceil(maxX-minX+360);
  const finalH=Math.ceil(maxBoundY-minY+300);

  const edges=edgeDefs.map(e=>topologySvgLine(e.a,e.b,e.cls,e.label||'',e.color||''));
  const protoCount=protocolNodes.length;
  const badge=`<div class="tg-badge"><b>Topology data check:</b><span>Switches: ${data.switches.length}</span><span>Active device ports: ${active.length}</span><span>Protocols: ${protoCount}</span><span>Trunk links: ${data.trunkLinks.length}</span><span>Source: Port Map data</span></div>`;
  const empty=active.length?'':`<div class="tg-empty">No active named device ports found. Load demo or check Port Map status/name/category fields.</div>`;
  const legend=`<div class="tg-legend"><b>Network graph</b><span style="--cat:${TOPOLOGY_COLOR.Trunk}">Trunk</span><span style="--cat:${TOPOLOGY_COLOR.Dante}">Audio</span><span style="--cat:${TOPOLOGY_COLOR.Video}">Video</span><span style="--cat:${TOPOLOGY_COLOR.MTR}">MTR / Teams</span><span style="--cat:${TOPOLOGY_COLOR.AP}">AP</span><span style="--cat:${TOPOLOGY_COLOR.IoT}">Control</span><span style="--cat:${TOPOLOGY_COLOR.Critical}">Critical</span></div>`;
  return {html:`<div class="tg-graph" style="width:${finalW}px;height:${finalH}px">${badge}<svg class="tg-svg" viewBox="0 0 ${finalW} ${finalH}" preserveAspectRatio="none">${edges.join('')}</svg>${nodes.map(topologyNodeHtml).join('')}${empty}${legend}</div>`,width:finalW,height:finalH};
}

function renderTopology(){
  const canvas=document.getElementById('topologyCanvas');if(!canvas)return;canvas.innerHTML='';canvas.className='topology-canvas tg-canvas';canvas.style.zoom=topologyZoom||1;
  const pct=document.getElementById('topologyZoomPct');if(pct)pct.textContent=Math.round((topologyZoom||1)*100)+'%';
  const h=document.querySelector('#topology .topology-toolbar h2');if(h)h.innerHTML='Graph Topology <span>Port → switch → VLAN/IP connection graph</span>';
  ['addTopologyDeviceBtn','showTrunksBtn'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  const data=getTopologyData();if(!data.switches.length){canvas.innerHTML='<div class="topo-error">No switches in project. Add switches and port data first.</div>';return;}
  const root=topologyRootSwitch(data),rootLinks=topologyLinkForRoot(data,root),graph=topologyBuildGraph(data,root,rootLinks);
  const extraRight=520, extraBottom=620;const cw=(graph.width+extraRight)+'px',ch=(graph.height+extraBottom)+'px';canvas.style.setProperty('--tg-w',cw);canvas.style.setProperty('--tg-h',ch);canvas.style.width=cw;canvas.style.minWidth=cw;canvas.style.height=ch;canvas.style.minHeight=ch;canvas.style.overflow='visible';canvas.innerHTML=graph.html;
  canvas.querySelectorAll('.tg-device').forEach(btn=>{const sw=btn.getAttribute('data-switch'),port=btn.getAttribute('data-port');const p=data.activeDevicePorts.find(x=>x.switchId===sw&&String(x.port)===String(port));btn.addEventListener('click',(ev)=>{ev.stopPropagation();topologyShowPortInfo(p,ev,btn);});btn.addEventListener('dblclick',()=>{if(selected)openEditDialog();});});
  canvas.querySelectorAll('.tg-switch').forEach(node=>{const swId=node.getAttribute('data-switch')||String(node.getAttribute('data-id')||'').replace(/^sw-/,'');const sw=data.switches.find(x=>x.id===swId);node.addEventListener('click',(ev)=>{ev.stopPropagation();topologyShowSwitchInfo(sw,data,ev,node);});});
  canvas.addEventListener('click',(ev)=>{if(ev.target===canvas||ev.target.closest('.tg-graph')===ev.target){topologyClearPathHighlight();topologyHideInfoPopup();}});
}

// ── Zoom / fit ─────────────────────────────────────────────────────────────
function setTopologyZoom(value,keepCenter=true){
  const scroll=document.querySelector('.topology-scroll'),canvas=document.getElementById('topologyCanvas');if(!canvas)return;
  const oldZoom=topologyZoom||1;
  const centerX=scroll?(scroll.scrollLeft+scroll.clientWidth/2)/oldZoom:0;
  const centerY=scroll?(scroll.scrollTop+scroll.clientHeight/2)/oldZoom:0;
  topologyZoom=Math.max(.15,Math.min(2,Number(value)||1));
  canvas.style.zoom=topologyZoom;
  const pct=document.getElementById('topologyZoomPct');if(pct)pct.textContent=`${Math.round(topologyZoom*100)}%`;
  if(scroll&&keepCenter){scroll.scrollLeft=Math.max(0,centerX*topologyZoom-scroll.clientWidth/2);scroll.scrollTop=Math.max(0,centerY*topologyZoom-scroll.clientHeight/2);}
}
function fitTopology(){
  const scroll=document.querySelector('.topology-scroll'),canvas=document.getElementById('topologyCanvas');if(!scroll||!canvas)return;
  const target=Math.max(.15,Math.min(1,(scroll.clientWidth-60)/Math.max(canvas.scrollWidth,1200)));
  setTopologyZoom(target,false); scroll.scrollTo({left:0,top:0,behavior:'smooth'});
}

// ── Print layout ───────────────────────────────────────────────────────────
function printText(v,fallback='-'){
  const s=String(v??'').trim();
  return s?s:fallback;
}
function printShort(v,max=34){
  // v3.8.54 PDF text fix: never cut engineering names with ellipsis in PDF/export tables.
  const s=printText(v,'');
  return s || '-';
}
function printIsActivePort(p){
  if(!p) return false;
  const name=String(p.name||'').trim();
  return p.status==='In Use'||p.category!=='Spare'||(name&&!/^Port\s+\d+$/i.test(name));
}
function printRoleText(p){
  const tags=parseTags(p.tags);
  if(p.category==='Trunk'||tags.some(t=>['trunk','uplink','lacp','sfp'].includes(t))) return 'trunk / uplink';
  return p.connection?.role||p.linkRole||'access';
}
function printTargetText(p){
  const conn=p.connection||{};
  const target=conn.switchId?bySwitch(conn.switchId):null;
  if(target) return `${target.name}${conn.port?` P${conn.port}`:''}`;
  return p.connectedTo||conn.name||p.name||'-';
}
function printCategoryClass(cat){
  return cssCat(cat||'Spare').toLowerCase();
}
function printCategoryLabel(cat){
  const c=String(cat||'Spare');
  return c==='MTR'?'MTR/Teams':c;
}
function printCategorySummary(){
  const cats=['Dante','Video','MTR','AP','IoT','Critical','Trunk','Spare'];
  return cats.map(cat=>{
    const all=project.ports.filter(p=>(p.category||'Spare')===cat || (cat==='Spare'&&(p.status==='Available'||p.category==='Spare')));
    if(!all.length) return '';
    const active=all.filter(printIsActivePort).length;
    return `<div class="pmx-kpi ${printCategoryClass(cat)}"><b>${escapeHtml(printCategoryLabel(cat))}</b><strong>${active}</strong><small>${all.length} total</small></div>`;
  }).filter(Boolean).join('');
}
function printProtocolSummary(){
  const map=new Map();
  project.ports.filter(printIsActivePort).forEach(p=>{
    const proto=printText(p.protocol||p.connectionType||p.category,'Generic');
    if(!map.has(proto)) map.set(proto,{count:0,cats:new Set(),vlans:new Set()});
    const r=map.get(proto);
    r.count++;
    r.cats.add(printText(p.category));
    if(p.vlan) r.vlans.add(String(p.vlan));
  });
  return [...map.entries()].sort((a,b)=>b[1].count-a[1].count||a[0].localeCompare(b[0])).slice(0,30).map(([proto,r])=>`
    <tr><td>${escapeHtml(proto)}</td><td>${r.count}</td><td>${escapeHtml([...r.cats].join(', '))}</td><td>${escapeHtml([...r.vlans].slice(0,5).join(' / ')||'-')}</td></tr>
  `).join('');
}
function printVlanSummary(){
  const map=new Map();
  project.ports.filter(printIsActivePort).forEach(p=>{
    const vlan=printText(p.vlan,'-');
    if(!map.has(vlan)) map.set(vlan,{count:0,cats:new Set(),protocols:new Set()});
    const r=map.get(vlan);
    r.count++;
    r.cats.add(printText(p.category));
    if(p.protocol) r.protocols.add(p.protocol);
  });
  return [...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})).map(([vlan,r])=>`
    <tr><td>${escapeHtml(vlan)}</td><td>${r.count}</td><td>${escapeHtml([...r.cats].join(', '))}</td><td>${escapeHtml([...r.protocols].slice(0,5).join(', ')||'-')}</td></tr>
  `).join('');
}
function printTrunkRows(){
  const trunks=project.ports.filter(p=>p.category==='Trunk'||parseTags(p.tags).some(t=>['trunk','uplink','lacp','sfp'].includes(t)));
  const seen=new Set();
  const rows=[];
  trunks.forEach(p=>{
    const sw=bySwitch(p.switchId);
    const target=p.connection?.switchId?bySwitch(p.connection.switchId):null;
    const a=`${p.switchId}:${p.port}`;
    const b=target?`${target.id}:${p.connection?.port||''}`:String(p.connectedTo||p.connection?.name||'');
    const key=[a,b].sort().join('|');
    if(seen.has(key)) return;
    seen.add(key);
    rows.push({p,sw,target});
  });
  return rows.map(({p,sw,target})=>`
    <tr>
      <td>${escapeHtml(sw?.name||p.switchId)}</td>
      <td>P${escapeHtml(p.port)}</td>
      <td>${escapeHtml(target?.name||p.connectedTo||p.connection?.name||'-')}</td>
      <td>${escapeHtml(p.connection?.port?('P'+p.connection.port):'-')}</td>
      <td>${escapeHtml(p.speed||'-')}</td>
      <td>${escapeHtml(p.protocol||p.profile||'Trunk')}</td>
      <td>${escapeHtml(p.notes||'')}</td>
    </tr>
  `).join('');
}
function printSwitchPortGrid(sw){
  return portsFor(sw.id).map(p=>{
    const cat=printCategoryClass(p.category||'Spare');
    const active=printIsActivePort(p);
    const role=printRoleText(p);
    const target=printTargetText(p);
    const label=printText(p.category||'Spare','Spare').replace('Trunk','TRK').replace('Dante','AUD').replace('Video','VID').replace('Critical','CRIT').replace('Spare','SP').replace('MTR','MTR').replace('IoT','IOT');
    return `<div class="pmx-port ${cat} ${active?'active':'empty'} ${role.includes('trunk')?'trunklink':''}" title="${escapeHtml(`P${p.port} ${p.name||''} → ${target} ${p.vlan||''} ${p.ip||''}`)}">
      <b>${escapeHtml(p.port)}</b>
      <i></i>
      <span>${escapeHtml(label.slice(0,4).toUpperCase())}</span>
    </div>`;
  }).join('');
}
function printConnectionRows(sw){
  const rows=portsFor(sw.id).filter(printIsActivePort).sort((a,b)=>Number(a.port)-Number(b.port));
  if(!rows.length) return '<tr><td colspan="10">No active connections on this switch</td></tr>';
  return rows.map(p=>{
    const cat=printCategoryClass(p.category||'Spare');
    return `<tr>
      <td class="pmx-port-num">P${escapeHtml(p.port)}</td>
      <td>${escapeHtml(printText(p.status))}</td>
      <td><i class="pmx-dot ${cat}"></i>${escapeHtml(printText(p.category))}</td>
      <td>${escapeHtml(printText(p.name))}</td>
      <td>${escapeHtml(printText(p.protocol||p.connectionType))}</td>
      <td>${escapeHtml(printText(p.vlan))}</td>
      <td>${escapeHtml(printText(p.ip))}</td>
      <td>${escapeHtml(printText(p.speed))}</td>
      <td>${escapeHtml(printText(p.poe))}</td>
      <td>${escapeHtml(printTargetText(p))}<br><small>${escapeHtml(printRoleText(p))}</small></td>
    </tr>`;
  }).join('');
}
function printSwitchBlock(sw){
  const ports=portsFor(sw.id);
  // v3.8.63 print grid follows Port Map rule only:
  // Use the same row setting as the Port Map switch card: perRow = ceil(sw.ports / sw.rows).
  // Nothing is guessed here; edit the switch rows/ports in Port Map, and Print Layout follows it.
  const printRows = Math.max(1, Number(sw.rows || 1));
  const printPortCount = Math.max(1, Number(sw.ports || ports.length || 1));
  const portGridCols = Math.ceil(printPortCount / printRows);
  // v3.8.64 print grid inline override: prevents old repeat(26) CSS from overriding Port Map rows.
  const active=ports.filter(printIsActivePort).length;
  const trunk=ports.filter(p=>p.category==='Trunk'||parseTags(p.tags).includes('trunk')).length;
  const groupText=['Dante','Video','MTR','AP','IoT','Critical','Trunk','Spare'].map(cat=>{
    const c=ports.filter(p=>(p.category||'Spare')===cat || (cat==='Spare'&&(p.status==='Available'||p.category==='Spare'))).length;
    return c?`<span class="${printCategoryClass(cat)}"><i></i>${escapeHtml(printCategoryLabel(cat))} ${c}</span>`:'';
  }).filter(Boolean).join('');
  return `<section class="pmx-switch-card">
    <header class="pmx-switch-head">
      <div class="pmx-switch-icon"><div class="pmx-rj45-big"></div></div>
      <div class="pmx-switch-title">
        <h2>${escapeHtml(sw.name)}</h2>
        <p>${escapeHtml(sw.model||'Switch')}</p>
      </div>
      <div class="pmx-switch-meta">
        <b>IP:</b> ${escapeHtml(sw.ip||'-')} <em>|</em>
        <b>Uptime:</b> ${escapeHtml(sw.uptime||'-')} <em>|</em>
        <b>Ports:</b> ${ports.length} <em>|</em>
        <b>Active:</b> ${active} <em>|</em>
        <b>Trunk:</b> ${trunk}
      </div>
    </header>
    <div class="pmx-groups">${groupText}</div>
    <div class="pmx-port-grid" style="--pmx-port-cols:${portGridCols};grid-template-columns:repeat(${portGridCols},64px)!important">${printSwitchPortGrid(sw)}</div>
    <h3>Port connection list</h3>
    <table class="pmx-conn-table">
      <colgroup>
        <col class="pmx-col-port"><col class="pmx-col-status"><col class="pmx-col-type"><col class="pmx-col-device"><col class="pmx-col-protocol"><col class="pmx-col-vlan"><col class="pmx-col-ip"><col class="pmx-col-speed"><col class="pmx-col-poe"><col class="pmx-col-connected">
      </colgroup>
      <thead><tr><th>Port</th><th>Status</th><th>Type</th><th>Device / Name</th><th>Protocol</th><th>VLAN</th><th>IP Address</th><th>Speed</th><th>PoE</th><th>Connected To / Role</th></tr></thead>
      <tbody>${printConnectionRows(sw)}</tbody>
    </table>
  </section>`;
}
function printSwitchLinkRows(){
  const links = [];
  const seen = new Set();
  project.ports
    .filter(p=>p.category==='Trunk'||parseTags(p.tags).some(t=>['trunk','uplink','lacp','sfp'].includes(t)))
    .forEach(p=>{
      const sw = bySwitch(p.switchId);
      const conn = p.connection || {};
      const target = conn.switchId ? bySwitch(conn.switchId) : null;
      if(!sw || !target) return;
      const a = `${sw.id}:${p.port}`;
      const b = `${target.id}:${conn.port||''}`;
      const key = [a,b].sort().join('|');
      if(seen.has(key)) return;
      seen.add(key);
      links.push({sw,p,target,remotePort:conn.port||'',speed:p.speed||'',protocol:p.protocol||p.profile||'Trunk',notes:p.notes||''});
    });
  return links.map(l=>`<tr>
    <td>${escapeHtml(l.sw.name)}</td>
    <td>P${escapeHtml(l.p.port)}</td>
    <td>⇄</td>
    <td>${escapeHtml(l.target.name)}</td>
    <td>${l.remotePort?'P'+escapeHtml(l.remotePort):'-'}</td>
    <td>${escapeHtml(l.speed||'-')}</td>
    <td>${escapeHtml(l.protocol||'-')}</td>
    <td>${escapeHtml(l.notes||'')}</td>
  </tr>`).join('');
}
function printSwitchOnlyTopology(){
  const switches = project.switches || [];
  const trunkPorts = project.ports.filter(p=>p.category==='Trunk'||parseTags(p.tags).some(t=>['trunk','uplink','lacp','sfp'].includes(t)));
  const links = [];
  const seen = new Set();
  const adj = new Map();
  switches.forEach(sw=>adj.set(sw.id,[]));

  trunkPorts.forEach(p=>{
    const sw = bySwitch(p.switchId);
    const conn = p.connection || {};
    const target = conn.switchId ? bySwitch(conn.switchId) : null;
    if(!sw || !target) return;
    const a = `${sw.id}:${p.port}`;
    const b = `${target.id}:${conn.port||''}`;
    const key = [a,b].sort().join('|');
    if(seen.has(key)) return;
    seen.add(key);
    const row = {
      sw,
      p,
      target,
      remotePort: conn.port || '',
      speed: p.speed || '',
      protocol: p.protocol || p.profile || 'Trunk',
      notes: p.notes || ''
    };
    links.push(row);
    if(!adj.has(sw.id)) adj.set(sw.id,[]);
    if(!adj.has(target.id)) adj.set(target.id,[]);
    adj.get(sw.id).push({id:target.id,link:row});
    adj.get(target.id).push({id:sw.id,link:row});
  });

  const degree = new Map();
  switches.forEach(sw=>degree.set(sw.id,(adj.get(sw.id)||[]).length));
  const rootSwitch = switches.slice().sort((a,b)=>{
    const aCore = /core/i.test(a.name||'') ? 1 : 0;
    const bCore = /core/i.test(b.name||'') ? 1 : 0;
    if(bCore !== aCore) return bCore - aCore;
    return (degree.get(b.id)||0) - (degree.get(a.id)||0);
  })[0] || null;

      const shortName = sw=>{
    let raw = String(sw?.name || sw?.model || 'Switch');
    raw = raw
      .replace(/^NETGEAR\s+/i,'')
      .replace(/\bM4[0-9]{3}[A-Z0-9-]*\b/ig,' ')
      .replace(/\b[XMG]SM?[0-9]{3,5}[A-Z0-9-]*\b/ig,' ')
      .replace(/\bQSFP-?DD\b/ig,'')
      .replace(/\bSpine\b|\bGateway\b|\bSwitch\b/ig,'')
      .replace(/[\/]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    let label = raw.split(' ').filter(Boolean).slice(0,4).join(' ');
    if(label.length>22) label = label.slice(0,21).trim()+'…';
    return label || String(sw?.id||'Switch');
  };
  const shortNameUnique = (()=>{
    const used = new Map();
    return sw=>{
      const base = shortName(sw);
      let label = base;
      let n = 2;
      while(used.has(label) && used.get(label)!==sw.id){
        const suffix = String(sw?.id||'').replace(/[^a-z0-9]+/ig,'').slice(-3).toUpperCase() || String(n);
        label = (base.length>16 ? base.slice(0,16).trim() : base) + ' ' + suffix;
        n++;
      }
      used.set(label, sw.id);
      return label;
    };
  })();
    
  const modelText = sw=>String(sw?.model || 'Switch').replace(/^NETGEAR\s+/i,'');
  const wrapSvgWords = (value,maxChars=28,maxLines=2)=>{
    const prepared=String(value||'')
      .replace(/([\/\-–—])/g,' $1 ')
      .replace(/\s+/g,' ')
      .trim();
    const words=prepared.split(' ').filter(Boolean);
    const lines=[]; let line='';
    for(const word of words){
      const joinNoSpace=/^[\/\-–—]$/.test(word)||/[\/\-–—]$/.test(line);
      const test=line?(joinNoSpace?line+word:line+' '+word):word;
      if(test.length>maxChars && line){
        lines.push(line.trim());
        line=word;
        if(lines.length>=maxLines-1)break;
      }else line=test;
    }
    if(line&&lines.length<maxLines)lines.push(line.trim());
    if(!lines.length)lines.push('');
    const original=prepared.replace(/\s+([\/\-–—])\s+/g,'$1');
    const current=lines.join(' ').replace(/\s+([\/\-–—])\s+/g,'$1');
    if(original.length>current.length){
      let last=lines[lines.length-1]||'';
      while(last.length>Math.max(4,maxChars-1))last=last.slice(0,-1);
      lines[lines.length-1]=last.replace(/[\s,.;:\-–—\/]+$/,'')+'…';
    }
    return lines;
  };
  const svgTextTspans = (lines,x,y,lineHeight)=>lines.map((line,i)=>`<tspan x="${x}" ${i?`dy="${lineHeight}"`:`y="${y}"`}>${esc(line)}</tspan>`).join('');
  const linkTypeText = l=>{
    const speed = String(l.speed || '').replace(/\s+/g,' ').trim() || '-';
    const proto = String(l.protocol || 'Trunk').replace(/\s+/g,' ').trim();
    return `${speed} · ${proto}`;
  };
  const linkColorKey = l=>{
    const s = `${l.speed||''} ${l.protocol||''}`.toLowerCase();
    if(/lacp/.test(s)) return 'lacp';
    if(/25\s*gbps|sfp28/.test(s)) return 'sfp28';
    if(/sfp\+|fiber|10\s*gbps/.test(s)) return 'sfp';
    return 'other';
  };

  const viewW = 3000;
  const viewH = 1700;
  const nodeW = 290;
  const nodeH = 118;
  const rootAnchor = {x:viewW/2, y:110};
  const cx = viewW/2;
  const cy = 980;
  const rx = 1320;
  const ry = 760;
  // v3.8.53 spacing only: wider canvas and larger left/right/top/bottom spacing. No routing/PDF/PNG change.

  const pos = new Map();
  const nodes = switches.map(sw=>({sw, id:sw.id, x:cx, y:cy, fx:0, fy:0, fixed:false, prefX:cx, prefY:cy}));
  const nodeById = new Map(nodes.map(n=>[n.id,n]));

  if(rootSwitch){
    const rootNode = nodeById.get(rootSwitch.id);
    rootNode.x = rootAnchor.x; rootNode.y = rootAnchor.y;
    rootNode.prefX = rootAnchor.x; rootNode.prefY = rootAnchor.y;
    rootNode.fixed = true;
  }

  const others = nodes.filter(n=>!n.fixed).sort((a,b)=>shortName(a.sw).localeCompare(shortName(b.sw)));
  const n = others.length;
  others.forEach((node,idx)=>{
    const angle = n===1 ? Math.PI/2 : (Math.PI * (0.10 + 0.80*(idx/Math.max(1,n-1))));
    node.x = cx + Math.cos(angle)*rx;
    node.y = cy + Math.sin(angle)*ry*0.55 + 140;
    node.prefX = node.x; node.prefY = node.y;
  });

  const linkPairs = new Map();
  links.forEach(l=>{
    const pairKey = [l.sw.id,l.target.id].sort().join('|');
    if(!linkPairs.has(pairKey)) linkPairs.set(pairKey,[]);
    linkPairs.get(pairKey).push(l);
  });

  const repulsion = 190000;
  const springK = 0.010;
  const anchorK = 0.018;
  const damping = 0.86;
  const maxStep = 16;

  for(let iter=0; iter<260; iter++){
    nodes.forEach(node=>{ node.fx = 0; node.fy = 0; });

    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist2 = Math.max(8000, dx*dx + dy*dy);
        const dist = Math.sqrt(dist2);
        const force = repulsion / dist2;
        const fx = force * dx / dist;
        const fy = force * dy / dist;
        if(!a.fixed){ a.fx += fx; a.fy += fy; }
        if(!b.fixed){ b.fx -= fx; b.fy -= fy; }
      }
    }

    links.forEach(l=>{
      const a = nodeById.get(l.sw.id);
      const b = nodeById.get(l.target.id);
      if(!a || !b) return;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
      const ideal = (rootSwitch && (l.sw.id===rootSwitch.id || l.target.id===rootSwitch.id)) ? 430 : 300;
      const delta = dist - ideal;
      const force = springK * delta;
      const fx = force * dx / dist;
      const fy = force * dy / dist;
      if(!a.fixed){ a.fx += fx; a.fy += fy; }
      if(!b.fixed){ b.fx -= fx; b.fy -= fy; }
    });

    nodes.forEach(node=>{
      if(node.fixed) return;
      node.fx += (node.prefX - node.x) * anchorK;
      node.fy += (node.prefY - node.y) * anchorK;
      node.fx *= damping;
      node.fy *= damping;
      node.x += Math.max(-maxStep, Math.min(maxStep, node.fx));
      node.y += Math.max(-maxStep, Math.min(maxStep, node.fy));
      node.x = Math.max(140, Math.min(viewW-140, node.x));
      node.y = Math.max(250, Math.min(viewH-110, node.y));
    });
  }

  const nodeGapX = 125;
  const nodeGapY = 105;
  for(let pass=0; pass<90; pass++){
    let changed = false;
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a = nodes[i], b = nodes[j];
        const minX = nodeW + nodeGapX;
        const minY = nodeH + nodeGapY;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if(overlapX > 0 && overlapY > 0){
          changed = true;
          if(overlapX < overlapY){
            const push = overlapX / 2 + 2;
            const dir = dx >= 0 ? 1 : -1;
            if(!a.fixed) a.x -= dir * push;
            if(!b.fixed) b.x += dir * push;
          }else{
            const push = overlapY / 2 + 2;
            const dir = dy >= 0 ? 1 : -1;
            if(!a.fixed) a.y -= dir * push;
            if(!b.fixed) b.y += dir * push;
          }
        }
      }
    }
    nodes.forEach(node=>{
      if(node.fixed) return;
      node.x = Math.max(140, Math.min(viewW-140, node.x));
      node.y = Math.max(250, Math.min(viewH-110, node.y));
    });
    if(!changed) break;
  }

  nodes.forEach(node=>pos.set(node.id,{x:node.x,y:node.y}));

  const nodeEdgePoint = (from,to)=>{
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const halfW = nodeW/2 - 10;
    const halfH = nodeH/2 - 10;
    const scale = 1 / Math.max(Math.abs(dx)/halfW || 0, Math.abs(dy)/halfH || 0, 1);
    return {x: from.x + dx*scale, y: from.y + dy*scale};
  };

  const pathForLink = (l, idxInPair, pairCount)=>{
    const a = pos.get(l.sw.id), b = pos.get(l.target.id);
    if(!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    const px = -(dy/len), py = (dx/len);
    const pairOffset = (idxInPair - (pairCount-1)/2) * 28;
    const mid = {x:(a.x+b.x)/2, y:(a.y+b.y)/2};
    const isRootLink = rootSwitch && (l.sw.id===rootSwitch.id || l.target.id===rootSwitch.id);
    const curveLift = isRootLink ? -90 : -48;
    const ctrl = {x:mid.x + px*pairOffset, y:mid.y + py*pairOffset + curveLift};
    const start = nodeEdgePoint(a, ctrl);
    const end = nodeEdgePoint(b, ctrl);
    const t = 0.50;
    const qx = (1-t)*(1-t)*start.x + 2*(1-t)*t*ctrl.x + t*t*end.x;
    const qy = (1-t)*(1-t)*start.y + 2*(1-t)*t*ctrl.y + t*t*end.y;
    const tx = 2*(1-t)*(ctrl.x-start.x) + 2*t*(end.x-ctrl.x);
    const ty = 2*(1-t)*(ctrl.y-start.y) + 2*t*(end.y-ctrl.y);
    let angle = Math.atan2(ty, tx) * 180 / Math.PI;
    if(angle > 90) angle -= 180;
    if(angle < -90) angle += 180;
    return {start, end, ctrl, label:{x:qx,y:qy,angle}, cls:isRootLink?'core':'cross'};
  };

  const esc = v=>escapeHtml(v);
  const linesSvg = [];
  const masksSvg = [];
  const labelsSvg = [];

  // v3.8.51 correct rule only:
  // Links remain in the original v3.8.47 geometry.
  // Switch boxes visually mask/hide any line passing underneath them.
  const boxMaskPad = 8;
  nodes.forEach(n=>{
    masksSvg.push(`<rect x="${n.x-nodeW/2-boxMaskPad}" y="${n.y-nodeH/2-boxMaskPad}" width="${nodeW+boxMaskPad*2}" height="${nodeH+boxMaskPad*2}" rx="14" class="pmx-nl-box-line-mask"/>`);
  });

  linkPairs.forEach((pairLinks)=>{
    pairLinks.sort((a,b)=>String(a.p.port).localeCompare(String(b.p.port), undefined, {numeric:true}));
    pairLinks.forEach((l,idx)=>{
      const geom = pathForLink(l, idx, pairLinks.length);
      if(!geom) return;
      const colorKey = linkColorKey(l);
      const d = `M ${geom.start.x},${geom.start.y} Q ${geom.ctrl.x},${geom.ctrl.y} ${geom.end.x},${geom.end.y}`;
      const labelText = linkTypeText(l);
      linesSvg.push(`<path d="${d}" class="pmx-nl-link ${geom.cls} ${colorKey}"/>`);
      labelsSvg.push(`<text x="${geom.label.x}" y="${geom.label.y}" transform="rotate(${geom.label.angle} ${geom.label.x} ${geom.label.y})" class="pmx-nl-line-label ${colorKey}">${esc(labelText)}</text>`);
    });
  });

  const nodesSvg = switches.map(sw=>{
    const p = pos.get(sw.id) || rootAnchor;
    const ports = portsFor(sw.id);
    const active = ports.filter(printIsActivePort).length;
    const trunks = ports.filter(x=>x.category==='Trunk'||parseTags(x.tags).includes('trunk')).length;
   const titleLines = wrapSvgWords(shortNameUnique(sw),16,2);
    const modelLines = wrapSvgWords(modelText(sw),30,1);
    const metaLines = wrapSvgWords(`IP ${sw.ip||'-'} · ${active}/${ports.length} active · ${trunks} trunk`,34,2);
    return `<g class="pmx-nl-node">
      <rect x="${p.x-nodeW/2}" y="${p.y-nodeH/2}" width="${nodeW}" height="${nodeH}" rx="12" class="pmx-nl-node-box"/>
      <text x="${p.x}" class="pmx-nl-node-title">${svgTextTspans(titleLines,p.x,p.y-34,14)}</text>
      <text x="${p.x}" class="pmx-nl-node-model">${svgTextTspans(modelLines,p.x,p.y+2,10)}</text>
      <text x="${p.x}" class="pmx-nl-node-meta">${svgTextTspans(metaLines,p.x,p.y+22,10)}</text>
    </g>`;
  }).join('');

  const legend = `<div class="pmx-node-link-legend">
    <span style="color:#0ea5e9"><i></i>10 Gbps / SFP+ Fiber</span>
    <span style="color:#f97316"><i></i>25 Gbps / SFP28 Fiber</span>
    <span style="color:#ec4899"><i></i>SFP+ LACP</span>
    <span style="color:#22c55e"><i></i>Other switch link</span>
  </div>`;

  return `<section class="pmx-switch-only-page pmx-node-link-switch-only-page">
    <header>
      <h2>NETGEAR SWITCH-ONLY CONNECTION MAP</h2>
      <p>Node-link diagram: boxed switch nodes only. Link info stays on the line; end devices are hidden.</p>
    </header>
    ${legend}
    <div class="pmx-node-link-frame">
      <svg class="pmx-node-link-svg" viewBox="0 0 ${viewW} ${viewH}" preserveAspectRatio="xMidYMid meet">
        <g class="pmx-nl-links">${linesSvg.join('')}</g>
        <g class="pmx-nl-box-masks">${masksSvg.join('')}</g>
        <g class="pmx-nl-labels">${labelsSvg.join('')}</g>
        <g class="pmx-nl-nodes">${nodesSvg}</g>
      </svg>
    </div>
  </section>`;
}

function renderPrint(){
  const sheet=document.getElementById('printSheet'); if(!sheet)return;
  const active=project.ports.filter(printIsActivePort);
  const trunks=project.ports.filter(p=>p.category==='Trunk'||parseTags(p.tags).some(t=>['trunk','uplink','lacp','sfp'].includes(t)));
  const vlans=[...new Set(active.map(p=>p.vlan).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
  const protocols=[...new Set(active.map(p=>p.protocol).filter(Boolean))].sort();
  const now=new Date().toLocaleString();
  sheet.classList.add('pmx-sheet');
  sheet.innerHTML=`
    <header class="pmx-title">
      <div>
        <h1>${escapeHtml(project.name||project.projectName||'PortMap Project')}</h1>
        <p>Port Map style engineering export · source: current Port Map data · ${escapeHtml(now)}</p>
      </div>
      <div class="pmx-title-stats">
        <span><b>${project.switches.length}</b>Switches</span>
        <span><b>${active.length}/${project.ports.length}</b>Ports</span>
        <span><b>${trunks.length}</b>Trunks</span>
        <span><b>${protocols.length}</b>Protocols</span>
        <span><b>${vlans.length}</b>VLANs</span>
      </div>
    </header>

    <section class="pmx-kpis">${printCategorySummary()}</section>

    <section class="pmx-summary">
      <div class="pmx-box">
        <h2>Protocol Summary</h2>
        <table class="pmx-small-table"><thead><tr><th>Protocol</th><th>Ports</th><th>Category</th><th>VLAN</th></tr></thead><tbody>${printProtocolSummary()}</tbody></table>
      </div>
      <div class="pmx-box">
        <h2>VLAN Summary</h2>
        <table class="pmx-small-table"><thead><tr><th>VLAN</th><th>Ports</th><th>Category</th><th>Protocols</th></tr></thead><tbody>${printVlanSummary()}</tbody></table>
      </div>
    </section>

    <section class="pmx-box pmx-trunks">
      <h2>Trunk / Uplink Links</h2>
      <table class="pmx-small-table"><thead><tr><th>Switch</th><th>Port</th><th>Connected To</th><th>Remote Port</th><th>Speed</th><th>Protocol</th><th>Notes</th></tr></thead><tbody>${printTrunkRows()||'<tr><td colspan="7">No trunk/uplink ports found</td></tr>'}</tbody></table>
    </section>

    <section class="pmx-switches">${project.switches.map(printSwitchBlock).join('')}</section>

    ${printSwitchOnlyTopology()}\n\n    <section class="pmx-legend">
      <b>Legend</b>
      <span class="orange">■ Dante / Audio</span>
      <span class="blue">■ Video</span>
      <span class="purple">■ MTR / Teams</span>
      <span class="cyan">■ AP</span>
      <span class="green">■ IoT / Control</span>
      <span class="red">■ Critical</span>
      <span class="magenta">■ Trunk / Uplink</span>
      <span class="gray">■ Spare / Unused</span>
    </section>
  `;
}


// ── View routing ──────────────────────────────────────────────────────────
function openView(id){
  // Close floating topology UI when changing views so it cannot remain over Port Map, Devices or Print Layout.
  try{topologyHideInfoPopup();topologyClearPathHighlight();}catch(e){}
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active-view',v.id===id));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(id==='topology') renderTopology();
  if(id==='print') renderPrint();
  if(id==='devices') renderDeviceList();
}

// ── Dialogs ───────────────────────────────────────────────────────────────
function installConnectionFields(){
  const form=document.getElementById('editForm');if(!form||!form.elements.targetSwitchId)return;
  const sel=form.elements.targetSwitchId;
  sel.innerHTML='<option value="">—</option>'+project.switches.map(sw=>`<option value="${escapeHtml(sw.id)}">${escapeHtml(sw.name)}</option>`).join('');
}

const PROTOCOL_OPTIONS={
  Dante:['Dante','AES67','AVB/Milan','MADI','Q-SYS','Analog Audio'],
  Video:['NDI','NDI-HX','ST 2110','RTSP','HDMI','SDI','Video IP'],
  MTR:['Teams / MTR','Room Control','API / Control','HTTP','HTTPS','SNMP','PoE'],
  IoT:['API / Control','SSH','HTTP','HTTPS','SNMP','Telnet','PoE'],
  AP:['Wi‑Fi','PoE','SNMP','HTTP','HTTPS'],
  Trunk:['Trunk','Uplink','LACP'],
  Critical:['API / Control','SSH','HTTP','HTTPS','SNMP'],
  Spare:[]
};
function protocolOptionsForCategory(cat){
  return PROTOCOL_OPTIONS[String(cat||'Spare')]||[];
}
function refreshProtocolOptions(category,currentValue=''){
  const form=document.getElementById('editForm');
  const sel=form?.elements?.protocol;
  if(!sel) return;
  const opts=protocolOptionsForCategory(category);
  const extra=currentValue && !opts.includes(currentValue) ? [currentValue] : [];
  const all=['',...opts,...extra];
  sel.innerHTML=all.map(v=>`<option value="${escapeHtml(v)}">${v?escapeHtml(v):'—'}</option>`).join('');
  sel.value=currentValue||'';
}
function installProtocolFieldBehavior(){
  const form=document.getElementById('editForm');
  if(!form || form.dataset.protocolBound==='1') return;
  form.dataset.protocolBound='1';
  const catSel=form.elements.category;
  const protoSel=form.elements.protocol;
  if(!catSel || !protoSel) return;
  catSel.addEventListener('change',()=>{
    const current=protoSel.value||'';
    const opts=protocolOptionsForCategory(catSel.value);
    const next=opts.includes(current)?current:'';
    refreshProtocolOptions(catSel.value,next);
    renderEditTagSuggestions();
  });
}
function defaultProtocolForCategory(cat){
  const opts=protocolOptionsForCategory(cat);
  return opts[0]||'';
}
function openEditDialog(){
  if(!selected)return;
  installConnectionFields();
  installProtocolFieldBehavior();
  installEditTagSuggestions();
  ensurePortTags(selected);
  const editDialog=document.getElementById('editDialog'),editForm=document.getElementById('editForm');
  for(const key of ['status','name','category','vlan','poe','speed','ip','mac','profile','patch','notes','connectionType','connectedTo']){
    if(editForm.elements[key]) editForm.elements[key].value=selected[key]||'';
  }
  refreshProtocolOptions(selected.category, selected.protocol||defaultProtocolForCategory(selected.category));
  refreshVlanSuggestions();
  if(editForm.elements.tags) editForm.elements.tags.value=parseTags(selected.tags).join(', ');
  renderEditTagSuggestions();
  const c=selected.connection||inferConnectionFromLegacy(selected);
  if(editForm.elements.connectedToType) editForm.elements.connectedToType.value=c.type||'device';
  if(editForm.elements.targetSwitchId) editForm.elements.targetSwitchId.value=c.switchId||'';
  if(editForm.elements.targetPort) editForm.elements.targetPort.value=c.port||'';
  if(editForm.elements.connectionRole) editForm.elements.connectionRole.value=c.role||((primaryGraphTag(selected)==='Trunk')?'trunk':'access');
  editForm.elements.critical.checked=!!selected.critical;
  editDialog.showModal();
}
function clearPort(p=selected){if(!p)return;const clear=emptyPort(p.switchId,p.port);Object.keys(clear).forEach(k=>p[k]=clear[k]);}
function openSwitchDialog(sw=null){
  editingSwitchId=sw?.id||null;
  const dialog=document.getElementById('switchDialog'),form=document.getElementById('switchForm');
  document.getElementById('switchDialogTitle').textContent=sw?'Edit Switch':'Add Switch';
  document.getElementById('deleteSwitchBtn').style.display=sw?'inline-flex':'none';
  form.elements.name.value=sw?.name||`SWITCH ${project.switches.length+1}`;
  form.elements.model.value=sw?.model||'USW Pro Max 48 PoE';
  form.elements.role.value=sw?.role||'Other';
  form.elements.ip.value=sw?.ip||'';
  form.elements.ports.value=sw?.ports||48;
  form.elements.rows.value=sw?.rows||2;
  form.elements.sfpPorts.value=sw?.sfpPorts??4;
  form.elements.location.value=sw?.location||'';
  dialog.showModal();
}
function saveSwitchFromDialog(e){
  e.preventDefault();
  const form=document.getElementById('switchForm');
  const data={name:form.elements.name.value.trim()||'SWITCH',model:form.elements.model.value.trim(),role:form.elements.role.value,ip:form.elements.ip.value.trim(),ports:Number(form.elements.ports.value||24),rows:Number(form.elements.rows.value||1),sfpPorts:Number(form.elements.sfpPorts.value||0),location:form.elements.location.value.trim(),uptime:'0d 0h'};
  if(editingSwitchId){const sw=bySwitch(editingSwitchId);Object.assign(sw,data);sw.rows=Math.max(1,sw.rows);syncSwitchPorts(sw);}
  else{const idx=project.switches.length;const sw={id:makeId('sw'),...data,x:Math.min(85,22+idx*15),y:Math.min(72,42+idx*6)};project.switches.push(sw);syncSwitchPorts(sw);}
  document.getElementById('switchDialog').close(); renderAll(); saveLocal();
}
function deleteSwitch(){
  if(!editingSwitchId)return;const sw=bySwitch(editingSwitchId);if(!sw)return;
  if(!confirm(`Delete ${sw.name} and all its ports?`))return;
  project.switches=project.switches.filter(x=>x.id!==editingSwitchId);
  project.ports=project.ports.filter(p=>p.switchId!==editingSwitchId);
  project.topologyDevices.forEach(d=>{if(d.connectedTo===editingSwitchId)d.connectedTo=project.switches[0]?.id||'';});
  closeDetails(); document.getElementById('switchDialog').close(); renderAll(); saveLocal();
}
function promptNewProjectName(){
  const value=prompt('Project name:', 'Untitled PortMap Project');
  if(value===null)return null;
  const name=String(value||'').trim()||'Untitled PortMap Project';
  return name;
}
function newProject(){
  if(!confirm('Create a new blank project and replace the current project? Export first if you want to keep the current project.'))return;
  const projectName=promptNewProjectName();
  if(projectName===null)return;
  project=normalizeProject(createEmptyProject());
  project.name=projectName;
  project.projectName=projectName;
  selected=null;
  renderAll(); closeDetails(); saveLocal(); openView('portmap');
}
function newEmptyProject(){
  if(!confirm('Create a blank project and remove all demo/sample data? Export first to keep the current project.'))return;
  const projectName=promptNewProjectName();
  if(projectName===null)return;
  project=normalizeProject(createEmptyProject());
  project.name=projectName;
  project.projectName=projectName;
  selected=null;
  renderAll(); closeDetails(); saveLocal(); openView('portmap');
}
function openDeviceDialog(){
  const form=document.getElementById('deviceForm'); form.reset();
  form.elements.name.value=''; form.elements.x.value=50; form.elements.y.value=78;
  const sel=document.getElementById('deviceConnectedTo'); sel.innerHTML='';
  project.switches.forEach(sw=>{const opt=document.createElement('option');opt.value=sw.id;opt.textContent=sw.name;sel.appendChild(opt);});
  document.getElementById('deviceDialog').showModal();
}
function saveDeviceFromDialog(e){
  e.preventDefault();const form=document.getElementById('deviceForm');
  project.topologyDevices.push({id:makeId('dev'),name:form.elements.name.value.trim()||'Extra Device',category:form.elements.category.value,icon:form.elements.icon.value,connectedTo:form.elements.connectedTo.value,x:Number(form.elements.x.value||50),y:Number(form.elements.y.value||78),notes:form.elements.notes.value.trim(),tags:parseTags(form.elements.tags?.value||'manual')});
  document.getElementById('deviceDialog').close(); renderAll(); openView('topology'); saveLocal();
}

// ── Export / Import ────────────────────────────────────────────────────────
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
function projectExportFilename(ext='portmap'){
  const raw=(project&&(project.name||project.projectName))||'PortMap_Project';
  const name=String(raw).replace(/[^a-z0-9-_]+/gi,'_').replace(/^_+|_+$/g,'')||'PortMap_Project';
  const safeExt=String(ext||'portmap').replace(/[^a-z0-9]+/gi,'').toLowerCase()||'portmap';
  const d=new Date();
  const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  return `${name}_${stamp}.${safeExt}`;
}
function exportProject(){
  const exportData=JSON.parse(JSON.stringify(project));
  download(projectExportFilename('portmap'),JSON.stringify(exportData,null,2),'application/vnd.portmap');
}


function topologyExportFilename(ext='png'){
  const name=((project&&project.projectName)||'PortMap_Topology').replace(/[^a-z0-9-_]+/gi,'_').replace(/^_+|_+$/g,'');
  const safeExt=String(ext||'png').replace(/[^a-z0-9]+/gi,'').toLowerCase()||'png';
  const d=new Date();
  const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  return `${name||'PortMap_Topology'}_Topology_${stamp}.${safeExt}`;
}
function topologyDownloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename||'topology.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

function topologySvgNum(v){return Number.isFinite(Number(v))?Number(v).toFixed(2).replace(/\.00$/,''):0;}
function topologySvgWrapLines(text,maxChars=26,maxLines=2){
  const words=String(text||'').split(/\s+/).filter(Boolean);
  const lines=[]; let line='';
  for(const word of words){
    const test=line?line+' '+word:word;
    if(test.length>maxChars && line){lines.push(line);line=word;if(lines.length>=maxLines-1)break;}
    else line=test;
  }
  if(line&&lines.length<maxLines)lines.push(line);
  if(words.length&&lines.length===maxLines){
    let last=lines[lines.length-1];
    while(last.length>Math.max(4,maxChars-1))last=last.slice(0,-1);
    if(words.join(' ').length>lines.join(' ').length)last=last.replace(/[\s,.;:-]+$/,'')+'…';
    lines[lines.length-1]=last;
  }
  return lines.length?lines:[''];
}
function topologySvgText(text,x,y,{maxChars=26,maxLines=2,lineHeight=14,size=12,weight=700,fill='#ffffff',anchor='middle',stroke='',strokeWidth=0,italic=false}={}){
  const lines=topologySvgWrapLines(text,maxChars,maxLines);
  const fontFamily='Arial, Helvetica, sans-serif';
  const makeText=(dx=0,dy=0,paint=fill,opacity='')=>{
    let attrs=`x="${topologySvgNum(x+dx)}" y="${topologySvgNum(y+dy)}" text-anchor="${topologyEscape(anchor)}" fill="${topologyEscape(paint)}" font-family="${topologyEscape(fontFamily)}" font-size="${size}" font-weight="${weight}"`;
    if(italic) attrs+=` font-style="italic"`;
    if(opacity) attrs+=` opacity="${opacity}"`;
    let out=`<text ${attrs}>`;
    lines.forEach((line,i)=>{out+=`<tspan x="${topologySvgNum(x+dx)}" dy="${i?lineHeight:0}">${topologyEscape(line)}</tspan>`;});
    out+='</text>';
    return out;
  };
  // Affinity / Photoshop / GIMP safe export: avoid SVG stroke-on-text and CSS-only paint.
  // Some design apps paint thick text strokes above the fill, making white labels look black.
  // Use simple duplicate filled text for a soft dark backing, then a clean foreground text fill.
  if(stroke){
    const shadow=stroke||'#02060b';
    const strong=Number(strokeWidth||0)>=4;
    let out='<g class="pm-svg-safe-text">';
    out+=makeText(1.4,1.4,shadow,strong?'.82':'.72');
    if(strong) out+=makeText(-1.0,1.0,shadow,'.42');
    out+=makeText(0,0,fill,'');
    out+='</g>';
    return out;
  }
  return makeText(0,0,fill,'');
}
function topologySvgRj45Shape(x,y,size,fill='#111820'){
  const w=size,h=size;
  const p=(px,py)=>`${topologySvgNum(x+w*px)},${topologySvgNum(y+h*py)}`;
  let out=`<path d="M${p(.18,.28)} L${p(.34,.28)} L${p(.34,.10)} L${p(.66,.10)} L${p(.66,.28)} L${p(.82,.28)} L${p(.82,.86)} L${p(.18,.86)} Z" fill="${topologyEscape(fill)}"/>`;
  const pins=8,pinW=w*.045,gap=w*.025,total=pins*pinW+(pins-1)*gap,start=x+(w-total)/2;
  for(let i=0;i<pins;i++)out+=`<rect x="${topologySvgNum(start+i*(pinW+gap))}" y="${topologySvgNum(y+h*.70)}" width="${topologySvgNum(pinW)}" height="${topologySvgNum(h*.09)}" fill="#f4f7fb"/>`;
  return out;
}
function topologySvgDefs(){
  return `<defs><pattern id="pmSvgGrid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M 64 0 L 0 0 0 64" fill="none" stroke="#dbe4ee" stroke-opacity="0.75" stroke-width="1"/></pattern><filter id="pmSvgGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
}
function topologySvgBackground(width,height){
  return `<rect x="0" y="0" width="${topologySvgNum(width)}" height="${topologySvgNum(height)}" fill="#ffffff"/><rect x="0" y="0" width="${topologySvgNum(width)}" height="${topologySvgNum(height)}" fill="url(#pmSvgGrid)"/>`;
}
function topologySvgNode(node){
  const cls=node.className||'';
  const x=parseFloat(node.style.left)||0;
  const y=parseFloat(node.style.top)||0;
  const color=topologyNodeColor(node);
  let out=`<g class="${topologyEscape(String(cls).replace(/\s+/g,' '))}">`;
  if(String(cls).includes('tg-switch')){
    out+=`<rect x="${topologySvgNum(x-31)}" y="${topologySvgNum(y-49)}" width="62" height="62" rx="16" fill="#eef4fb" stroke="${topologyEscape(color)}" stroke-width="3" filter="url(#pmSvgGlow)"/>`;
    out+=topologySvgRj45Shape(x-21,y-39,42,'#111820');
    out+=topologySvgText(node.querySelector('b')?.textContent||'',x,y+54,{maxChars:28,maxLines:2,lineHeight:17,size:15,weight:900,fill:'#111827',stroke:'#ffffff',strokeWidth:3});
    out+=topologySvgText(node.querySelector('small')?.textContent||'',x,y+90,{maxChars:36,maxLines:2,lineHeight:13,size:11,weight:500,fill:'#334155',stroke:'#ffffff',strokeWidth:2});
  }else if(String(cls).includes('tg-vlan')||String(cls).includes('tg-protocol')){
    const r=String(cls).includes('tg-vlan')?18:13;
    out+=`<circle cx="${topologySvgNum(x)}" cy="${topologySvgNum(y)}" r="${r}" fill="${topologyEscape(color)}" stroke="#ffffff" stroke-opacity="0.65" stroke-width="2" filter="url(#pmSvgGlow)"/>`;
    out+=topologySvgText(node.querySelector('b')?.textContent||'',x,y+38,{maxChars:28,maxLines:2,lineHeight:21,size:20,weight:900,fill:'#111827',stroke:'#ffffff',strokeWidth:3});
    out+=topologySvgText(node.querySelector('small')?.textContent||'',x,y+82,{maxChars:32,maxLines:2,lineHeight:14,size:12,weight:500,fill:'#334155',stroke:'#ffffff',strokeWidth:2});
  }else if(String(cls).includes('tg-device')){
    out+=`<rect x="${topologySvgNum(x-10)}" y="${topologySvgNum(y-10)}" width="20" height="20" rx="5" fill="#f8fbff" stroke="${topologyEscape(color)}" stroke-width="3" filter="url(#pmSvgGlow)"/>`;
    out+=topologySvgText(node.querySelector('b')?.textContent||'',x,y+28,{maxChars:29,maxLines:2,lineHeight:13,size:12,weight:900,fill:'#111827',stroke:'#ffffff',strokeWidth:3});
    out+=topologySvgText(node.querySelector('em')?.textContent||'',x,y+56,{maxChars:32,maxLines:2,lineHeight:13,size:11,weight:800,fill:'#111827',stroke:'#ffffff',strokeWidth:2,italic:true});
    out+=topologySvgText(node.querySelector('small')?.textContent||'',x,y+84,{maxChars:34,maxLines:2,lineHeight:12,size:10,weight:500,fill:'#334155',stroke:'#ffffff',strokeWidth:2});
  }
  out+='</g>';
  return out;
}
function topologySvgEdge(line){
  const x1=parseFloat(line.getAttribute('x1')||0),y1=parseFloat(line.getAttribute('y1')||0),x2=parseFloat(line.getAttribute('x2')||0),y2=parseFloat(line.getAttribute('y2')||0);
  const cs=getComputedStyle(line);
  const stroke=line.style.stroke||cs.stroke||'#3c8dff';
  const opacity=line.classList.contains('tg-trunk-edge')?0.95:(line.classList.contains('tg-critical-edge')?0.92:.74);
  const width=line.classList.contains('tg-trunk-edge')?3.2:(line.classList.contains('tg-critical-edge')?2.2:1.35);
  const dash=line.classList.contains('tg-trunk-edge')?' stroke-dasharray="16 12"':'';
  return `<line x1="${topologySvgNum(x1)}" y1="${topologySvgNum(y1)}" x2="${topologySvgNum(x2)}" y2="${topologySvgNum(y2)}" stroke="${topologyEscape(stroke)}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"${dash}/>`;
}
function topologySvgBadgeAndLegend(width,height,graph){
  const switches=graph.querySelector('.tg-badge span:nth-of-type(1)')?.textContent||'';
  const active=graph.querySelector('.tg-badge span:nth-of-type(2)')?.textContent||'';
  const protocols=graph.querySelector('.tg-badge span:nth-of-type(3)')?.textContent||'';
  let out=`<g><rect x="22" y="18" width="780" height="32" rx="16" fill="#ffffff" opacity=".94" stroke="#cbd5e1"/>`;
  out+=topologySvgText(`Topology data check: ${switches} · ${active} · ${protocols}`,40,39,{anchor:'start',maxChars:110,maxLines:1,size:12,weight:700,fill:'#334155'});
  const legendY=Math.max(90,height-38);
  out+=`<rect x="22" y="${topologySvgNum(legendY-22)}" width="620" height="32" rx="16" fill="#ffffff" opacity=".94" stroke="#cbd5e1"/>`;
  const items=[['Trunk','#f14fa6'],['Audio','#ff8a24'],['Video','#3c8dff'],['MTR / Teams','#ad64ff'],['AP','#3bd5d8'],['Control','#46c667'],['Critical','#ff4c55']];
  let x=42;
  for(const [label,color] of items){out+=`<circle cx="${x}" cy="${topologySvgNum(legendY-6)}" r="6" fill="${color}"/>`;out+=topologySvgText(label,x+12,legendY-2,{anchor:'start',maxChars:20,maxLines:1,size:12,weight:600,fill:'#334155'});x+=label.length*7.2+46;}
  out+='</g>';
  return out;
}
function exportTopologySvg(){
  const btn=document.getElementById('exportSvgBtn');
  const host=document.getElementById('topologyCanvas');
  const graph=host&&host.querySelector('.tg-graph');
  if(!host||!graph){alert('No topology graph to export.');return;}
  const oldText=btn?btn.textContent:'';
  try{
    if(btn){btn.disabled=true;btn.textContent='Exporting...';}
    const width=Math.max(Math.ceil(graph.offsetWidth||0),Math.ceil(graph.scrollWidth||0),Math.ceil(parseFloat(graph.style.width)||0),Math.ceil(host.scrollWidth||0));
    const height=Math.max(Math.ceil(graph.offsetHeight||0),Math.ceil(graph.scrollHeight||0),Math.ceil(parseFloat(graph.style.height)||0),Math.ceil(host.scrollHeight||0));
    if(!width||!height) throw new Error('Topology export size is empty');
    const svgLayer=graph.querySelector('.tg-svg');
    let body='';
    body+=topologySvgBackground(width,height);
    if(svgLayer){
      body+='<g class="edges">';
      svgLayer.querySelectorAll('line.tg-edge').forEach(line=>{body+=topologySvgEdge(line);});
      body+='</g><g class="edge-labels">';
      svgLayer.querySelectorAll('text.tg-edge-text').forEach(t=>{
        const x=parseFloat(t.getAttribute('x')||0),y=parseFloat(t.getAttribute('y')||0);
        body+=topologySvgText(t.textContent||'',x,y,{maxChars:40,maxLines:1,size:15,weight:900,fill:'#111827',stroke:'#ffffff',strokeWidth:5});
      });
      body+='</g>';
    }
    body+='<g class="nodes">';
    graph.querySelectorAll('.tg-node').forEach(node=>{body+=topologySvgNode(node);});
    body+='</g>';
    body+=topologySvgBadgeAndLegend(width,height,graph);
    const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${topologySvgDefs()}${body}</svg>`;
    topologyDownloadBlob(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),topologyExportFilename('svg'));
  }catch(err){
    console.error('exportTopologySvg failed',err);
    alert('SVG export failed. Check browser console for details.');
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||'Export SVG';}
  }
}

function drawRoundedRect(ctx,x,y,w,h,r,fill,stroke,lineWidth=1){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
}
function drawWrappedText(ctx,text,x,y,maxWidth,lineHeight,maxLines,align='center'){
  const words=String(text||'').split(/\s+/).filter(Boolean);
  const lines=[]; let line='';
  for(const word of words){
    const test=line?line+' '+word:word;
    if(ctx.measureText(test).width>maxWidth && line){
      lines.push(line); line=word;
      if(lines.length>=maxLines-1) break;
    }else line=test;
  }
  if(line && lines.length<maxLines) lines.push(line);
  if(words.length && lines.length===maxLines){
    let last=lines[lines.length-1];
    while(ctx.measureText(last+'…').width>maxWidth && last.length>3) last=last.slice(0,-1);
    lines[lines.length-1]=last+'…';
  }
  ctx.textAlign=align;
  lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));
  return lines.length*lineHeight;
}
function drawRJ45Shape(ctx,x,y,size,fill='#111820'){
  const w=size,h=size;
  ctx.save();
  ctx.fillStyle=fill;
  ctx.beginPath();
  ctx.moveTo(x+w*.18,y+h*.28);
  ctx.lineTo(x+w*.34,y+h*.28);
  ctx.lineTo(x+w*.34,y+h*.10);
  ctx.lineTo(x+w*.66,y+h*.10);
  ctx.lineTo(x+w*.66,y+h*.28);
  ctx.lineTo(x+w*.82,y+h*.28);
  ctx.lineTo(x+w*.82,y+h*.86);
  ctx.lineTo(x+w*.18,y+h*.86);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle='#f4f7fb';
  const pins=8,pinW=w*.045,gap=w*.025,total=pins*pinW+(pins-1)*gap,start=x+(w-total)/2;
  for(let i=0;i<pins;i++) ctx.fillRect(start+i*(pinW+gap),y+h*.70,pinW,h*.09);
  ctx.restore();
}
function drawTopologyExportBackground(ctx,w,h){
  // PNG export should follow the light topology theme: white page, subtle print-friendly grid.
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(15,23,42,.055)';
  ctx.lineWidth=1;
  for(let x=0;x<w;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
}
function topologyNodeColor(node){
  return (node.style.getPropertyValue('--cat')||getComputedStyle(node).getPropertyValue('--cat')||'#3c8dff').trim();
}
function drawTopologyExportNode(ctx,node){
  const cls=node.className||'';
  const left=parseFloat(node.style.left)||0;
  const top=parseFloat(node.style.top)||0;
  const color=topologyNodeColor(node);
  ctx.save();
  ctx.shadowColor=color;
  ctx.shadowBlur=cls.includes('tg-device')?10:18;
  if(cls.includes('tg-switch')){
    const box=62;
    drawRoundedRect(ctx,left-box/2,top-box/2-18,box,box,16,'#eef4fb',color,3);
    drawRJ45Shape(ctx,left-box/2+10,top-box/2-8,42,'#111820');
    ctx.shadowBlur=0;
    ctx.fillStyle='#0f172a';
    ctx.font='900 15px Arial, sans-serif';
    ctx.textAlign='center';
    drawWrappedText(ctx,node.querySelector('b')?.textContent||'',left,top+54,220,17,2);
    ctx.fillStyle='#475569';
    ctx.font='11px Arial, sans-serif';
    drawWrappedText(ctx,node.querySelector('small')?.textContent||'',left,top+90,240,13,2);
  }else if(cls.includes('tg-vlan')||cls.includes('tg-protocol')){
    const r=cls.includes('tg-vlan')?18:13;
    ctx.beginPath();
    ctx.arc(left,top,r,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
    ctx.strokeStyle='rgba(15,23,42,.22)';
    ctx.lineWidth=2;
    ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle='#0f172a';
    ctx.font='900 20px Arial, sans-serif';
    ctx.textAlign='center';
    drawWrappedText(ctx,node.querySelector('b')?.textContent||'',left,top+38,260,21,2);
    ctx.fillStyle='#475569';
    ctx.font='12px Arial, sans-serif';
    drawWrappedText(ctx,node.querySelector('small')?.textContent||'',left,top+82,260,14,2);
  }else if(cls.includes('tg-device')){
    const box=20;
    drawRoundedRect(ctx,left-box/2,top-box/2,box,box,5,'#f8fbff',color,3);
    ctx.shadowBlur=0;
    ctx.fillStyle='#0f172a';
    ctx.font='900 12px Arial, sans-serif';
    ctx.textAlign='center';
    const b=node.querySelector('b')?.textContent||'';
    const em=node.querySelector('em')?.textContent||'';
    const small=node.querySelector('small')?.textContent||'';
    drawWrappedText(ctx,b,left,top+28,220,13,2);
    ctx.font='800 11px Arial, sans-serif';
    drawWrappedText(ctx,em,left,top+56,230,13,2);
    ctx.fillStyle='#475569';
    ctx.font='10px Arial, sans-serif';
    drawWrappedText(ctx,small,left,top+84,230,12,2);
  }
  ctx.restore();
}
async function exportTopologyPng(){
  const btn=document.getElementById('exportPngBtn');
  const host=document.getElementById('topologyCanvas');
  const graph=host&&host.querySelector('.tg-graph');
  if(!host||!graph){alert('No topology graph to export.');return;}
  const oldText=btn?btn.textContent:'';
  try{
    if(btn){btn.disabled=true;btn.textContent='Exporting...';}
    const width=Math.max(Math.ceil(graph.offsetWidth||0),Math.ceil(graph.scrollWidth||0),Math.ceil(parseFloat(graph.style.width)||0),Math.ceil(host.scrollWidth||0));
    const height=Math.max(Math.ceil(graph.offsetHeight||0),Math.ceil(graph.scrollHeight||0),Math.ceil(parseFloat(graph.style.height)||0),Math.ceil(host.scrollHeight||0));
    if(!width||!height) throw new Error('Topology export size is empty');

    // PNG export only: keep the existing topology layout, but push resolution as high as the browser can safely handle.
    // We try the largest practical canvas sizes first, then fall back step-by-step if the browser rejects them.
    // For giant topology graphs the browser canvas still has a hard limit, so this maximizes quality without changing layout.
    const qualitySteps=[
      {maxSide:32760,maxPixels:268000000,maxScale:6},
      {maxSide:30000,maxPixels:220000000,maxScale:5},
      {maxSide:26000,maxPixels:180000000,maxScale:4},
      {maxSide:22000,maxPixels:120000000,maxScale:3},
      {maxSide:18000,maxPixels:80000000,maxScale:2},
      {maxSide:14000,maxPixels:48000000,maxScale:1.5},
      {maxSide:10000,maxPixels:24000000,maxScale:1}
    ];
    const scales=[];
    for(const step of qualitySteps){
      const bySide=step.maxSide/Math.max(width,height,1);
      const byPixels=Math.sqrt(step.maxPixels/Math.max(width*height,1));
      const s=Math.max(0.08,Math.min(step.maxScale,bySide,byPixels));
      if(!scales.some(x=>Math.abs(x-s)<0.01)) scales.push(s);
    }

    const svg=graph.querySelector('.tg-svg');
    const drawToCanvas=(canvas,ctx,scale)=>{
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      drawTopologyExportBackground(ctx,width,height);

      if(svg){
        ctx.save();
        svg.querySelectorAll('line.tg-edge').forEach(line=>{
          const x1=parseFloat(line.getAttribute('x1')||0),y1=parseFloat(line.getAttribute('y1')||0),x2=parseFloat(line.getAttribute('x2')||0),y2=parseFloat(line.getAttribute('y2')||0);
          const cs=getComputedStyle(line);
          const stroke=line.style.stroke||cs.stroke||'#3c8dff';
          ctx.beginPath();
          ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
          ctx.strokeStyle=stroke;
          ctx.globalAlpha=parseFloat(cs.opacity||line.getAttribute('opacity')||.72)||.72;
          ctx.lineWidth=line.classList.contains('tg-trunk-edge')?3.2:(line.classList.contains('tg-critical-edge')?2.2:1.35);
          if(line.classList.contains('tg-trunk-edge')) ctx.setLineDash([16,12]); else ctx.setLineDash([]);
          ctx.shadowColor=stroke;ctx.shadowBlur=4;
          ctx.stroke();
        });
        ctx.restore();
        ctx.save();
        ctx.shadowColor='rgba(255,255,255,.95)';
        ctx.shadowBlur=3;
        ctx.fillStyle='#0f172a';
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=5;
        ctx.textAlign='center';
        ctx.font='900 15px Arial, sans-serif';
        svg.querySelectorAll('text.tg-edge-text').forEach(t=>{
          const x=parseFloat(t.getAttribute('x')||0),y=parseFloat(t.getAttribute('y')||0);
          const s=t.textContent||'';
          ctx.strokeText(s,x,y);
          ctx.fillText(s,x,y);
        });
        ctx.restore();
      }
      ctx.globalAlpha=1;
      graph.querySelectorAll('.tg-node').forEach(node=>drawTopologyExportNode(ctx,node));
    };

    let pngBlob=null,lastError=null;
    for(const scale of scales){
      try{
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*scale));
        canvas.height=Math.max(1,Math.round(height*scale));
        const ctx=canvas.getContext('2d');
        if(!ctx) throw new Error('Canvas context unavailable');
        drawToCanvas(canvas,ctx,scale);
        pngBlob=await new Promise(resolve=>{
          try{canvas.toBlob(resolve,'image/png');}
          catch(e){lastError=e;resolve(null);}
        });
        if(pngBlob) break;
      }catch(e){
        lastError=e;
        pngBlob=null;
      }
    }
    if(!pngBlob) throw lastError||new Error('PNG export failed');
    topologyDownloadBlob(pngBlob,topologyExportFilename('png'));
  }catch(err){
    console.error('exportTopologyPng failed',err);
    alert('PNG export failed. Check browser console for details.');
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||'Export PNG';}
  }
}

function exportCsv(){
  const rows=[['Switch','Port','Status','Name','Category','VLAN','PoE','Speed','IP','MAC','Connected To','Notes'],
    ...project.ports.map(p=>[bySwitch(p.switchId)?.name||'',p.port,p.status,p.name,p.category,p.vlan,p.poe,p.speed,p.ip,p.mac,p.connectedTo,p.notes])];
  download('portmap_ports.csv',rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv');
}
function importProject(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      project=normalizeProject(parsed);
      normalizeConnectionModel(project);
      selected=null; renderAll(); closeDetails(); saveLocal();
    }catch(err){alert('Invalid PortMap project file: '+err.message);}
  };
  r.readAsText(f);
  e.target.value=''; // reset so same file can be re-imported
}

// ── Save port from edit dialog ─────────────────────────────────────────────
function savePortFromDialog(e){
  e.preventDefault();if(!selected)return;
  const form=document.getElementById('editForm');
  for(const key of ['status','name','category','protocol','vlan','poe','speed','ip','mac','profile','patch','tags','notes','connectionType','connectedTo']){
    if(form.elements[key]) selected[key]=form.elements[key].value;
  }
  selected.critical=form.elements.critical.checked;
  const type=form.elements.connectedToType?.value||(selected.category==='Trunk'?'switch':'device');
  const targetSwitchId=form.elements.targetSwitchId?.value||'';
  const targetPort=form.elements.targetPort?.value?Number(form.elements.targetPort.value):'';
  const role=form.elements.connectionRole?.value||((selected.category==='Trunk')?'trunk':'access');
  selected.connection={type,switchId:targetSwitchId,port:targetPort,name:selected.connectedTo||selected.name||'',role};
  if(type==='switch'&&targetSwitchId){
    selected.connectedTo=targetSwitchId; selected.category='Trunk';
    const tags=new Set(parseTags(selected.tags));['trunk','linked',role].forEach(t=>tags.add(t));selected.tags=[...tags];
  }else{
    selected.connection.name=selected.connectedTo||selected.name||'';
    selected.tags=parseTags(selected.tags);
  }
  if(selected.status==='Available'){selected.category='Spare';selected.poe='Off';selected.speed=selected.speed||'—';}
  ensurePortTags(selected);
  const dlg=document.getElementById('editDialog');
  if(dlg && dlg.open) dlg.close();
  renderAll();
  saveLocal();
}

// ── Render all ────────────────────────────────────────────────────────────
function renderAll(){
  ensureAllTags(); normalizeConnectionModel(project); installConnectionFields();
  document.getElementById('topProjectName').textContent=project.name;
  document.getElementById('sideProjectName').textContent=project.name;
  renderSwitches(); if(selected)renderDetails(); renderTable(); renderMiniTopo(); renderTopology(); renderPrint(); renderDeviceList();
}

// ── Events ────────────────────────────────────────────────────────────────
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view]');if(nav)openView(nav.dataset.view);
  const swBtn=e.target.closest('[data-edit-switch]');if(swBtn)openSwitchDialog(bySwitch(swBtn.dataset.editSwitch));
});
document.querySelectorAll('.switch-filter button').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.switch-filter button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); activeSwitchFilter=btn.dataset.filter; renderSwitches(); renderTable();
}));
document.getElementById('portFilter').addEventListener('input',e=>updatePortFilterValue(e.target.value));
document.getElementById('switchSearchFilter')?.addEventListener('input',()=>{renderSwitches();renderTable();});
document.getElementById('portSearchTabBtn')?.addEventListener('click',()=>setPortListSearchActive(true));
document.getElementById('portListTabBtn')?.addEventListener('click',()=>setPortListSearchActive(false));
document.getElementById('tableSearchInput')?.addEventListener('input',e=>updatePortFilterValue(e.target.value));
document.getElementById('clearTableSearchBtn')?.addEventListener('click',()=>{updatePortFilterValue('');setPortListSearchActive(false);});
const globalSearch=document.getElementById('globalSearch');if(globalSearch)globalSearch.addEventListener('input',e=>{updatePortFilterValue(e.target.value);openView('portmap');});
document.getElementById('showAllPorts').addEventListener('change',()=>{renderSwitches();renderTable();});
document.getElementById('closeDetailsBtn').addEventListener('click',closeDetails);
installProtocolFieldBehavior();
document.getElementById('editPortBtn').addEventListener('click',openEditDialog);
document.getElementById('clearPortBtn').addEventListener('click',()=>{if(selected&&confirm('Remove this device from the port and mark it Available?')){clearPort();renderAll();saveLocal();}});
document.getElementById('clearFromDialog').addEventListener('click',()=>{clearPort();document.getElementById('editDialog').close();renderAll();saveLocal();});
document.getElementById('savePortEdit').addEventListener('click',savePortFromDialog);
document.getElementById('addSwitchBtn').addEventListener('click',()=>openSwitchDialog());
document.getElementById('addSwitchTopBtn').addEventListener('click',()=>openSwitchDialog());
document.getElementById('saveSwitchBtn').addEventListener('click',saveSwitchFromDialog);
document.getElementById('deleteSwitchBtn').addEventListener('click',deleteSwitch);
document.getElementById('addTopologyDeviceBtn')?.addEventListener('click',openDeviceDialog);
document.getElementById('addDeviceTopBtn').addEventListener('click',openDeviceDialog);
document.getElementById('saveDeviceBtn').addEventListener('click',saveDeviceFromDialog);
document.getElementById('fitTopologyBtn').addEventListener('click',fitTopology);
document.getElementById('topologyZoomOutBtn').addEventListener('click',()=>setTopologyZoom(topologyZoom-.08));
document.getElementById('topologyZoomInBtn').addEventListener('click',()=>setTopologyZoom(topologyZoom+.08));
document.getElementById('topologyResetZoomBtn').addEventListener('click',()=>setTopologyZoom(1));
document.querySelector('.topology-scroll').addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();setTopologyZoom(topologyZoom+(e.deltaY<0?.03:-.03));},{passive:false});
document.getElementById('newProjectBtn')?.addEventListener('click',newProject);
document.getElementById('newProjectPageBtn')?.addEventListener('click',newProject);
document.getElementById('exportPngBtn')?.addEventListener('click',exportTopologyPng);
document.getElementById('exportSvgBtn')?.addEventListener('click',exportTopologySvg);
document.getElementById('printBtn').addEventListener('click',()=>{openView('print');renderPrint();setTimeout(()=>window.print(),150);});
document.getElementById('browserPrintBtn').addEventListener('click',()=>{renderPrint();openView('print');setTimeout(()=>window.print(),80);});
document.getElementById('refreshPrintBtn').addEventListener('click',renderPrint);
document.getElementById('saveLocalBtn').addEventListener('click',saveLocal);
document.getElementById('exportProjectBtn').addEventListener('click',exportProject);
document.getElementById('exportCsvBtn').addEventListener('click',exportCsv);
document.getElementById('importProjectInput').addEventListener('change',importProject);

// ── Boot ──────────────────────────────────────────────────────────────────
normalizeConnectionModel(project);
renderAll();
closeDetails();
