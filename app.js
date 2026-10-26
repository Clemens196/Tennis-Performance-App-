(function(){
'use strict';

var KEY='tennisPerformanceAppV2';
var THEME_KEY='tennisPerformanceTheme';
function applyTheme(mode){document.documentElement.setAttribute('data-theme',mode);try{localStorage.setItem(THEME_KEY,mode);}catch(e){}var b=document.getElementById('themeToggle');if(b){b.textContent=mode==='dark'?'☀️ Light':'🌙 Dark';b.setAttribute('aria-label',mode==='dark'?'Hellen Modus einschalten':'Dunklen Modus einschalten');}}
function toggleTheme(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');}
try{applyTheme(localStorage.getItem(THEME_KEY)==='light'?'light':'dark');}catch(e){applyTheme('dark');}
var SYNC_META_KEY='tennisPerformanceSyncMeta1';
var SUPA_URL='https://iaybeakhwbfkqezgvhtz.supabase.co';
var SUPA_KEY='sb_publishable_q99yQ_VDZtcE3phsaWilSg_3FuWLRJF';
var sync={
  client:null,user:null,ready:false,pushTimer:null,channel:null,
  lastCloudUpdatedAt:null,suppress:false,pushing:false,dirty:false
};
var state={
  route:'start',
  matchTab:'overview',
  matchSelected:null,
  month:new Date(),
  range:'month',
  planTab:'week',
  libraryFilter:'suggested',
  libraryQuery:'',
  data:load(),
  active:null,
  timer:null,
  timerEnd:0,
  chartExercise:'',
  exerciseDevelopmentExercise:''
};

function fresh(){
  return {version:2,logs:{},sat:{},substitutions:{},settings:{analysisStartDate:'2026-10-26'},createdAt:new Date().toISOString()};
}
function load(){
  try{
    var x=JSON.parse(localStorage.getItem(KEY)||'null');
    if(x&&x.version===2&&x.logs)return x;
  }catch(e){}
  return fresh();
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state.data));}catch(e){}
  if(sync&&sync.user&&!sync.suppress){
    sync.dirty=true;
    scheduleCloudPush(650);
  }
}

function cloneData(x){
  try{return JSON.parse(JSON.stringify(x));}catch(e){return fresh();}
}
function mergeStates(base,over){
  base=base||{};over=over||{};
  var out=fresh();
  out.version=2;
  out.logs=Object.assign({},base.logs||{},over.logs||{});
  out.sat=Object.assign({},base.sat||{},over.sat||{});
  out.substitutions=Object.assign({},base.substitutions||{},over.substitutions||{});
  out.settings=Object.assign({},base.settings||{},over.settings||{});
  out.createdAt=base.createdAt||over.createdAt||out.createdAt;
  return out;
}
function meaningfulData(x){
  if(!x)return false;
  return Object.keys(x.logs||{}).length>0||
    Object.keys(x.sat||{}).length>0||
    Object.keys(x.substitutions||{}).length>0||
    Object.keys(x.settings||{}).length>0;
}
function syncMeta(){
  try{return JSON.parse(localStorage.getItem(SYNC_META_KEY)||'{}')||{};}catch(e){return{};}
}
function storeSyncMeta(){
  try{localStorage.setItem(SYNC_META_KEY,JSON.stringify({
    userId:sync.user?sync.user.id:null,
    lastCloudUpdatedAt:sync.lastCloudUpdatedAt||null
  }));}catch(e){}
}
function setSyncStatus(label,kind){
  var b=document.getElementById('syncStatus');
  if(!b)return;
  b.textContent=label;
  b.className='sync '+(kind||'sync-off');
}
function clearCloudChannel(){
  if(sync.channel&&sync.client){
    try{sync.client.removeChannel(sync.channel);}catch(e){}
  }
  sync.channel=null;
}
function initSync(){
  var btn=document.getElementById('syncStatus');
  if(btn)btn.onclick=openSyncDialog;
  if(!window.supabase||!window.supabase.createClient){
    setSyncStatus('Sync nicht verfügbar','sync-error');
    return;
  }
  try{
    sync.client=window.supabase.createClient(SUPA_URL,SUPA_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    sync.client.auth.onAuthStateChange(function(event,session){
      setTimeout(function(){handleSession(session);},0);
    });
    sync.client.auth.getSession().then(function(res){
      handleSession(res&&res.data?res.data.session:null);
    }).catch(function(){
      setSyncStatus('Sync Fehler','sync-error');
    });
    window.addEventListener('online',function(){
      if(sync.user){pullCloud();scheduleCloudPush(200);}
    });
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='visible'&&sync.user)pullCloud();
    });
  }catch(e){
    setSyncStatus('Sync Fehler','sync-error');
  }
}
function handleSession(session){
  var user=session&&session.user?session.user:null;
  if(!user){
    clearCloudChannel();
    sync.user=null;sync.ready=false;sync.lastCloudUpdatedAt=null;
    setSyncStatus('Sync: anmelden','sync-off');
    return;
  }
  var changed=!sync.user||sync.user.id!==user.id;
  sync.user=user;
  if(changed||!sync.ready)initialCloudSync();
}
function initialCloudSync(){
  if(!sync.client||!sync.user)return;
  setSyncStatus('Synchronisiere…','sync-busy');
  var meta=syncMeta();
  var sameOrFirst=!meta.userId||meta.userId===sync.user.id;
  var local=sameOrFirst?cloneData(state.data):fresh();
  sync.client.from('user_app_state').select('data,updated_at,client_modified_at')
    .eq('user_id',sync.user.id).maybeSingle()
    .then(function(res){
      if(res.error)throw res.error;
      if(!res.data){
        state.data=local;
        sync.ready=true;
        subscribeCloud();
        return pushCloudNow();
      }
      var remote=res.data.data||fresh();
      var merged=sameOrFirst?mergeStates(remote,local):cloneData(remote);
      sync.suppress=true;state.data=merged;save();sync.suppress=false;
      sync.lastCloudUpdatedAt=res.data.updated_at||null;
      storeSyncMeta();
      sync.ready=true;
      sync.dirty=JSON.stringify(merged)!==JSON.stringify(remote);
      subscribeCloud();
      if(!state.active)render();
      if(sync.dirty)return pushCloudNow();
      setSyncStatus('Synchronisiert','sync-ok');
    })
    .catch(function(){
      sync.ready=false;
      setSyncStatus('Sync Fehler','sync-error');
    });
}
function scheduleCloudPush(delay){
  if(!sync.user||!sync.client)return;
  if(sync.pushTimer)clearTimeout(sync.pushTimer);
  sync.pushTimer=setTimeout(function(){
    sync.pushTimer=null;pushCloudNow();
  },typeof delay==='number'?delay:650);
}
function pushCloudNow(){
  if(!sync.user||!sync.client||sync.pushing)return Promise.resolve();
  sync.pushing=true;
  sync.dirty=false;
  setSyncStatus('Synchronisiere…','sync-busy');
  var snapshot=cloneData(state.data);
  return sync.client.from('user_app_state').select('data,updated_at')
    .eq('user_id',sync.user.id).maybeSingle()
    .then(function(res){
      if(res.error)throw res.error;
      var merged=res.data&&res.data.data?mergeStates(res.data.data,snapshot):snapshot;
      var stamp=new Date().toISOString();
      return sync.client.from('user_app_state').upsert({
        user_id:sync.user.id,
        data:merged,
        client_modified_at:stamp
      },{onConflict:'user_id'}).select('updated_at').single()
      .then(function(w){
        if(w.error)throw w.error;
        sync.suppress=true;state.data=merged;save();sync.suppress=false;
        sync.lastCloudUpdatedAt=w.data&&w.data.updated_at?w.data.updated_at:stamp;
        storeSyncMeta();
        sync.pushing=false;
        if(!state.active)render();
        if(sync.dirty)scheduleCloudPush(250);
        else setSyncStatus('Synchronisiert','sync-ok');
      });
    })
    .catch(function(){
      sync.pushing=false;
      sync.dirty=true;
      setSyncStatus(navigator.onLine?'Sync Fehler':'Offline','sync-error');
    });
}
function pullCloud(){
  if(!sync.user||!sync.client||sync.pushing)return;
  sync.client.from('user_app_state').select('data,updated_at')
    .eq('user_id',sync.user.id).maybeSingle()
    .then(function(res){
      if(res.error||!res.data)return;
      var incoming=res.data.data||fresh();
      var merged=(sync.dirty||sync.pushing)?mergeStates(incoming,state.data):mergeStates(state.data,incoming);
      var changed=JSON.stringify(merged)!==JSON.stringify(state.data);
      sync.suppress=true;state.data=merged;save();sync.suppress=false;
      sync.lastCloudUpdatedAt=res.data.updated_at||sync.lastCloudUpdatedAt;
      storeSyncMeta();
      if(changed&&!state.active)render();
      if(sync.dirty)scheduleCloudPush(300);
      else setSyncStatus('Synchronisiert','sync-ok');
    });
}
function subscribeCloud(){
  clearCloudChannel();
  if(!sync.user||!sync.client)return;
  sync.channel=sync.client.channel('training-sync-'+sync.user.id)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'user_app_state',
      filter:'user_id=eq.'+sync.user.id
    },function(payload){
      var u=payload&&payload.new?payload.new.updated_at:null;
      if(!u||u!==sync.lastCloudUpdatedAt)pullCloud();
    }).subscribe();
}
function authMessage(msg){
  var x=document.getElementById('authMsg');
  if(x)x.textContent=msg||'';
}
function openSyncDialog(){
  if(!sync.client){
    overlay.innerHTML='<div class="overlay"><div class="sheet authbox"><button class="close" id="closeAuth">×</button><h2>Synchronisation</h2><div class="authmsg">Supabase konnte auf diesem Gerät noch nicht geladen werden. Prüfe die Internetverbindung und öffne die App erneut.</div></div></div>';
    document.getElementById('closeAuth').onclick=function(){overlay.innerHTML='';};
    return;
  }
  if(sync.user){
    overlay.innerHTML='<div class="overlay"><div class="sheet authbox"><button class="close" id="closeAuth">×</button>'+
      '<div class="eyebrow">CLOUD-SYNC</div><h2>Synchronisation aktiv</h2>'+
      '<p class="authuser">'+esc(sync.user.email||'Angemeldet')+'</p>'+
      '<div class="notice">Mit demselben Konto auf iPhone und iPad anmelden. Änderungen werden automatisch synchronisiert; offline arbeitet die App weiterhin lokal.</div>'+
      '<div class="actions"><button class="btn primary" id="syncNow">Jetzt synchronisieren</button><button class="btn danger" id="signOut">Abmelden</button></div>'+
      '<div id="authMsg" class="authmsg">Status: '+(sync.ready?'bereit':'wird verbunden')+'</div></div></div>';
    document.getElementById('closeAuth').onclick=function(){overlay.innerHTML='';};
    document.getElementById('syncNow').onclick=function(){authMessage('Synchronisiere …');pullCloud();scheduleCloudPush(100);};
    document.getElementById('signOut').onclick=function(){
      authMessage('Melde ab …');
      sync.client.auth.signOut().then(function(){overlay.innerHTML='';});
    };
    return;
  }
  overlay.innerHTML='<div class="overlay"><div class="sheet authbox"><button class="close" id="closeAuth">×</button>'+
    '<div class="eyebrow">IPHONE ↔ IPAD</div><h2>Cloud-Synchronisation</h2>'+
    '<div class="field"><label>E-Mail</label><input id="authEmail" type="email" autocomplete="email" placeholder="deine@email.de"></div>'+
    '<div class="field"><label>Passwort</label><input id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="mind. 6 Zeichen"></div>'+
    '<div class="actions"><button class="btn primary" id="signIn">Anmelden</button><button class="btn" id="signUp">Konto erstellen</button></div>'+
    '<div id="authMsg" class="authmsg">Auf beiden Geräten später dieselbe E-Mail und dasselbe Passwort verwenden.</div></div></div>';
  document.getElementById('closeAuth').onclick=function(){overlay.innerHTML='';};
  document.getElementById('signIn').onclick=function(){
    var email=document.getElementById('authEmail').value.trim();
    var password=document.getElementById('authPassword').value;
    if(!email||password.length<6){authMessage('Bitte E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben.');return;}
    authMessage('Anmeldung läuft …');
    sync.client.auth.signInWithPassword({email:email,password:password}).then(function(res){
      if(res.error)authMessage('Anmeldung fehlgeschlagen: '+res.error.message);
      else authMessage('Angemeldet. Daten werden synchronisiert …');
    });
  };
  document.getElementById('signUp').onclick=function(){
    var email=document.getElementById('authEmail').value.trim();
    var password=document.getElementById('authPassword').value;
    if(!email||password.length<6){authMessage('Bitte E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben.');return;}
    authMessage('Konto wird erstellt …');
    sync.client.auth.signUp({email:email,password:password}).then(function(res){
      if(res.error){authMessage('Konto konnte nicht erstellt werden: '+res.error.message);return;}
      if(res.data&&res.data.session)authMessage('Konto erstellt und angemeldet. Sync startet …');
      else authMessage('Bestätigungs-Mail gesendet. Mail bestätigen, danach diese App wieder öffnen und anmelden.');
    });
  };
}
function pad(n){return n<10?'0'+n:String(n);}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseIso(s){var a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2]);}
function add(d,n){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x;}
function startWeek(d){var x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function weekNo(d){var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);var y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y)/86400000)+1)/7);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(d,opt){
  var wd=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  var wds=['So','Mo','Di','Mi','Do','Fr','Sa'];
  var mo=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var out=[];
  if(opt&&opt.weekday)out.push(opt.weekday==='short'?wds[d.getDay()]:wd[d.getDay()]);
  if(opt&&opt.day)out.push(pad(d.getDate())+(opt.month==='2-digit'?'.':''));
  if(opt&&opt.month==='long')out.push(mo[d.getMonth()]);
  else if(opt&&opt.month==='2-digit')out.push(pad(d.getMonth()+1)+(opt.year?'.':''));
  if(opt&&opt.year)out.push(String(d.getFullYear()));
  return out.join(' ');
}
function ex(id,name,target,desc,type,sets,rest,metric,alts){
  return {id:id,name:name,target:target,desc:desc,type:type,sets:sets||1,rest:rest||60,metric:metric||'reps',alts:alts||[]};
}

var E={
cmj:ex('cmj','Countermovement Jumps','3 × 4','Schnell laden, maximal vertikal abspringen, weich landen und vor jeder Wiederholung stabilisieren.','power',3,120,'quality',['Squat Jumps']),
lat:ex('lat','Lateral Bounds','3 × 4 je Seite','Explosiv seitlich von einem Bein auf das andere springen; Landung kontrollieren.','power',3,120,'quality',['Skater Jumps']),
plyo:ex('plyo','Explosive Liegestütze','3 × 4–6','Rumpf fest, kontrolliert absenken, maximal explosiv wegdrücken; bei Tempoverlust Satz beenden.','power',3,120,'quality',['Explosive erhöhte Liegestütze']),
squat:ex('squat','Langhantel-Kniebeugen','3 × 3–5','Sauber und schwer, etwa 2 Wiederholungen in Reserve.','strength',3,210,'load',['Goblet Squat','Front Squat']),
calf:ex('calf','Wadenheben stehend','2 × 8–12','Voller kontrollierter Bewegungsumfang, oben kurz stabilisieren.','strength',2,75,'load',['Einbeiniges Wadenheben']),
pallof:ex('pallof','Pallof Press','2 × 8 je Seite','Seitlich zu Kabel/Band stehen, Arme ausstrecken und Rotation verhindern.','strength',2,75,'load',['Band Pallof Press']),
tennis:ex('tennis','Tennistraining','Reguläre Einheit','Dauer, Intensität und Beingefühl dokumentieren.','tennis',1,0,'tennis'),
intervals:ex('intervals','Tennisspezifische Intervalle','2 Serien × 5 × 15 Sek. / 45 Sek. Pause','15 Sek. intensive tennisspezifische Beinarbeit, 45 Sek. locker; 3 Min. Serienpause. Vormittags locker dosieren.','endurance',1,0,'endurance'),
broad:ex('broad','Standing Broad Jumps','3 × 3','Explosiv nach vorne springen und stabil auf beiden Füßen landen.','power',3,120,'quality',['Box Jump']),
rot:ex('rot','Seitliche Medizinball-Rotationswürfe','3 × 4 je Seite','Beine/Hüfte leiten ein, Rumpf explosiv rotieren, Ball schnell gegen geeignete Wand werfen.','power',3,105,'quality',['Band-Rotationszug explosiv']),
chest:ex('chest','Medizinball-Brustpässe','3 × 4','Aus Brusthöhe maximal explosiv nach vorne werfen.','power',3,105,'quality',['Explosive Liegestütze']),
slam:ex('slam','Medizinball Overhead Slams','3 × 5','Ball über Kopf führen und explosiv zum Boden werfen; Rumpf und Hüfte mitnehmen.','power',3,120,'quality',['Band Pulldown explosiv']),
copen:ex('copen','Copenhagen Plank','2 × 15–25 Sek. je Seite','Seitstütz, oberes Knie auf Bank, Becken anheben und stabil halten.','stability',2,75,'time',['Adduktoren-Sideplank']),
bandwalk:ex('bandwalk','Miniband Side Walks','2 × 10–12 Schritte je Seite','Leicht gebeugte Knie, Bandspannung halten und kontrolliert seitwärts gehen.','stability',2,60,'reps',['Monster Walks']),
mob:ex('mob','Allgemeine Mobilisation','5 Min.','Armkreisen, Beinpendel und lockere Ganzkörpermobilisation.','mobility',1,0,'note'),
hip90:ex('hip90','90/90 Hip Switches','2 × 8 Wechsel','Kontrollierte Hüftrotation ohne Schwung.','mobility',2,30,'reps'),
cossack:ex('cossack','Cossack Squats','2 × 6 je Seite','Breiter Stand, kontrolliert seitlich absenken.','mobility',2,45,'reps'),
knee:ex('knee','Knee-to-Wall','2 × 10 je Seite','Knie Richtung Wand führen, Ferse bleibt am Boden.','mobility',2,30,'reps'),
calfstretch:ex('calfstretch','Wadendehnung','2 × 30 Sek. je Seite','Ferse unten, sanft nach vorne verlagern.','mobility',2,30,'time'),
open:ex('open','Open Books','1 × 8 je Seite','Brustwirbelsäule rotieren, Becken stabil halten.','mobility',1,30,'reps'),
wall:ex('wall','Wall Slides','2 × 10','Arme kontrolliert an der Wand nach oben führen, nicht ins Hohlkreuz ausweichen.','mobility',2,45,'reps'),
ero:ex('ero','Schulter-Außenrotation am Kabelzug','2 × 12–15 je Seite','Ellenbogen ca. 90° nah am Körper, Unterarm nach außen rotieren, Oberkörper ruhig; leicht bis moderat und schmerzfrei.','strength',2,75,'load',['Band-Außenrotation']),
cool:ex('cool','Lockeres Cool-down','6 Min.','Ruhige Schulter-/Hüftbewegungen und entspannte Atmung.','mobility',1,0,'note'),
pull:ex('pull','Klimmzüge','3 × 6–10','Sauber aus dem Hang ziehen; wenn 3 × 10 mit Reserve gelingt, Widerstand erhöhen.','hypertrophy',3,150,'load',['Australian Pull-ups','Band-Klimmzüge']),
dips:ex('dips','Dips','3 × 6–10','Kontrolliert absenken, nur schmerzfreie Tiefe, kräftig hochdrücken.','hypertrophy',3,150,'load',['Liegestütze']),
bulg:ex('bulg','Bulgarian Split Squats','2 × 8–12 je Bein','Kontrolliert absenken, Samstag moderat halten.','hypertrophy',2,150,'load',['Reverse Lunges']),
aus:ex('aus','Australian Pull-ups','3 × 8–12','Körper als Linie halten und Brust zur Stange ziehen.','hypertrophy',3,120,'load',['Band Row']),
pike:ex('pike','Pike Push-ups','2 × 6–10','Hüfte hoch, Kopf kontrolliert Richtung Boden, kräftig wegdrücken.','hypertrophy',2,120,'load',['Erhöhte Pike Push-ups']),
glute:ex('glute','Einbeinige Glute Bridges','2 × 10–15 je Seite','Becken über Gesäß/Hinterkette anheben, oben stabilisieren.','hypertrophy',2,90,'load',['Hip Thrust']),
blat:ex('blat','Seitheben mit Widerstandsband','2 × 10–15','Arme kontrolliert seitlich anheben, Schultern unten halten.','hypertrophy',2,75,'load',['Kurzhantel-Seitheben']),
bench:ex('bench','Langhantel-Bankdrücken','3 × 6–10','Schulterblätter stabil, kontrolliert absenken und kräftig hochdrücken.','hypertrophy',3,150,'load',['Kurzhantel-Bankdrücken','Liegestütze']),
row:ex('row','Einarmiges Kurzhantelrudern','3 × 8–12 je Seite','Rücken stabil, Hantel Richtung Hüfte ziehen.','hypertrophy',3,120,'load',['Langhantelrudern']),
rdl:ex('rdl','Rumänisches Kreuzheben','2 × 8–10','Knie leicht gebeugt, Hüfte nach hinten, Rücken neutral.','hypertrophy',2,150,'load',['Kurzhantel-RDL']),
shoulder:ex('shoulder','Kurzhantel-Schulterdrücken','2 × 8–10','Rumpf stabil, kontrolliert über Kopf drücken.','hypertrophy',2,120,'load',['Pike Push-ups']),
dblat:ex('dblat','Kurzhantel-Seitheben','2 × 10–15','Kontrolliert seitlich anheben, ohne Schwung.','hypertrophy',2,75,'load',['Band-Seitheben']),
pullover:ex('pullover','Kurzhantel-Pullover','2 × 8–12','Auf Bank liegend kontrolliert hinter den Kopf führen und zurück.','hypertrophy',2,90,'load',['Band Straight-Arm Pulldown']),
run:ex('run','Lockerer Dauerlauf','30–45 Min. · RPE 3–4/10','Gleichmäßiges Gesprächstempo; bei Bedarf zunächst 20–25 Min.','endurance',1,0,'endurance')
};

var SAT_A=[E.pull,E.dips,E.bulg,E.aus,E.pike,E.glute,E.blat];
var SAT_B=[E.bench,E.row,E.rdl,E.bulg,E.shoulder,E.dblat,E.pullover];

function session(id,title,sub,cat,list){return{id:id,title:title,sub:sub,cat:cat,list:list};}
var S={
  mon:session('mon','Schnellkraft & Maximalkraft A','Kraftraum · Unterkörperfokus','power',[E.cmj,E.lat,E.plyo,E.squat,E.calf,E.pallof]),
  wed:session('wed','Tennistraining','Reguläre Einheit','tennis',[E.tennis]),
  thuAM:session('thuAM','Tennisspezifische Intervalle','Donnerstagvormittag · locker','endurance',[E.intervals]),
  thuPM:session('thuPM','Schnellkraft B','Donnerstagabend · Oberkörper & Rotation','power',[E.broad,E.rot,E.chest,E.slam]),
  fri:session('fri','Tennis-Mobility & Schulter','Freitag 13:00–13:45 · ARO einzige Kraftübung','mobility',[E.mob,E.hip90,E.cossack,E.knee,E.calfstretch,E.open,E.wall,E.ero,E.cool]),
  sun:session('sun','Lockerer Dauerlauf','Grundlagenausdauer','endurance',[E.run])
};

function stability(d){return weekNo(d)%2===0?E.copen:E.bandwalk;}

function planner(){return window.TP_PLANNER||{matches:[],phases:[],library:[],byId:function(){return null;},suggest:function(){return[];}};}
function exercisePool(){
  var s=state.data.settings||(state.data.settings={}),removed=s.deletedExercises||{},custom=s.customExercises||[],over=s.exerciseSettings||{};
  return planner().library.filter(function(e){return !removed[e.id];}).map(function(e){return Object.assign({},e,over[e.id]||{});}).concat(custom.map(function(e){return Object.assign({},e,over[e.id]||{});}));
}
function poolById(id){var a=exercisePool();for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;}

function phaseFor(d){
  var ps=planner().phases,id=iso(d);
  for(var i=0;i<ps.length;i++)if(id>=ps[i].start&&id<=ps[i].end)return ps[i];
  return ps.length?ps[id<ps[0].start?0:ps.length-1]:{name:'Basis',kind:'build',focus:'Grundlagen entwickeln.'};
}
function nextMatchInfo(d){
  var ms=planner().matches,best=null,bestDays=null;
  for(var i=0;i<ms.length;i++){
    var md=parseIso(ms[i].date),days=Math.round((dateOnly(md)-dateOnly(d))/86400000);
    if(days>=0&&(bestDays===null||days<bestDays)){best=ms[i];bestDays=days;}
  }
  return best?{match:best,date:parseIso(best.date),days:bestDays}:null;
}
function dateOnly(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function matchOn(d){
  var ms=planner().matches,id=iso(d);
  for(var i=0;i<ms.length;i++)if(ms[i].date===id)return ms[i];
  return null;
}
function cycleInfo(d){
  var p=phaseFor(d),start=parseIso(p.start||iso(d));
  var week=Math.max(1,Math.floor((dateOnly(d)-dateOnly(start))/604800000)+1);
  var meso=Math.floor((week-1)/4)+1,wave=((week-1)%4)+1,nm=nextMatchInfo(d);
  var kind=p.kind,label='Belastung';
  if(kind==='match'||(nm&&nm.days<=3)){label='Match-Woche';kind='match';}
  else if((kind==='build'||kind==='power'||kind==='hypertrophy'||kind==='maxstrength')&&wave===4){label='Deload';kind='deload';}
  else if(kind==='preseason')label='Pre-Season';
  else if(kind==='season')label='In-Season';
  else label='Belastungswoche '+Math.min(wave,3)+'/3';
  return{phase:p,kind:kind,week:week,meso:meso,wave:wave,label:label,nextMatch:nm,
    macro:iso(d)<'2027-06-01'?'Aufbau 2026/27':'Saison 2027'};
}
function cycleDose(d,e){
  var ci=cycleInfo(d);
  if(e.type==='mobility'||e.type==='tennis')return 1;
  if(ci.kind==='match'){
    if(e.type==='power')return .67;
    if(e.type==='strength'||e.type==='hypertrophy')return .5;
    if(e.type==='endurance')return .5;
  }
  if(ci.kind==='deload')return .67;
  if(ci.kind==='preseason'){
    if(e.type==='strength'||e.type==='hypertrophy')return .7;
    return 1;
  }
  if(ci.kind==='season'){
    if(e.type==='strength'||e.type==='hypertrophy')return .6;
    if(e.type==='power')return .8;
    return .8;
  }
  return 1;
}
function adaptExercise(e,d){
  var c={},k;for(k in e)c[k]=e[k];
  var dose=cycleDose(d,e),base=e.sets||1,ci=cycleInfo(d),nm=nextMatchInfo(d);
  if(base>1&&dose<1){
    c.sets=Math.max(1,Math.ceil(base*dose));
    c.cycleNote='Zyklus: '+ci.label+' · Umfang reduziert';
  }
  if(e.id==='run'&&ci.kind==='match'){
    c.target=nm&&nm.days<=2?'20–25 Min. sehr locker':'25–35 Min. locker';
    c.desc='Regeneratives Gesprächstempo. Frische für das Spiel hat Vorrang; bei schweren Beinen auslassen.';
    c.cycleNote='Match-Woche: Ausdauer nur regenerativ.';
  }
  return c;
}
function adaptList(list,d){
  var out=[];for(var i=0;i<list.length;i++)out.push(adaptExercise(list[i],d));return out;
}
function matchSession(d,m){
  var me=ex('matchtennis','Tennisspiel','Match','Spielzeit, Intensität und Beingefühl dokumentieren.','tennis',1,0,'tennis');
  return session('match-'+m.date,m.name,'Leistungs-Check · kein zusätzliches Athletiktraining','tennis',[me]);
}
function preMatchActivation(d){
  var a=adaptExercise(E.cmj,d),b=adaptExercise(E.lat,d),c=adaptExercise(E.pallof,d);
  a.sets=2;a.target='2 × 3';a.cycleNote='Nur explosive, frische Wiederholungen.';
  b.sets=2;b.target='2 × 3 je Seite';b.cycleNote='Kurze Aktivierung, keine Ermüdung.';
  c.sets=1;c.target='1 × 8 je Seite';
  return session('prematch','Pre-Match Aktivierung','Kurz & frisch · keine schwere Kraftarbeit','power',[a,b,c]);
}
function planOverrides(){
  if(!state.data.settings)state.data.settings={};
  if(!state.data.settings.exerciseOverrides)state.data.settings.exerciseOverrides={};
  return state.data.settings.exerciseOverrides;
}
function libraryExerciseForSlot(slotId){
  var id=planOverrides()[slotId];
  return id?planner().byId(id):null;
}
function recommendationsFor(e,d){
  var lib=planner().library,ci=cycleInfo(d),a=[],baseLib=planner().byId(e.id);
  var pattern=baseLib?baseLib.pattern:e.pattern,category=baseLib?baseLib.category:(e.category||e.type);
  for(var i=0;i<lib.length;i++){
    var x=lib[i],score=0;
    if(x.id===e.id)continue;
    if(pattern&&x.pattern===pattern)score+=10;
    if(x.category===category||x.category===e.type)score+=5;
    if(x.phases&&x.phases.indexOf(ci.phase.kind)>=0)score+=4;
    score-=Number(x.fatigue||0)*.4;
    if(score>=5)a.push({e:x,score:score});
  }
  a.sort(function(p,q){return q.score-p.score;});
  var out=[];for(var j=0;j<a.length&&j<12;j++)out.push(a[j].e);
  return out;
}
function cycleBanner(d){
  var ci=cycleInfo(d),nm=ci.nextMatch;
  return '<div class="card cycleHero"><div class="eyebrow">'+esc(ci.macro.toUpperCase())+'</div>'+
    '<h3>'+esc(ci.phase.name)+'</h3><div class="cycleMeta"><span>Meso '+ci.meso+'</span><span>'+esc(ci.label)+'</span>'+
    (nm?'<span>Nächstes Spiel: '+fmt(nm.date,{day:'2-digit',month:'2-digit'})+' · '+nm.days+' Tage</span>':'')+
    '</div><p class="small">'+esc(ci.phase.focus)+'</p></div>';
}
function phaseExercise(id,fallback){
  var p=poolById(id);
  if(!p)return fallback;
  return {id:p.id,name:p.name,target:p.target,desc:p.desc,type:p.type,sets:p.sets,rest:p.rest,metric:p.metric,alts:[]};
}
function phaseList(ids,fallback){
  var out=[];for(var i=0;i<ids.length;i++)out.push(phaseExercise(ids[i],fallback[i]||fallback[0]));
  return out;
}
function phaseWorkout(d,slot){
  var kind=cycleInfo(d).phase.kind,mi=cycleInfo(d),nm=nextMatchInfo(d),days=nm?nm.days:999;
  var list,title,sub,cat;
  if(slot==='mon'){
    title=S.mon.title;sub=S.mon.sub;cat='power';list=S.mon.list;
    if(kind==='power')list=phaseList(['cmj','lat','rot','squat','pallof'],list);
    if(kind==='preseason')list=phaseList(['pogo','skater','scoop_toss','goblet_squat','pallof'],list);
    if(kind==='season')list=phaseList(['cmj','lat','squat','pallof'],list);
    if(kind==='match')list=phaseList(['cmj','rot','pallof'],list);
    if(kind==='build'||kind==='hypertrophy'){title='Ganzkörpertraining';cat='hypertrophy';list=phaseList(['squat','bench','row','rdl','pallof'],list);}
    if(kind==='power'||kind==='maxstrength'){title='Ganzkörpertraining';cat='strength';list=phaseList(['squat','bench','row','pallof'],list);}
    if(kind==='preseason')title='Tennis-Power & Richtungswechsel A';
    if(kind==='season')title='Kraft-/Power-Erhaltung A';
    if(kind==='match')title='Matchwoche · kurze Aktivierung';
  }else if(slot==='thuAM'){
    title=S.thuAM.title;sub=S.thuAM.sub;cat='endurance';list=S.thuAM.list;
    if(kind==='preseason'){title='Tennis-Footwork & Intervalle';list=phaseList(['shadow','court_shuttle'],list);}
    if(kind==='season'){title='Tennis-Intervalle · Erhaltung';list=phaseList(['intervals'],list);}
    if(kind==='power'){title='Schnelle Richtungswechsel';list=phaseList(['shuttle_5105','intervals'],list);}
  }else if(slot==='thuPM'){
    title=S.thuPM.title;sub=S.thuPM.sub;cat='power';list=S.thuPM.list.concat([stability(d)]);
    if(kind==='power')list=phaseList(['broad','scoop_toss','shotput_throw','chest','copen'],list);
    if(kind==='preseason')list=phaseList(['skater','rot','chest','bandwalk'],list);
    if(kind==='season')list=phaseList(['broad','rot','pallof'],list);
    if(kind==='match')list=phaseList(['rot','chest','pallof'],list);
    if(kind==='build'||kind==='hypertrophy'){title='Ganzkörpertraining';cat='hypertrophy';list=phaseList(['bulg','row','bench','pull','cable_chop'],list);}
    if(kind==='power'||kind==='maxstrength'){title='Ganzkörpertraining';cat='strength';list=phaseList(['trap_bar','bulg','landmine_press','pull'],list);}
    if(kind==='preseason')title='Tennisspezifische Power B';
    if(kind==='season')title='Power-Erhaltung B';
    if(kind==='match')title='Matchwoche · leichte Power';
  }else if(slot==='sat'){
    var c=state.data.sat[iso(d)]||'A';
    title='Ganzkörper-Hypertrophie '+c;sub=c==='A'?'Calisthenics-Park':'Langhantel · Bank · Kurzhanteln';cat='hypertrophy';list=c==='A'?SAT_A:SAT_B;
    if(kind==='build'||kind==='hypertrophy'){title='Ganzkörperschnellkraft';cat='power';sub='Kurze explosive Qualität · keine Muskelermüdung';list=phaseList(['cmj','lat','rot','chest','pallof'],list);}
    if(kind==='power')list=c==='A'?phaseList(['pull','dips','bulg','aus','blat'],list):phaseList(['bench','row','rdl','bulg','dblat'],list);
    if(kind==='preseason')list=c==='A'?phaseList(['pull','pushup','bulg','aus'],list):phaseList(['bench','row','bulg','face_pull'],list);
    if(kind==='season')list=c==='A'?phaseList(['pull','pushup','aus','single_calf'],list):phaseList(['bench','row','rdl','face_pull'],list);
    if(kind==='power'||kind==='maxstrength'){title='Ganzkörperschnellkraft – Ganzkörper';cat='power';sub='Kurze explosive Qualität · wenig Ermüdung';list=phaseList(['cmj','lat','rot','chest','pallof'],list);}
    if(kind==='preseason'||kind==='season')title='Krafterhaltung '+c;
  }else if(slot==='sun'){
    title=S.sun.title;sub=S.sun.sub;cat='endurance';list=S.sun.list;
    if(kind==='match')title='Regenerativer Dauerlauf';
    if(kind==='season')title='Lockere Ausdauer · Erhaltung';
  }else return null;
  if(kind==='match'&&slot==='thuPM'&&days<=2)sub='Nur kurz und explosiv, keine Ermüdung';
  var result=adaptList(list,d);
  if(slot==='thuAM'&&kind==='preseason')for(var i=0;i<result.length;i++)if(result[i].id==='court_shuttle')result[i].sets=4;
  return session(slot==='sat'?'sat'+(state.data.sat[iso(d)]||'A'):slot,title,sub,cat,result);
}
function baseSessions(d){
  var m=matchOn(d);if(m)return[matchSession(d,m)];
  var w=d.getDay(),ci=cycleInfo(d),nm=nextMatchInfo(d),days=nm?nm.days:999;
  if(w===1)return[phaseWorkout(d,'mon')];
  if(w===3)return[session('wed','Tennistraining – Technik & Spielpraxis',days<=3?'Locker dosieren · Matchwoche':S.wed.sub,'tennis',adaptList(S.wed.list,d))];
  if(w===4){
    return[phaseWorkout(d,'thuAM'),phaseWorkout(d,'thuPM')];
  }
  if(w===5)return[session('fri','Mobility',ci.kind==='match'?'Locker mobilisieren · Schulter-Außenrotation nur leicht':S.fri.sub,'mobility',adaptList(S.fri.list,d))];
  if(w===6)return[phaseWorkout(d,'sat')];
  if(w===0)return[phaseWorkout(d,'sun')];
  return[];
}

function moves(){if(!state.data.settings)state.data.settings={};return state.data.settings.moves||{};}
function sessions(d){
  var date=iso(d),list=baseSessions(d).filter(function(s){return !moves()[date+'|'+s.id]||moves()[date+'|'+s.id]===date;});
  var settings=state.data.settings||{},extras=settings.permanentDayExercises||{},week=iso(startWeek(d)),weekRepl=settings.weeklyPlanOverrides||{},weekAdds=settings.weeklyDayExercises||{};
  list.forEach(function(ss){
    var key=ss.id.indexOf('thuAM')===0?'thuAM':ss.id.indexOf('thuPM')===0?'thuPM':ss.id.indexOf('mon')===0?'mon':ss.id.indexOf('wed')===0?'wed':ss.id.indexOf('fri')===0?'fri':ss.id.indexOf('sat')===0?'sat':ss.id.indexOf('sun')===0?'sun':'';
    ss.list=ss.list.map(function(old){var picked=weekRepl[week+'|'+ss.id+'|'+old.id],e=picked?poolById(picked):null;if(!e)return old;return{id:old.id,libraryId:e.id,name:e.name,target:e.target,desc:e.desc,type:e.type||e.category,category:e.category,sets:e.sets||3,rest:e.rest||90,metric:e.metric||'load',alts:old.alts||[]};});
    (extras[key]||[]).forEach(function(id){var e=poolById(id);if(e)ss.list.push({id:'extra_'+key+'_'+e.id,libraryId:e.id,name:e.name,target:e.target,desc:e.desc,type:e.type||e.category,category:e.category,sets:e.sets||3,rest:e.rest||90,metric:e.metric||'load',alts:[]});});
    (weekAdds[week+'|'+ss.id]||[]).forEach(function(id){var e=poolById(id);if(e)ss.list.push({id:'weekextra_'+week+'_'+ss.id+'_'+e.id,libraryId:e.id,name:e.name,target:e.target,desc:e.desc,type:e.type||e.category,category:e.category,sets:e.sets||3,rest:e.rest||90,metric:e.metric||'load',alts:[]});});
  });
  var all=moves();
  for(var k in all){
    if(!Object.prototype.hasOwnProperty.call(all,k)||all[k]!==date)continue;
    var cut=k.indexOf('|'),source=k.slice(0,cut),id=k.slice(cut+1);
    if(source===date)continue;
    var origin=baseSessions(parseIso(source));
    for(var i=0;i<origin.length;i++)if(origin[i].id===id){list.push(origin[i]);break;}
  }
  return list;
}
function moveTraining(sourceDate,id,targetDate){
  var from=iso(sourceDate),to=iso(targetDate),current=sessions(sourceDate),selected=null;
  for(var i=0;i<current.length;i++)if(current[i].id===id)selected=current[i];
  if(!selected||from===to)return false;
  if(selected.id.indexOf('match-')===0){alert('Fixe Spieltage können nicht verschoben werden.');return false;}
  var existing=sessions(targetDate);
  for(var j=0;j<existing.length;j++)if(existing[j].id===id){alert('Diese Einheit ist am Zieltag bereits vorhanden.');return false;}
  var log=state.data.logs[from+'|'+id];
  if(log&&log.completed){alert('Abgeschlossene Einheiten können nicht verschoben werden.');return false;}
  if(state.data.logs[to+'|'+id]){alert('Am Zieltag gibt es bereits einen Eintrag zu dieser Einheit.');return false;}
  var m=moves(),original=from;
  for(var k in m)if(m[k]===from&&k.slice(k.indexOf('|')+1)===id){original=k.slice(0,k.indexOf('|'));break;}
  var origId=original+'|'+id;
  if(original===to)delete m[origId];else m[origId]=to;
  state.data.settings.moves=m;
  if(log){state.data.logs[to+'|'+id]=log;delete state.data.logs[from+'|'+id];}
  save();
  renderCalendar();
  return true;
}
function moveDateDialog(source,id){
  var s=sessions(source).filter(function(item){return item.id===id;})[0];
  if(!s)return;
  var h='<div class="overlay"><div class="sheet"><button class="close" id="closeMove">×</button><h2>Training verschieben</h2>'+
    '<p>'+esc(s.title)+'</p><p class="small">Von '+fmt(source,{weekday:'long',day:'2-digit',month:'long'})+'</p>'+
    '<div class="field"><label>Neues Datum</label><input id="moveTarget" type="date" value="'+iso(source)+'"></div>'+
    '<div class="actions"><button class="btn primary" id="confirmMove">Verschieben</button><button class="btn" id="cancelMove">Abbrechen</button></div>'+
    '<p class="small">Nur diese Einheit wird verschoben. Bereits abgeschlossene Einheiten und Spieltage bleiben unverändert.</p></div></div>';
  overlay.innerHTML=h;
  document.getElementById('closeMove').onclick=document.getElementById('cancelMove').onclick=function(){overlay.innerHTML='';};
  document.getElementById('confirmMove').onclick=function(){
    var value=document.getElementById('moveTarget').value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)){alert('Bitte ein gültiges Datum auswählen.');return;}
    if(moveTraining(source,id,parseIso(value)))overlay.innerHTML='';
  };
}
function wireCalendarDrag(){
  var held=null,timer=null,started=false;
  function clear(){if(timer){clearTimeout(timer);timer=null;}}
  var labels=main.querySelectorAll('.calendarLabel[data-session]');
  var activePointer=null;
  function finishDrag(ev){
    if(!held)return;
    clear();
    var drag=held,wasStarted=started;held=null;started=false;
    var selected=main.querySelector('.calendarLabel.dragging');if(selected)selected.classList.remove('dragging');
    if(!wasStarted)return;
    ev.preventDefault();
    var target=document.elementFromPoint(ev.clientX,ev.clientY);
    var day=target&&target.closest?target.closest('.day[data-date]'):null;
    if(day&&day.getAttribute('data-date')!==drag.date)moveTraining(parseIso(drag.date),drag.id,parseIso(day.getAttribute('data-date')));
    else moveDateDialog(parseIso(drag.date),drag.id);
    state.ignoreCalendarClickUntil=Date.now()+600;
  }
  for(var i=0;i<labels.length;i++){
    labels[i].addEventListener('pointerdown',function(ev){
      if(ev.button!==0&&ev.pointerType==='mouse')return;
      var el=this,day=el.closest('[data-date]');
      if(!day)return;
      held={date:day.getAttribute('data-date'),id:el.getAttribute('data-session'),x:ev.clientX,y:ev.clientY};
      started=false;clear();
      timer=setTimeout(function(){started=true;el.classList.add('dragging');},ev.pointerType==='mouse'?160:450);
    });
    labels[i].addEventListener('pointermove',function(ev){
      if(held&&!started&&(Math.abs(ev.clientX-held.x)>12||Math.abs(ev.clientY-held.y)>12)){clear();held=null;}
    });

    labels[i].addEventListener('pointercancel',function(){clear();held=null;started=false;this.classList.remove('dragging');});
  }
  document.onpointerup=finishDrag;
}
function key(d,s){return iso(d)+'|'+s.id;}
function logOf(d,s){return state.data.logs[key(d,s)]||null;}
function done(d,s){var l=logOf(d,s);return !!(l&&l.completed);}
function allLogs(){
  var out=[];
  for(var k in state.data.logs){
    if(!state.data.logs.hasOwnProperty(k))continue;
    var p=k.split('|');
    out.push({date:parseIso(p[0]),sessionId:p.slice(1).join('|'),log:state.data.logs[k],key:k});
  }
  out.sort(function(a,b){return a.date-b.date;});
  return out;
}
function analysisStartIso(){
  return state.data.settings&&/^\d{4}-\d{2}-\d{2}$/.test(state.data.settings.analysisStartDate||'')?state.data.settings.analysisStartDate:'2026-10-26';
}
function analysisLogs(){
  var start=analysisStartIso();
  return allLogs().filter(function(item){return item.key.slice(0,10)>=start;});
}
function effectiveExercise(e){
  var chosen=(e.libraryId&&poolById(e.libraryId))||libraryExerciseForSlot(e.id),c={},k;
  if(chosen){
    for(k in chosen)c[k]=chosen[k];
    c.originalId=e.id;c.libraryId=chosen.id;c.id=e.id;
    if(e.cycleNote)c.cycleNote=e.cycleNote;
  }else{
    for(k in e)c[k]=e[k];
  }
  var weekSub=(state.data.settings||{}).weeklySubstitutions||{},activeDate=state.active?state.active.date:new Date(),weekKey=iso(startWeek(activeDate))+'|'+e.id;
  var alt=weekSub[weekKey];
  if(alt){c.originalId=e.id;c.name=alt;c.id=e.id;}
  return c;
}
function findLast(exId,beforeDate){
  var logs=allLogs(),best=null;
  for(var i=0;i<logs.length;i++){
    if(logs[i].date>=beforeDate)break;
    var eo=logs[i].log.exercises&&logs[i].log.exercises[exId];
    if(eo)best={date:logs[i].date,data:eo};
  }
  return best;
}
function bestSet(eo){
  var best={reps:0,kg:0,rir:null,score:0};
  if(!eo||!eo.sets)return best;
  for(var i=0;i<eo.sets.length;i++){
    var s=eo.sets[i]||{};
    var reps=parseFloat(s.reps)||0,kg=parseFloat(s.kg)||0;
    var score=kg>0?kg*Math.max(reps,1):reps;
    if(score>best.score)best={reps:reps,kg:kg,rir:s.rir,score:score};
  }
  return best;
}
function lastText(exId,date){
  var l=findLast(exId,date);
  if(!l)return'Noch kein vorheriger Eintrag.';
  var b=bestSet(l.data),parts=[];
  if(b.kg)parts.push(b.kg+' kg');
  if(b.reps)parts.push(b.reps+' Wdh.');
  if(b.rir!==null&&b.rir!=='')parts.push('RIR '+b.rir);
  if(l.data.note)parts.push(l.data.note);
  return fmt(l.date,{day:'2-digit',month:'2-digit',year:'numeric'})+' · '+(parts.length?parts.join(' · '):'protokolliert');
}
function numericValue(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:0;}
function previousTraining(exId,before){
  var logs=allLogs(),out=null;
  for(var i=0;i<logs.length;i++){
    if(logs[i].date>=before)break;
    var x=logs[i].log.exercises&&logs[i].log.exercises[exId];
    if(x&&x.sets&&x.sets.length)out=x;
  }
  return out;
}
function weightSuggestion(e,date){
  if(e.metric!=='load'||(e.type!=='strength'&&e.type!=='hypertrophy'))return '';
  var ci=cycleInfo(date);
  if(ci.kind==='match'||ci.kind==='deload')return 'Match-/Entlastungswoche: keine Steigerung einplanen.';
  var previous=previousTraining(e.id,date),sets=previous&&previous.sets||[];
  var relevant=sets.filter(function(v){return numericValue(v.kg)>0&&numericValue(v.reps)>0;});
  if(!relevant.length)return 'Noch keine Gewichts-Empfehlung – zuerst ein Training protokollieren.';
  var kg=Math.min.apply(null,relevant.map(function(v){return numericValue(v.kg);}));
  var max=targetMax(e.target),all=!!max&&relevant.length>=Math.min(e.sets||1,2)&&relevant.every(function(v){return numericValue(v.reps)>=max&&(v.rir===''||v.rir==null||numericValue(v.rir)>=2);});
  var step=kg<20?1:kg<60?2.5:5;
  var suggested=all?Math.round((kg+step)*2)/2:kg;
  return 'Vorschlag: '+String(suggested).replace('.',',')+' kg'+(all?' (+ '+String(step).replace('.',',')+' kg; nur bei sauberer Technik und schmerzfrei)':' (beibehalten, erst Wiederholungen/RIR verbessern)')+'.';
}
function targetMax(target){
  var m=String(target).match(/(\d+)\s*[–-]\s*(\d+)/);
  return m?parseInt(m[2],10):null;
}
function progression(e,exLog,date){
  var ci=cycleInfo(date);
  if(ci.kind==='match')return'Match-Woche: keine Progression erzwingen. Geschwindigkeit und Frische haben Vorrang.';
  if(ci.kind==='deload')return'Deload: Last eher halten, Umfang reduziert lassen und jede Wiederholung sauber ausführen.';
  if(ci.kind==='season'&&(e.type==='strength'||e.type==='hypertrophy'))return'In-Season: Leistung erhalten statt Ermüdung maximieren. Nur steigern, wenn es sehr leicht und sauber war.';
  if(e.type==='power'){
    var q=exLog&&exLog.quality;
    if(q==='top')return'Explosivität sehr gut: nächstes Mal Widerstand nur minimal erhöhen, wenn die Geschwindigkeit gleich bleibt.';
    if(q==='drop')return'Widerstand beibehalten oder reduzieren – Qualität vor zusätzlicher Last.';
    return'Maximale Geschwindigkeit priorisieren. Widerstand erst erhöhen, wenn alle Wiederholungen explosiv bleiben.';
  }
  if(e.metric!=='load')return'Zielbereich sauber erfüllen; Fortschritt über bessere Qualität, Kontrolle oder Umfang.';
  var sets=exLog&&exLog.sets?exLog.sets:[],max=targetMax(e.target),ok=sets.length>0,kg=null;
  for(var i=0;i<sets.length;i++){
    var r=parseFloat(sets[i].reps)||0;
    var rr=parseFloat(sets[i].rir);
    if(max&&r<max)ok=false;
    if(!isNaN(rr)&&rr<1)ok=false;
    if(sets[i].kg!==''&&sets[i].kg!=null)kg=parseFloat(sets[i].kg)||kg;
  }
  if(ok&&max){
    return kg?'Nächstes Mal kleine Laststeigerung sinnvoll, wenn Technik und RIR stabil bleiben.':'Nächstes Mal Widerstand leicht erhöhen.';
  }
  return'Gewicht beibehalten und zuerst den oberen Wiederholungsbereich sauber erreichen.';
}
function prFor(exId){
  var logs=analysisLogs(),best=null;
  for(var i=0;i<logs.length;i++){
    var exs=logs[i].log.exercises||{};
    for(var slotId in exs){
      var eo=exs[slotId];
      if((eo.exerciseId||slotId)!==exId)continue;
      var b=bestSet(eo);
      var val=b.kg>0?b.kg*Math.max(b.reps,1):b.reps;
      if(!best||val>best.val)best={val:val,kg:b.kg,reps:b.reps,date:logs[i].date};
    }
  }
  return best;
}
function readinessScore(r){
  if(!r)return null;
  var a=parseInt(r.sleep,10)||0,b=parseInt(r.energy,10)||0,c=parseInt(r.soreness,10)||0;
  if(!a||!b||!c)return null;
  return Math.round(((a+b+(6-c))/15)*100);
}
function readinessLabel(score){
  if(score==null)return'Nicht bewertet';
  if(score>=75)return'Grün · normal trainieren';
  if(score>=55)return'Gelb · Belastung beobachten';
  return'Rot · Umfang/Intensität reduzieren';
}

var main=document.getElementById('main');
var pageTitle=document.getElementById('pageTitle');
var overlay=document.getElementById('overlay');

function nav(route){
  state.route=route;
  var bs=document.querySelectorAll('.nav button');
  for(var i=0;i<bs.length;i++){
    if(bs[i].getAttribute('data-route')===route)bs[i].classList.add('on');
    else bs[i].classList.remove('on');
  }
  render();
}
function render(){
  if(state.route==='start')renderStart();
  else if(state.route==='calendar')renderCalendar();
  else if(state.route==='training')renderTraining();
  else if(state.route==='reports')renderReports();
  else if(state.route==='nutrition'&&window.TP_NUTRITION)window.TP_NUTRITION.render();
  else renderPlan();
}
function weeklySummary(ref,cutoff){
  var st=startWeek(ref||new Date()),p=0,c=0,scores=[],loads=0,tennisMins=0,runMins=0;
  for(var i=0;i<7;i++){
    var d=add(st,i);if(cutoff&&iso(d)<cutoff)continue;var ss=sessions(d);
    p+=ss.length;
    for(var j=0;j<ss.length;j++){
      var l=logOf(d,ss[j]);
      if(l&&l.completed)c++;
      if(l){
        var rs=readinessScore(l.readiness);
        if(rs!=null)scores.push(rs);
        if(l.tennis&&l.tennis.duration)tennisMins+=parseFloat(l.tennis.duration)||0;
        if(l.endurance&&l.endurance.duration)runMins+=parseFloat(l.endurance.duration)||0;
        if(l.exercises)for(var id in l.exercises){if(l.exercises[id].sets)loads+=l.exercises[id].sets.length;}
      }
    }
  }
  var avg=scores.length?Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length):null;
  return{p:p,c:c,pc:p?Math.round(c/p*100):0,avg:avg,loads:loads,tennis:tennisMins,run:runMins};
}
function renderStart(){
  pageTitle.textContent='Dein Training';
  var d=new Date(),ss=sessions(d),w=weeklySummary(d),next=null;
  for(var i=1;i<14&&!next;i++){var nd=add(d,i),ns=sessions(nd);if(ns.length)next={date:nd,items:ns};}
  var h='<div class="homeHero"><div class="eyebrow">HEUTE AUF DEM PLAN</div><h2>'+(ss.length?esc(ss[0].title):'Regeneration')+'</h2><p>'+(ss.length?esc(ss[0].sub||'Deine heutige Einheit'):'Heute ist trainingsfrei – nutze den Tag zur Erholung.')+'</p><button class="homeAction" id="homeTraining">Training öffnen →</button></div>';
  h+='<div class="homeStats"><div class="card"><span>✓</span><b>'+w.c+' / '+w.p+'</b><small>Einheiten diese Woche</small></div><div class="card"><span>↗</span><b>'+w.pc+' %</b><small>Wochenfortschritt</small></div></div>';
  h+='<div class="homeSection"><h3>Deine Woche</h3><button id="homeCalendar">Kalender öffnen →</button></div><div class="card homeWeek">';
  var st=startWeek(d),names=['Mo','Di','Mi','Do','Fr','Sa','So'];
  for(var j=0;j<7;j++){var wd=add(st,j),ws=sessions(wd);h+='<button data-home-date="'+iso(wd)+'"><small>'+names[j]+'</small><span class="'+(iso(wd)===iso(d)?'current':'')+'">'+wd.getDate()+'</span><i class="dot '+(ws.length?ws[0].cat:'')+'"></i></button>';}
  h+='</div><div class="homeSection"><h3>Als Nächstes</h3><button id="homeEditPlan" type="button">Übungen ändern →</button></div><div class="card"><b>'+(next?fmt(next.date,{weekday:'long',day:'2-digit',month:'long'}):'Keine weiteren Einheiten')+'</b><p>'+(next?next.items.map(function(x){return esc(x.title);}).join(' · '):'')+'</p><button class="btn" id="homeNext">Im Kalender ansehen</button></div>';
  main.innerHTML=h;
  document.getElementById('homeTraining').onclick=function(){nav('training');};
  var editPlanBtn=document.getElementById('homeEditPlan');if(editPlanBtn)editPlanBtn.onclick=function(){state.planTab='week';nav('plan');};
  document.getElementById('homeCalendar').onclick=function(){nav('calendar');};
  document.getElementById('homeNext').onclick=function(){if(next)state.month=new Date(next.date.getFullYear(),next.date.getMonth(),1);nav('calendar');};
  var bs=main.querySelectorAll('[data-home-date]');for(var k=0;k<bs.length;k++)bs[k].onclick=function(){var x=parseIso(this.getAttribute('data-home-date'));state.month=new Date(x.getFullYear(),x.getMonth(),1);nav('calendar');openDay(x);};
}
function renderCalendar(){
  pageTitle.textContent='Trainingskalender';
  var a=state.month,y=a.getFullYear(),m=a.getMonth();
  var first=new Date(y,m,1),last=new Date(y,m+1,0);
  var start=add(first,-((first.getDay()+6)%7));
  var end=add(last,6-((last.getDay()+6)%7));
  var w=weeklySummary(new Date());
  var h=cycleBanner(new Date())+'<div class="stats">'+
    '<div class="stat"><b>'+w.p+'</b><span>geplant diese Woche</span></div>'+
    '<div class="stat"><b>'+w.c+'</b><span>abgeschlossen</span></div>'+
    '<div class="stat"><b>'+w.pc+'%</b><span>Fortschritt</span></div></div>'+
    '<div class="toolbar"><div><button id="prev">‹</button> <button id="today">Heute</button></div>'+
    '<h2>'+fmt(a,{month:'long',year:'numeric'})+'</h2><button id="next">›</button></div>'+
    '<div class="calendar"><div class="week"><div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div></div><div class="days">';
  for(var d=new Date(start);d<=end;d=add(d,1)){
    var ss=sessions(d);
    h+='<button class="day '+(d.getMonth()!==m?'other ':'')+(iso(d)===iso(new Date())?'today':'')+'" data-date="'+iso(d)+'">'+
      '<span class="num">'+d.getDate()+'</span>'+ (ss.length?'<span class="calendarEntry"><span class="calendarLabels">'+ss.map(function(item){var t=item.title;if(item.cat==='mobility')t='Mobility';else if(item.cat==='hypertrophy')t='Hypertrophie';else if(item.cat==='strength')t='Maximalkraft';else if(item.cat==='power')t='Schnellkraft';else if(item.cat==='endurance')t='Ausdauer / Intervalle';return '<span class="calendarLabel" data-session="'+esc(item.id)+'"><i class="dot '+item.cat+(done(d,item)?' done':'')+'" aria-hidden="true"></i><span>'+esc(t)+'</span></span>';}).join('')+'</span></span>':'')+'</button>';
  }
  h+='</div></div><div class="calendarLegend" aria-label="Farblegende Trainingskalender">'+
    '<span><i class="dot strength"></i> Maximalkraft</span>'+
    '<span><i class="dot hypertrophy"></i> Hypertrophie</span>'+
    '<span><i class="dot power"></i> Schnellkraft</span>'+
    '<span><i class="dot tennis"></i> Tennis / Spiel</span>'+
    '<span><i class="dot endurance"></i> Ausdauer</span>'+
    '<span><i class="dot mobility"></i> Mobility</span>'+
    '<span class="legendDone"><i class="dot tennis done"></i> Abgeschlossen (grüner Rand)</span>'+
    '</div><div class="notice" style="margin-top:10px">Tippe auf einen Tag für Details. Zum Verschieben: Einheit länger gedrückt halten und auf einen anderen Tag ziehen.</div>';
  main.innerHTML=h;
  document.getElementById('prev').onclick=function(){state.month=new Date(y,m-1,1);renderCalendar();};
  document.getElementById('next').onclick=function(){state.month=new Date(y,m+1,1);renderCalendar();};
  document.getElementById('today').onclick=function(){state.month=new Date();renderCalendar();};
  var ds=document.querySelectorAll('.day');
  for(var k=0;k<ds.length;k++)ds[k].onclick=function(){if(state.ignoreCalendarClickUntil&&Date.now()<state.ignoreCalendarClickUntil)return;openDay(parseIso(this.getAttribute('data-date')));};
  wireCalendarDrag();
}
function cards(d,ss){
  var h='';
  for(var i=0;i<ss.length;i++){
    var l=logOf(d,ss[i]),rs=l?readinessScore(l.readiness):null;
    h+='<div class="session"><div class="sessionHead"><div><b>'+esc(ss[i].title)+'</b>'+
      '<div class="meta">'+esc(ss[i].sub)+'</div></div><span class="badge">'+esc(ss[i].cat)+'</span></div>'+
      (rs!=null?'<div class="small" style="margin-top:6px">Tagesform: '+readinessLabel(rs)+'</div>':'')+
      '<div class="actions"><button class="btn open" data-id="'+ss[i].id+'">'+(done(d,ss[i])?'Eintrag öffnen':'Training starten')+'</button></div></div>';
  }
  return h;
}
function wire(d,scope){
  scope=scope||document;
  var bs=scope.querySelectorAll('.open');
  for(var i=0;i<bs.length;i++)bs[i].onclick=function(){
    var id=this.getAttribute('data-id'),ss=sessions(d);
    for(var j=0;j<ss.length;j++)if(ss[j].id===id){openSession(d,ss[j]);break;}
  };
}
function renderTraining(){
  pageTitle.textContent='Training';
  var d=new Date(),ss=sessions(d),h=cycleBanner(d)+'<div class="card"><div class="eyebrow">HEUTE</div><h2>'+fmt(d,{weekday:'long',day:'2-digit',month:'long',year:'numeric'})+'</h2>';
  h+=ss.length?cards(d,ss):'<p>Heute ist laut Plan trainingsfrei.</p>';
  h+='</div><div class="card"><h3>Nächste Einheiten</h3>';
  var c=0;
  for(var i=1;i<10&&c<5;i++){
    var x=add(d,i),xs=sessions(x);
    for(var j=0;j<xs.length&&c<5;j++,c++)h+='<div class="session"><b>'+esc(xs[j].title)+'</b><div class="meta">'+fmt(x,{weekday:'short',day:'2-digit',month:'2-digit'})+' · '+esc(xs[j].sub)+'</div></div>';
  }
  h+='</div><div class="card"><h3>Nächstes Training vorbereiten</h3><p class="small">Übungen und Alternativen im Wochenplan auswählen. Deine Änderungen werden für die nächsten Einheiten übernommen.</p><button class="btn primary" id="editNextTraining">Diese Woche anpassen →</button></div>';
  var prev=weeklySummary(add(d,-7)),cur=weeklySummary(d);
  h+='<div class="card"><h3>Wochenrückblick</h3><div class="grid3">'+
    '<div class="stat"><b>'+cur.pc+'%</b><span>erledigt</span></div>'+
    '<div class="stat"><b>'+(cur.avg==null?'–':cur.avg)+'</b><span>Tagesform Ø</span></div>'+
    '<div class="stat"><b>'+cur.loads+'</b><span>protokollierte Sätze</span></div></div>'+
    '<p class="small">'+weekReviewText(cur,prev)+'</p></div>';
  main.innerHTML=h;
  wire(d);
  var editNext=document.getElementById('editNextTraining');if(editNext)editNext.onclick=function(){openCurrentWeekEditor();};
}
function openCurrentWeekEditor(){
  var start=startWeek(new Date()),week=iso(start),all=exercisePool();
  function paint(){
    var settings=state.data.settings||(state.data.settings={}),repls=settings.weeklyPlanOverrides||(settings.weeklyPlanOverrides={}),adds=settings.weeklyDayExercises||(settings.weeklyDayExercises={});
    var h='<div class="overlay"><div class="sheet"><button class="close" id="closeWeekEdit">×</button><div class="eyebrow">NUR DIESE WOCHE</div><h2>Trainingswoche anpassen</h2><p class="small">Diese Änderungen gelten nur für die Woche ab '+fmt(start,{day:'2-digit',month:'2-digit',year:'numeric'})+'. Der reguläre Wochenplan bleibt unverändert.</p>';
    for(var day=0;day<7;day++){
      var date=add(start,day),ss=sessions(date);if(!ss.length)continue;
      for(var si=0;si<ss.length;si++){
        var sessionItem=ss[si],sessionKey=week+'|'+sessionItem.id;
        h+='<div class="card"><h3>'+esc(fmt(date,{weekday:'long'}))+' · '+esc(sessionItem.title)+'</h3>';
        for(var ei=0;ei<sessionItem.list.length;ei++){
          var ex=sessionItem.list[ei],key=sessionKey+'|'+ex.id,selected=repls[key]||ex.libraryId||ex.id;
          h+='<div class="field"><label>'+esc(ex.name)+'</label><select data-week-replace="'+esc(key)+'"><option value="">Original / Standard</option>';
          for(var li=0;li<all.length;li++)h+='<option value="'+esc(all[li].id)+'"'+(selected===all[li].id?' selected':'')+'>'+esc(all[li].name)+'</option>';
          h+='</select></div>';
        }
        h+='<div class="field"><label>Zusätzliche Übung für diese Woche</label><select data-week-add-select="'+esc(sessionKey)+'"><option value="">Übung auswählen …</option>';
        for(var li2=0;li2<all.length;li2++)h+='<option value="'+esc(all[li2].id)+'">'+esc(all[li2].name)+' · '+esc(all[li2].target)+'</option>';
        h+='</select><button class="btn addWeekExercise" data-week-add="'+esc(sessionKey)+'">+ Hinzufügen</button></div>';
        var existingAdds=adds[sessionKey]||[];if(existingAdds.length)h+='<div class="small">Zusätzlich: '+existingAdds.map(function(id){var e=poolById(id);return e?esc(e.name):'';}).filter(Boolean).join(', ')+'</div>';
        h+='</div>';
      }
    }
    h+='<div class="actions"><button class="btn primary" id="doneWeekEdit">Fertig</button></div></div></div>';overlay.innerHTML=h;
    document.getElementById('closeWeekEdit').onclick=function(){overlay.innerHTML='';};
    document.getElementById('doneWeekEdit').onclick=function(){overlay.innerHTML='';renderTraining();};
    var selects=overlay.querySelectorAll('[data-week-replace]');
    for(var i=0;i<selects.length;i++)selects[i].onchange=function(){var key=this.getAttribute('data-week-replace');if(this.value)repls[key]=this.value;else delete repls[key];save();paint();};
    var buttons=overlay.querySelectorAll('[data-week-add]');
    for(var j=0;j<buttons.length;j++)buttons[j].onclick=function(){
      var sk=this.getAttribute('data-week-add');
      var field=this.parentElement;
      var sel=field&&field.querySelector('select[data-week-add-select]');
      var id=sel?sel.value:'';
      if(!id){if(sel)sel.focus();return;}
      var currentSettings=state.data.settings||(state.data.settings={});
      var currentAdds=currentSettings.weeklyDayExercises||(currentSettings.weeklyDayExercises={});
      if(!currentAdds[sk])currentAdds[sk]=[];
      if(currentAdds[sk].indexOf(id)<0)currentAdds[sk].push(id);
      save();
      paint();
    };
  }paint();
}
function weekReviewText(cur,prev){
  var parts=[];
  if(cur.pc>prev.pc)parts.push('Trainingsquote höher als in der Vorwoche.');
  else if(cur.pc<prev.pc)parts.push('Trainingsquote niedriger als in der Vorwoche.');
  else parts.push('Trainingsquote ähnlich wie in der Vorwoche.');
  if(cur.avg!=null)parts.push('Durchschnittliche Tagesform '+cur.avg+'/100.');
  if(cur.tennis)parts.push(cur.tennis+' Minuten Tennis protokolliert.');
  if(cur.run)parts.push(cur.run+' Minuten Ausdauer protokolliert.');
  return parts.join(' ');
}
function openDay(d){
  var ss=sessions(d),ci=cycleInfo(d),h='<div class="overlay"><div class="sheet"><button class="close" id="closeDay">×</button>'+
    '<div class="eyebrow">'+fmt(d,{weekday:'long'}).toUpperCase()+'</div><h2>'+fmt(d,{day:'2-digit',month:'long',year:'numeric'})+'</h2><div class="notice">'+esc(ci.phase.name)+' · '+esc(ci.label)+'</div>';
  if(d.getDay()===6&&!matchOn(d)&&['hypertrophy','maxstrength','build','power'].indexOf(cycleInfo(d).phase.kind)<0){
    var c=state.data.sat[iso(d)]||'A';
    h+='<div class="card"><b>Samstagsvariante</b><div class="choice">'+
      '<button data-c="A" class="'+(c==='A'?'on':'')+'">A · Calisthenics</button>'+
      '<button data-c="B" class="'+(c==='B'?'on':'')+'">B · Hanteln</button></div></div>';
  }
  h+=ss.length?cards(d,ss):'<div class="notice">Trainingsfreier Tag.</div>';
  for(var mi=0;mi<ss.length;mi++)if(ss[mi].id.indexOf('match-')!==0&&!done(d,ss[mi]))h+='<button class="btn moveSession" data-move="'+esc(ss[mi].id)+'">'+esc(ss[mi].title)+' verschieben</button>';
  overlay.innerHTML=h+'</div></div>';
  document.getElementById('closeDay').onclick=function(){overlay.innerHTML='';};
  if(d.getDay()===6){
    var cs=overlay.querySelectorAll('[data-c]');
    for(var i=0;i<cs.length;i++)cs[i].onclick=function(){
      state.data.sat[iso(d)]=this.getAttribute('data-c');save();openDay(d);
    };
  }
  wire(d,overlay);
  var moveButtons=overlay.querySelectorAll('.moveSession');
  for(var z=0;z<moveButtons.length;z++)moveButtons[z].onclick=function(){moveDateDialog(d,this.getAttribute('data-move'));};
}

function blankLog(s){
  return{completed:false,readiness:{sleep:'',energy:'',soreness:''},notes:'',exercises:{},tennis:{duration:'',rpe:'',legs:''},endurance:{duration:'',distance:'',rpe:''},startedAt:new Date().toISOString()};
}
function openSession(d,s){
  var existing=logOf(d,s),log=existing?JSON.parse(JSON.stringify(existing)):blankLog(s);
  state.active={date:d,session:s,log:log,index:0};
  renderSession();
}
function renderReadiness(){
  var r=state.active.log.readiness||{sleep:'',energy:'',soreness:''};
  var h='<div class="card readiness"><div class="eyebrow">VOR DEM TRAINING</div><h3>Tagesform</h3>';
  h+=scaleRow('Schlaf','sleep',r.sleep,'1 = schlecht · 5 = sehr gut');
  h+=scaleRow('Energie','energy',r.energy,'1 = leer · 5 = sehr frisch');
  h+=scaleRow('Muskelermüdung','soreness',r.soreness,'1 = kaum · 5 = sehr hoch');
  var score=readinessScore(r);
  if(score!=null)h+='<div class="notice"><b>'+score+'/100</b> · '+readinessLabel(score)+'</div>';
  return h+'</div>';
}
function scaleRow(label,keyName,val,hint){
  var h='<div class="readinessRow"><span>'+label+' <span class="small">'+hint+'</span></span><div class="scale">';
  for(var i=1;i<=5;i++)h+='<button type="button" data-read="'+keyName+'" data-val="'+i+'" class="'+(String(val)===String(i)?'on':'')+'">'+i+'</button>';
  return h+'</div></div>';
}
function ensureExLog(id){
  if(!state.active.log.exercises[id])state.active.log.exercises[id]={sets:[],note:'',quality:''};
  return state.active.log.exercises[id];
}
function renderSession(){
  stopTimer(false);
  var a=state.active,s=a.session,d=a.date,idx=a.index;
  var e=effectiveExercise(s.list[idx]),exLog=ensureExLog(e.id);
  if(iso(d)>=analysisStartIso()){
    exLog.exerciseId=e.libraryId||e.id;
    exLog.exerciseName=e.name;
  }
  var total=s.list.length;
  var h='<div class="overlay"><div class="sheet"><button class="close" id="closeSession">×</button>'+
    '<div class="eyebrow">'+fmt(d,{weekday:'long'}).toUpperCase()+'</div><h2>'+esc(s.title)+'</h2>'+
    '<div class="meta">'+esc(s.sub)+'</div>'+renderReadiness()+
    '<div class="stepbar">';
  for(var i=0;i<total;i++)h+='<button type="button" data-step="'+i+'" class="'+(i===idx?'on':'')+'">'+(i+1)+'</button>';
  h+='</div><div class="progressline"><span style="width:'+Math.round(((idx+1)/total)*100)+'%"></span></div>';
  h+=exerciseEditor(e,exLog,d);
  h+='<div class="actions">'+
    (idx>0?'<button class="btn" id="prevEx">← Zurück</button>':'')+
    (idx<total-1?'<button class="btn primary" id="nextEx">Nächste Übung →</button>':'<button class="btn primary" id="finish">Training abschließen</button>')+
    '<button class="btn" id="saveExit">Speichern & schließen</button></div>'+
    '<div class="field"><label>Allgemeine Notizen</label><textarea id="sessionNotes">'+esc(a.log.notes||'')+'</textarea></div>'+
    '<div id="timerBox"></div></div></div>';
  overlay.innerHTML=h;
  wireSession(e,exLog);
  if(state.timerEnd>Date.now())startTimer(Math.ceil((state.timerEnd-Date.now())/1000));
}
function ratingOptions(value){var h='<option value="">–</option>';for(var i=1;i<=5;i++)h+='<option value="'+i+'"'+(String(value)===String(i)?' selected':'')+'>'+i+'</option>';return h;}
function exerciseEditor(e,exLog,d){
  var h='<div class="exercise"><div class="sessionHead"><div><h3>'+esc(e.name)+'</h3><div class="target">'+esc(e.target)+'</div></div>'+
    '<span class="pill">'+(e.type==='power'?'Schnellkraft':e.type==='hypertrophy'?'Hypertrophie':e.type==='strength'?'Kraft':e.type)+'</span></div>'+
    '<div class="desc">'+esc(e.desc)+'</div>'+
    (e.cycleNote?'<div class="cycleNote">'+esc(e.cycleNote)+'</div>':'')+
    '<div class="last"><b>Letztes Mal:</b> '+esc(lastText(e.id,d))+'</div>'+ (e.metric==='load'?'<div class="progressTip">'+esc(weightSuggestion(e,d))+'</div>':'');
  if(e.alts&&e.alts.length){
    h+='<div class="replacebox"><b>Übung ersetzen</b><div class="small">Nur wenn Equipment oder Tagesform es nötig macht.</div><select id="replacement"><option value="">Original: '+esc(e.name)+'</option>';
    for(var z=0;z<e.alts.length;z++)h+='<option value="'+esc(e.alts[z])+'" '+(state.data.substitutions[e.id]===e.alts[z]?'selected':'')+'>'+esc(e.alts[z])+'</option>';
    h+='</select></div>';
  }
  if(e.metric==='tennis'){
    var t=state.active.log.tennis||{};
    if(state.active.session.id.indexOf('match-')===0){var mt=state.active.log.match||{};h+='<div class="matchFields"><div class="eyebrow">MATCHANALYSE</div><h3>1. Ergebnis erfassen</h3><div class="notice">Bei Satzgleichstand 1:1 wird der dritte Durchgang als <b>Match-Tiebreak bis 10</b> gespielt (mindestens 2 Punkte Vorsprung). Beispiel: 6:4 3:6 10:8.</div><div class="grid2"><div class="field"><label>Ergebnis / Sätze</label><input id="matchScore" placeholder="6:4 3:6 10:8" value="'+esc(mt.score||'')+'"></div><div class="field"><label>Gegner (optional)</label><input id="matchOpponent" value="'+esc(mt.opponent||'')+'"></div></div><h3>2. Leistung bewerten</h3><div class="grid2"><div class="field"><label>Aufschlag 1–5</label><select id="matchServe">'+ratingOptions(mt.serve)+'</select></div><div class="field"><label>Return 1–5</label><select id="matchReturn">'+ratingOptions(mt.returnRating)+'</select></div><div class="field"><label>Beinarbeit 1–5</label><select id="matchFootwork">'+ratingOptions(mt.footwork)+'</select></div><div class="field"><label>Mentale Stärke 1–5</label><select id="matchMental">'+ratingOptions(mt.mental)+'</select></div></div><h3>3. Nächster Trainingsfokus</h3><div class="field"><label>Schwerpunkt</label><select id="matchFocus"><option value="">Bitte wählen</option>'+['Konstanz','Aufschlag','Return','Mentale Stärke','Beinarbeit'].map(function(x){return '<option value="'+x+'"'+(mt.focus===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></div><div class="field"><label>Was lief gut / nächstes Mal verbessern?</label><textarea id="matchTakeaway">'+esc(mt.takeaway||'')+'</textarea></div></div>';}
    h+='<div class="grid2"><div class="field"><label>Dauer (Min.)</label><input id="tennisDuration" inputmode="decimal" value="'+esc(t.duration||'')+'"></div>'+
      '<div class="field"><label>Intensität RPE 1–10</label><input id="tennisRpe" inputmode="decimal" value="'+esc(t.rpe||'')+'"></div></div>'+
      '<div class="field"><label>Beine</label><select id="tennisLegs"><option value="">Bitte wählen</option><option value="fresh" '+(t.legs==='fresh'?'selected':'')+'>Frisch</option><option value="normal" '+(t.legs==='normal'?'selected':'')+'>Normal</option><option value="heavy" '+(t.legs==='heavy'?'selected':'')+'>Schwer</option></select></div>';
  }else if(e.metric==='endurance'){
    var en=state.active.log.endurance||{};
    h+='<div class="grid3"><div class="field"><label>Dauer Min.</label><input id="endDuration" inputmode="decimal" value="'+esc(en.duration||'')+'"></div>'+
      '<div class="field"><label>Distanz km</label><input id="endDistance" inputmode="decimal" value="'+esc(en.distance||'')+'"></div>'+
      '<div class="field"><label>RPE 1–10</label><input id="endRpe" inputmode="decimal" value="'+esc(en.rpe||'')+'"></div></div>';
  }else if(e.metric==='note'){
    h+='<div class="field"><label>Erledigt / Notiz</label><textarea id="exerciseNote">'+esc(exLog.note||'')+'</textarea></div>';
  }else{
    h+='<div class="labels"><span>Satz</span><span>Wdh.</span><span>Gewicht</span><span>RIR</span><span>✓</span></div>';
    for(var i=0;i<e.sets;i++){
      var v=exLog.sets[i]||{};
      h+='<div class="setrow"><b>'+(i+1)+'</b>'+
        '<input inputmode="decimal" data-f="reps" data-set="'+i+'" value="'+esc(v.reps||'')+'" placeholder="–">'+
        '<input inputmode="decimal" data-f="kg" data-set="'+i+'" value="'+esc(v.kg||'')+'" placeholder="kg">'+
        '<input inputmode="decimal" data-f="rir" data-set="'+i+'" value="'+esc(v.rir||'')+'" placeholder="RIR">'+
        '<button type="button" class="setdone '+(v.done?'on':'')+'" data-done="'+i+'">✓</button></div>';
    }
    if(e.type==='power'){
      h+='<div class="field"><label>Explosivität</label><select id="quality"><option value="">Bitte wählen</option><option value="top" '+(exLog.quality==='top'?'selected':'')+'>Sehr explosiv</option><option value="good" '+(exLog.quality==='good'?'selected':'')+'>Gut / stabil</option><option value="drop" '+(exLog.quality==='drop'?'selected':'')+'>Tempo abgefallen</option></select></div>';
    }
    h+='<div class="field"><label>Übungsnotiz</label><input id="exerciseNote" value="'+esc(exLog.note||'')+'" placeholder="Technik, Schmerzen, ungewöhnliche Ermüdung …"></div>'+
      '<div class="recommend">'+esc(progression(e,exLog,d))+'</div>';
  }
  return h+'</div>';
}
function persistCurrent(){
  if(!state.active)return;
  var e=effectiveExercise(state.active.session.list[state.active.index]),exLog=ensureExLog(e.id);
  if(iso(state.active.date)>=analysisStartIso()){
    exLog.exerciseId=e.libraryId||e.id;
    exLog.exerciseName=e.name;
  }
  var inputs=overlay.querySelectorAll('[data-f]');
  for(var i=0;i<inputs.length;i++){
    var n=parseInt(inputs[i].getAttribute('data-set'),10),f=inputs[i].getAttribute('data-f');
    if(!exLog.sets[n])exLog.sets[n]={};
    exLog.sets[n][f]=inputs[i].value;
  }
  var q=document.getElementById('quality');
  if(q)exLog.quality=q.value;
  var note=document.getElementById('exerciseNote');
  if(note)exLog.note=note.value;
  var sd=document.querySelectorAll('[data-done]');
  for(var j=0;j<sd.length;j++){
    var x=parseInt(sd[j].getAttribute('data-done'),10);
    if(!exLog.sets[x])exLog.sets[x]={};
    exLog.sets[x].done=sd[j].classList.contains('on');
  }
  var nt=document.getElementById('sessionNotes');
  if(nt)state.active.log.notes=nt.value;
  var td=document.getElementById('tennisDuration'),tr=document.getElementById('tennisRpe'),tl=document.getElementById('tennisLegs');
  if(td)state.active.log.tennis={duration:td.value,rpe:tr?tr.value:'',legs:tl?tl.value:''};
  var ed=document.getElementById('endDuration'),edi=document.getElementById('endDistance'),er=document.getElementById('endRpe');
  if(ed)state.active.log.endurance={duration:ed.value,distance:edi?edi.value:'',rpe:er?er.value:''};
  var ms=document.getElementById('matchScore');if(ms)state.active.log.match={score:ms.value,opponent:document.getElementById('matchOpponent').value,serve:document.getElementById('matchServe').value,footwork:document.getElementById('matchFootwork').value,returnRating:document.getElementById('matchReturn').value,mental:document.getElementById('matchMental').value,focus:document.getElementById('matchFocus').value,takeaway:document.getElementById('matchTakeaway').value};
}
function wireSession(e,exLog){
  document.getElementById('closeSession').onclick=function(){persistCurrent();saveActive(false);overlay.innerHTML='';};
  var steps=overlay.querySelectorAll('[data-step]');
  for(var i=0;i<steps.length;i++)steps[i].onclick=function(){persistCurrent();state.active.index=parseInt(this.getAttribute('data-step'),10);renderSession();};
  var reads=overlay.querySelectorAll('[data-read]');
  for(var j=0;j<reads.length;j++)reads[j].onclick=function(){
    state.active.log.readiness[this.getAttribute('data-read')]=this.getAttribute('data-val');persistCurrent();renderSession();
  };
  var rep=document.getElementById('replacement');
  if(rep)rep.onchange=function(){
    var original=state.active.session.list[state.active.index],settings=state.data.settings||(state.data.settings={}),weekly=settings.weeklySubstitutions||(settings.weeklySubstitutions={}),key=iso(startWeek(state.active.date))+'|'+original.id;
    if(this.value)weekly[key]=this.value;else delete weekly[key];
    save();renderSession();
  };
  var doneBtns=overlay.querySelectorAll('[data-done]');
  for(var k=0;k<doneBtns.length;k++)doneBtns[k].onclick=function(){
    var n=parseInt(this.getAttribute('data-done'),10);
    if(!exLog.sets[n])exLog.sets[n]={};
    exLog.sets[n].done=!exLog.sets[n].done;
    this.classList.toggle('on');
    if(exLog.sets[n].done&&e.rest>0)startTimer(e.rest);
  };
  var p=document.getElementById('prevEx');if(p)p.onclick=function(){persistCurrent();state.active.index--;renderSession();};
  var nx=document.getElementById('nextEx');if(nx)nx.onclick=function(){persistCurrent();state.active.index++;renderSession();};
  var f=document.getElementById('finish');if(f)f.onclick=function(){persistCurrent();state.active.log.completed=true;state.active.log.completedAt=new Date().toISOString();saveActive(true);overlay.innerHTML='';render();};
  document.getElementById('saveExit').onclick=function(){persistCurrent();saveActive(false);overlay.innerHTML='';render();};
}
function saveActive(completed){
  if(!state.active)return;
  if(completed)state.active.log.completed=true;
  state.data.logs[key(state.active.date,state.active.session)]=state.active.log;
  save();
}
function startTimer(seconds){
  stopTimer(false);
  var end=Date.now()+seconds*1000;state.timerEnd=end;
  state.timer=setInterval(function(){
    var left=Math.max(0,Math.ceil((end-Date.now())/1000));
    drawTimer(left);
    if(left<=0){stopTimer(true);try{navigator.vibrate&&navigator.vibrate([150,100,150]);}catch(e){}}
  },250);
  drawTimer(seconds);
}
function drawTimer(left){
  var box=document.getElementById('timerBox');
  if(!box)return;
  box.innerHTML='<div class="timer"><span>Pause</span><b>'+Math.floor(left/60)+':'+pad(left%60)+'</b><button id="skipTimer">Überspringen</button></div>';
  document.getElementById('skipTimer').onclick=function(){stopTimer(true);};
}
function stopTimer(clear){
  if(state.timer){clearInterval(state.timer);state.timer=null;}
  if(clear){state.timerEnd=0;var box=document.getElementById('timerBox');if(box)box.innerHTML='';}
}

function rangeDates(now,r){
  var y=now.getFullYear(),m=now.getMonth();
  if(r==='month')return[new Date(y,m,1),new Date(y,m+1,0,23,59,59)];
  if(r==='quarter'){var q=Math.floor(m/3)*3;return[new Date(y,q,1),new Date(y,q+3,0,23,59,59)];}
  if(r==='half'){var h=m<6?0:6;return[new Date(y,h,1),new Date(y,h+6,0,23,59,59)];}
  return[new Date(y,0,1),new Date(y,11,31,23,59,59)];
}
function chartSvg(points,unit){
  unit=unit||'kg';
  if(!points.length)return '<p class="small">Noch keine protokollierten Daten für diese Übung.</p>';
  var vals=points.map(function(p){return p.value;}),min=Math.min.apply(null,vals),max=Math.max.apply(null,vals),spread=Math.max(1,max-min),w=320,h=150;
  var coords=points.map(function(p,i){return {x:18+(points.length===1?142:i*284/(points.length-1)),y:126-(p.value-min)/spread*100};});
  var path=coords.map(function(p,i){return(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1);}).join(' ');
  return '<svg class="trendSvg" viewBox="0 0 320 150" role="img" aria-label="Verlauf der Trainingsleistung"><path d="M18 126 H302" stroke="currentColor" opacity=".2" fill="none"/><path d="'+path+'" stroke="#0f766e" stroke-width="3" stroke-linejoin="round" fill="none"/>'+coords.map(function(p){return '<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#0f766e"/>';}).join('')+'<text x="18" y="144" font-size="11" fill="currentColor">'+esc(String(min).replace('.',','))+' '+esc(unit)+' min</text><text x="302" y="15" text-anchor="end" font-size="11" fill="currentColor">'+esc(String(max).replace('.',','))+' '+esc(unit)+' max</text></svg>';
}
function developmentPanel(logs,rg,names){
  var per={},units={};
  for(var i=0;i<logs.length;i++){
    var item=logs[i];if(item.date<rg[0]||item.date>rg[1])continue;
    var exs=item.log.exercises||{};
    for(var slotId in exs){
      var ex=exs[slotId],id=ex.exerciseId||slotId,sets=ex.sets||[],topKg=0,topReps=0;
      if(ex.exerciseName)names[id]=ex.exerciseName;
      for(var j=0;j<sets.length;j++){
        var kg=numericValue(sets[j].kg),reps=numericValue(sets[j].reps);
        if(reps>topReps)topReps=reps;
        if(kg>topKg)topKg=kg;
      }
      var value=topKg>0?topKg:topReps;
      if(value>0){if(!per[id])per[id]=[];per[id].push({date:item.date,value:value});units[id]=topKg>0?'kg':'Wdh.';}
    }
  }
  var ids=Object.keys(per).sort(function(a,b){return per[b].length-per[a].length;});
  if(!state.exerciseDevelopmentExercise||!per[state.exerciseDevelopmentExercise])state.exerciseDevelopmentExercise=ids[0]||'';
  var selected=state.exerciseDevelopmentExercise;
  var h='<div class="card"><h3>Übungsentwicklung</h3>';
  if(ids.length){
    h+='<div class="field"><label>Übung auswählen</label><select id="exerciseDevelopmentExercise">';
    for(var z=0;z<ids.length;z++)h+='<option value="'+esc(ids[z])+'"'+(ids[z]===selected?' selected':'')+'>'+esc(names[ids[z]]||((planner().byId(ids[z])||{}).name)||((E[ids[z]]||{}).name)||ids[z])+'</option>';
    h+='</select></div>'+chartSvg(per[selected],units[selected]);
    h+='<p class="small">Pro Training der höchste eingetragene Wert. Bei Gewichtsübungen: kg; sonst: Wiederholungen. Nur Daten ab '+esc(analysisStartIso())+'.</p>';
  }else h+='<p class="small">Ab '+esc(analysisStartIso())+' erscheinen hier deine protokollierten Übungen.</p>';
  return h+'</div>';
}
function progressPanel(logs,rg){
  var per={},names={},volume=0,workouts=0,matchLogs=[];
  for(var i=0;i<logs.length;i++){
    var item=logs[i];if(item.date<rg[0]||item.date>rg[1])continue;
    if(item.log.completed)workouts++;
    if(item.log.match)matchLogs.push({date:item.date,data:item.log.match});
    var exs=item.log.exercises||{};
    for(var id in exs){
      var exercise=exs[id],exerciseId=exercise.exerciseId||id;
      if(exercise.exerciseName)names[exerciseId]=exercise.exerciseName;
      var sets=exercise.sets||[],top=0;
      for(var j=0;j<sets.length;j++){var kg=numericValue(sets[j].kg),reps=numericValue(sets[j].reps);if(kg>0&&reps>0){volume+=kg*reps;top=Math.max(top,kg);}}
      if(top){if(!per[exerciseId])per[exerciseId]=[];per[exerciseId].push({date:item.date,value:top});}
    }
  }
  var ids=Object.keys(per).sort(function(x,y){return per[y].length-per[x].length;});
  if(!state.chartExercise||!per[state.chartExercise])state.chartExercise=ids[0]||'';
  var h='<div class="card"><h3>Fortschrittsdiagramm</h3><div class="stats"><div class="stat"><b>'+workouts+'</b><span>abgeschlossen</span></div><div class="stat"><b>'+Math.round(volume).toLocaleString('de-DE')+'</b><span>Volumen (kg × Wdh.)</span></div></div>';
  if(ids.length){
    h+='<div class="field"><label>Übung auswählen</label><select id="chartExercise">';
    for(var z=0;z<ids.length;z++)h+='<option value="'+esc(ids[z])+'"'+(ids[z]===state.chartExercise?' selected':'')+'>'+esc(names[ids[z]]||(E[ids[z]]&&E[ids[z]].name)||(planner().byId(ids[z])||{}).name||ids[z])+'</option>';
    h+='</select></div>'+chartSvg(per[state.chartExercise]);
    h+='<p class="small">Höchstes verwendetes Gewicht pro Training. Nur tatsächlich protokollierte Sätze.</p>';
  }else h+='<p class="small">Sobald du Gewichte protokollierst, erscheint hier dein Verlauf.</p>';
  h+='</div><div class="card"><h3>Matchanalyse</h3>';
  if(!matchLogs.length)h+='<p class="small">Öffne einen Spieltag im Kalender und trage Ergebnis, Aufschlag und Beinarbeit ein.</p>';
  for(var k=0;k<matchLogs.length;k++){var m=matchLogs[k];h+='<div class="matchSummary"><b>'+fmt(m.date,{day:'2-digit',month:'2-digit',year:'numeric'})+' · '+esc(m.data.score||'Ergebnis offen')+'</b><div class="small">'+(m.data.opponent?'Gegner: '+esc(m.data.opponent)+' · ':'')+'Aufschlag: '+esc(m.data.serve||'–')+'/5 · Beinarbeit: '+esc(m.data.footwork||'–')+'/5</div>'+(m.data.takeaway?'<p>'+esc(m.data.takeaway)+'</p>':'')+'</div>';}
  return h+'</div>';
}
function matchScoreInfo(value){
  var parts=String(value||'').match(/\d+\s*[:\-]\s*\d+/g)||[],won=0,lost=0,sets=[];
  for(var i=0;i<parts.length;i++){
    var x=parts[i].split(/[:\-]/).map(Number),tie=i===2,valid=tie?(Math.max(x[0],x[1])>=10&&Math.abs(x[0]-x[1])>=2):(Math.max(x[0],x[1])>=6&&Math.abs(x[0]-x[1])>=2||Math.max(x[0],x[1])===7&&Math.min(x[0],x[1])===6);
    if(valid){if(x[0]>x[1])won++;else lost++;}
    sets.push({text:x[0]+':'+x[1],tie:tie,valid:valid});
  }
  return {won:won,lost:lost,sets:sets,result:won>=2?'Sieg':lost>=2?'Niederlage':'Offen'};
}
function matchEntries(){return allLogs().filter(function(x){return x.sessionId.indexOf('match-')===0||x.log.match&&x.log.match.score;}).reverse();}
function matchDashboard(){
  var all=matchEntries(),sel=all.filter(function(x){return x.key===state.matchSelected;})[0]||all[0],wins=0,played=0;
  for(var i=0;i<all.length;i++){var result=matchScoreInfo((all[i].log.match||{}).score);if(result.result!=='Offen'){played++;if(result.result==='Sieg')wins++;}}
  var h='<div class="matchDash"><div class="matchHead"><div><div class="eyebrow">TENNIS PERFORMANCE</div><h2>Matchanalyse</h2><p>Deine Spiele. Deine Entwicklung.</p></div><span>🏆</span></div>';
  if(!sel){h+='<div class="card"><h3>Noch keine Matchanalysen</h3><p>Öffne einen Spieltag im Kalender und erfasse dein Ergebnis. Hier erscheinen anschließend deine Spiele und Bewertungen.</p></div></div>';return h;}
  var m=sel.log.match||{},score=matchScoreInfo(m.score),sv=Number(m.serve)||0,fw=Number(m.footwork)||0;
  h+='<div class="matchNumbers"><div class="card"><b>'+played+'</b><small>Matches</small></div><div class="card"><b>'+wins+'</b><small>Siege</small></div><div class="card"><b>'+(played?Math.round(wins/played*100):0)+' %</b><small>Siegquote</small></div></div>';
  h+='<div class="matchHero"><div class="matchHeroTop"><span>'+fmt(sel.date,{day:'2-digit',month:'long',year:'numeric'})+'</span><b>'+score.result+'</b></div><div class="matchHeroScore"><div><small>Du</small><strong>'+score.won+'</strong></div><span>:</span><div><small>'+esc(m.opponent||'Gegner')+'</small><strong>'+score.lost+'</strong></div></div><div class="matchSets">'+score.sets.map(function(s){return '<span>'+esc(s.text)+(s.tie?' <small>Match-Tiebreak</small>':'')+'</span>';}).join('')+'</div></div>';
  h+='<div class="card"><h3>Leistungsbewertung</h3>';
  var metrics=[['Aufschlag',sv],['Return',Number(m.returnRating)||0],['Beinarbeit',fw],['Mentale Stärke',Number(m.mental)||0]];
  for(var j=0;j<metrics.length;j++){var v=metrics[j][1];h+='<div class="matchMetric"><div><span>'+metrics[j][0]+'</span><b>'+(v?v+'/5':'–')+'</b></div><div class="matchTrack"><i style="width:'+(v*20)+'%"></i></div></div>';}
  h+='</div><div class="card"><h3>Was lief gut? Was verbessern?</h3><p>'+esc(m.takeaway||'Noch keine Matchnotizen erfasst.')+'</p>'+(m.focus?'<div class="matchFocus"><b>Fokus fürs nächste Training</b><p>'+esc(m.focus)+'</p></div>':'')+'</div>';
  h+='<div class="card"><h3>Deine Matches</h3>';
  for(var k=0;k<all.length;k++){var e=all[k],res=matchScoreInfo((e.log.match||{}).score);h+='<button class="matchListItem" data-match-key="'+esc(e.key)+'"><span class="'+(res.result==='Sieg'?'win':'')+'">'+(res.result==='Sieg'?'✓':res.result==='Niederlage'?'×':'·')+'</span><div><b>'+esc((e.log.match||{}).opponent||'Match')+'</b><small>'+fmt(e.date,{day:'2-digit',month:'2-digit',year:'numeric'})+' · '+esc((e.log.match||{}).score||'Noch ohne Ergebnis')+'</small></div><strong>›</strong></button>';}
  h+='</div>';
  return h+'</div>';
}
function wireMatchDashboard(){
  var items=main.querySelectorAll('[data-match-key]');for(var j=0;j<items.length;j++)items[j].onclick=function(){state.matchSelected=this.getAttribute('data-match-key');renderReports();};
}
function renderReports(){
  pageTitle.textContent='Analyse';
  var tabs='<div class="tabs">'+
    '<button data-r="month" class="'+(state.range==='month'?'on':'')+'">Monat</button>'+
    '<button data-r="quarter" class="'+(state.range==='quarter'?'on':'')+'">Quartal</button>'+
    '<button data-r="half" class="'+(state.range==='half'?'on':'')+'">6 Monate</button>'+
    '<button data-r="year" class="'+(state.range==='year'?'on':'')+'">Jahr</button></div>';
  var rg=rangeDates(new Date(),state.range),complete=0,total=0,names={};
  for(var n in E)names[E[n].id]=E[n].name;
  var logs=analysisLogs();
  for(var i=0;i<logs.length;i++){
    if(logs[i].date<rg[0]||logs[i].date>rg[1])continue;
    total++;if(logs[i].log.completed)complete++;
    var exs=logs[i].log.exercises||{};
    for(var id in exs){var exercise=exs[id];if(exercise.exerciseName)names[exercise.exerciseId||id]=exercise.exerciseName;}
  }
  var h=matchDashboard()+'<div class="analysisTitle"><h2>Trainingsfortschritt</h2></div>'+tabs+'<div class="stats"><div class="stat"><b>'+complete+'</b><span>abgeschlossen</span></div>'+
    '<div class="stat"><b>'+total+'</b><span>protokolliert</span></div>'+
    '<div class="stat"><b>'+fmt(rg[0],{day:'2-digit',month:'2-digit'})+'</b><span>Zeitraum ab</span></div></div>'+
    developmentPanel(logs,rg,names)+' '+progressPanel(logs,rg)+'<div class="card"><h3>Persönliche Rekorde</h3>';
  var prCount=0,prExerciseIds=['squat','trap_bar','rdl','hip_thrust','bench','db_bench','pull','chinup','row','cable_row'];
  for(var pi=0;pi<prExerciseIds.length;pi++){
    var eid=prExerciseIds[pi],pr=prFor(eid),prExercise=planner().byId(eid),prName=prExercise?prExercise.name:((E[eid]&&E[eid].name)||eid);
    if(pr&&(pr.kg||pr.reps)){
      prCount++;
      h+='<div class="pr"><div><b>'+esc(prName)+'</b><div class="small">'+fmt(pr.date,{day:'2-digit',month:'2-digit',year:'numeric'})+'</div></div>'+
        '<b>'+(pr.kg?pr.kg+' kg × ':'')+pr.reps+'</b></div>';
    }
  }
  if(!prCount)h+='<p>Noch keine PRs – sie erscheinen automatisch nach deinen ersten Einträgen.</p>';
  h+='</div><div class="card"><h3>Wochenrückblick</h3>';
  var cur=weeklySummary(new Date(),analysisStartIso()),prev=weeklySummary(add(new Date(),-7),analysisStartIso());
  h+='<p>'+esc(weekReviewText(cur,prev))+'</p></div>';
  main.innerHTML=h;
  wireMatchDashboard();
  var bs=document.querySelectorAll('[data-r]');
  for(var j=0;j<bs.length;j++)bs[j].onclick=function(){state.range=this.getAttribute('data-r');renderReports();};
  var selector=document.getElementById('chartExercise');if(selector)selector.onchange=function(){state.chartExercise=this.value;renderReports();};
  var developmentSelector=document.getElementById('exerciseDevelopmentExercise');if(developmentSelector)developmentSelector.onchange=function(){state.exerciseDevelopmentExercise=this.value;renderReports();};
}
function block(day,name,list){
  var h='<div class="plan"><h3>'+esc(day)+' · '+esc(name)+'</h3><ul>';
  for(var i=0;i<list.length;i++)h+='<li><b>'+esc(list[i].name)+'</b> – '+esc(list[i].target)+'</li>';
  return h+'</ul></div>';
}
function planTabs(){
  return '<div class="tabs planTabs">'+
    '<button data-plan-tab="cycle" class="'+(state.planTab==='cycle'?'on':'')+'">Zyklus</button>'+
    '<button data-plan-tab="week" class="'+(state.planTab==='week'?'on':'')+'">Wochenplan</button>'+
    '<button data-plan-tab="library" class="'+(state.planTab==='library'?'on':'')+'">Übungspool</button></div>';
}
function wirePlanTabs(){
  var ts=document.querySelectorAll('[data-plan-tab]');
  for(var i=0;i<ts.length;i++)ts[i].onclick=function(){state.planTab=this.getAttribute('data-plan-tab');renderPlan();};
}
function renderCyclePlan(){
  var d=new Date(),ci=cycleInfo(d),nm=ci.nextMatch,h=planTabs()+cycleBanner(d);
  h+='<div class="card"><h3>Aktueller Mikrozyklus</h3><div class="grid3">'+
    '<div class="stat"><b>'+ci.week+'</b><span>Woche der Phase</span></div>'+
    '<div class="stat"><b>'+ci.meso+'</b><span>Mesozyklus</span></div>'+
    '<div class="stat"><b>'+esc(ci.label)+'</b><span>Wochenziel</span></div></div>'+
    '<div class="notice" style="margin-top:10px">Der Zyklus verändert primär den Umfang. Übungen werden nicht heimlich ausgetauscht – dafür bekommst du Vorschläge im Wochenplan.</div></div>';
  h+='<div class="card"><h3>Leistungs-Checks</h3>';
  var ms=planner().matches;
  for(var i=0;i<ms.length;i++){
    var md=parseIso(ms[i].date),past=md<dateOnly(d);
    h+='<div class="timelineItem '+(past?'past':'')+'"><b>'+fmt(md,{day:'2-digit',month:'long',year:'numeric'})+'</b><span>'+esc(ms[i].name)+'</span></div>';
  }
  h+='</div><div class="card"><h3>Makrozyklus bis Saisonstart</h3>';
  var ps=planner().phases;
  for(var j=0;j<ps.length;j++){
    var active=iso(d)>=ps[j].start&&iso(d)<=ps[j].end;
    h+='<div class="phaseRow '+(active?'active':'')+'"><div><b>'+esc(ps[j].name)+'</b><div class="small">'+fmt(parseIso(ps[j].start),{day:'2-digit',month:'2-digit'})+' – '+fmt(parseIso(ps[j].end),{day:'2-digit',month:'2-digit',year:'numeric'})+'</div></div><span class="pill">'+esc(ps[j].kind)+'</span></div>';
  }
  h+='</div><div class="card"><h3>Aktuelle Übungsvorschläge</h3><p class="small">Passend zu '+esc(ci.phase.name)+'. Im Wochenplan kannst du einzelne Übungen übernehmen.</p>';
  var sug=planner().suggest(ci.phase.kind,8);
  for(var k=0;k<sug.length;k++)h+=libraryCard(sug[k],false);
  h+='</div>';
  main.innerHTML=h;wirePlanTabs();wireLibraryCards();
}
function workoutIcon(name,list){
  var n=String(name||'').toLowerCase(),items=list||[];
  var tennisOnly=items.length>0&&items.every(function(e){return e.type==='tennis'||e.category==='tennis';});
  if(tennisOnly||n==='tennis'||n.indexOf('spieltag')>=0||n.indexOf('match-check')>=0)return '🎾';
  if(n.indexOf('ausdauer')>=0||n.indexOf('lauf')>=0||n.indexOf('intervall')>=0||n.indexOf('footwork')>=0||items.some(function(e){return e.type==='endurance'||e.category==='endurance'||e.category==='conditioning';}))return '🏃';
  if(n.indexOf('kraft')>=0||n.indexOf('hypertrophie')>=0||n.indexOf('ganzkörper')>=0||items.some(function(e){return ['strength','power','hypertrophy'].indexOf(e.type)>=0||['strength','power','hypertrophy'].indexOf(e.category)>=0;}))return '🏋️';
  if(n.indexOf('tennis')>=0||n.indexOf('match')>=0)return '🎾';
  return '';
}
function editableBlock(day,name,list,d,slotKey){
  slotKey=slotKey||String(d.getDay());
  var extraIds=((state.data.settings||{}).permanentDayExercises||{})[slotKey]||[];
  for(var xi=0;xi<extraIds.length;xi++){var xe=poolById(extraIds[xi]);if(xe)list=list.concat([{id:'extra_'+slotKey+'_'+xe.id,libraryId:xe.id,name:xe.name,target:xe.target,desc:xe.desc,type:xe.type||xe.category,category:xe.category,sets:xe.sets||3,rest:xe.rest||90,metric:xe.metric||'load',alts:[]}]);}
  var ico=workoutIcon(name,list),title=esc(name);
  var h='<section class="plan editPlan planDay" data-day-date="'+iso(d)+'"><div class="planDayHead"><div><span class="planDayLabel">'+esc(day)+'</span><h3>'+(ico?'<span class="workoutIcon" aria-hidden="true">'+ico+'</span> ':'')+title+'</h3></div><span class="planCount">'+list.length+' '+(list.length===1?'Übung':'Übungen')+'</span></div><div class="planExerciseList">';
  for(var i=0;i<list.length;i++){
    var base=list[i],chosen=libraryExerciseForSlot(base.id),shown=chosen||base;
    h+='<div class="planExercise"><div class="planExerciseInfo"><b>'+esc(shown.name)+'</b>'+
      ''+
      '<div class="small">'+esc(shown.target)+'</div></div>'+
      '<button class="btn chooseEx" data-slot="'+esc(base.id)+'">Ändern</button></div>';
  }
  h+='<button class="btn addDayExercise" data-day-date="'+iso(d)+'" data-day-name="'+esc(day)+'" data-slot-key="'+esc(slotKey)+'">+ Übung hinzufügen</button>';
  return h+'</div></section>';
}
function renderWeekPlan(){
  var d=new Date(),st=startWeek(d),thu=add(st,3),stab=stability(thu),h=planTabs()+cycleBanner(d)+
    '<div class="card planIntro"><h2>Wochenplan</h2><div class="notice">Änderungen hier im Wochenplan gelten dauerhaft für kommende Wochen. Im Bereich Training gelten Änderungen nur für die aktuelle Woche.</div></div>';
  var monday=phaseWorkout(add(st,0),'mon');
  h+=editableBlock('Montag',monday.title,monday.list,add(st,0),'mon');
  h+=editableBlock('Mittwoch','Tennis',[E.tennis],add(st,2),'wed');
  var thuMorning=phaseWorkout(add(st,3),'thuAM');
  if(cycleInfo(add(st,3)).kind!=='match')h+=editableBlock('Donnerstag vormittags',thuMorning.title,thuMorning.list,add(st,3),'thuAM');
  var thuEvening=phaseWorkout(add(st,3),'thuPM');
  h+=editableBlock('Donnerstag abends',thuEvening.title,thuEvening.list,add(st,3),'thuPM');
  h+=editableBlock('Freitag 13:00–13:45','Mobilität & Schulter',S.fri.list,add(st,4),'fri');
  var satDate=add(st,5),satMatch=matchOn(satDate);
  if(satMatch)h+='<div class="plan"><h3>Samstag · '+esc(satMatch.name)+'</h3><p class="small">Spieltag statt Hypertrophie.</p></div>';
  else{var satPlan=phaseWorkout(satDate,'sat');h+=editableBlock('Samstag',satPlan.title,satPlan.list,satDate,'sat');}
  h+=editableBlock('Sonntag','Lockerer Dauerlauf',[E.run],add(st,6),'sun');
  h+='</div><div class="card"><h3>Datensicherung</h3><div class="actions">'+
    '<button id="export" class="btn">Backup herunterladen</button>'+
    '<label class="btn">Backup importieren<input id="import" type="file" accept="application/json" style="display:none"></label></div>'+
    '<p class="small">Cloud-Sync übernimmt auch deine Übungsauswahl und Zyklus-Einstellungen.</p></div>';
  main.innerHTML=h;wirePlanTabs();
  var cs=document.querySelectorAll('.chooseEx');
  for(var i=0;i<cs.length;i++)cs[i].onclick=function(){openExerciseChooser(this.getAttribute('data-slot'));};
  wireBackup();
}
function categoryLabel(c){
  var m={power:'🏋️ Schnellkraft',strength:'🏋️ Kraft',hypertrophy:'🏋️ Hypertrophie',stability:'Rumpf/Stabilität',mobility:'Mobility',conditioning:'🏃 Tennis-Kondition',endurance:'🏃 Ausdauer',tennis:'🎾 Tennis'};
  return m[c]||c;
}
function libraryCard(e,showDetail){
  var f=Number(e.fatigue||0),dots='';for(var z=0;z<3;z++)dots+='<i class="'+(z<f?'on':'')+'"></i>';
  return '<button class="libCard" data-lib-id="'+esc(e.id)+'"><div class="libTop"><b>'+esc(e.name)+'</b><span class="pill">'+esc(categoryLabel(e.category))+'</span></div>'+
    '<div class="small">'+esc(e.target)+' · '+esc((e.equipment||[]).join(', '))+'</div>'+
    '<div class="fatigue"><span>Ermüdung</span><span>'+dots+'</span></div>'+
    (showDetail?'<div class="small">'+esc(e.desc)+'</div>':'')+'</button>';
}
function renderLibrary(){
  var d=new Date(),ci=cycleInfo(d),lib=exercisePool(),filter=state.libraryFilter||'suggested',q=(state.libraryQuery||'').toLowerCase();
  var cats=['suggested','power','strength','hypertrophy','stability','mobility','conditioning','endurance'];
  var h=planTabs()+cycleBanner(d)+'<div class="card"><h2>Übungspool <span class="pill">'+lib.length+' Übungen</span></h2>'+
    '<div class="field"><input id="libSearch" placeholder="Übung suchen …" value="'+esc(state.libraryQuery||'')+'"></div><div class="tabs libFilters">';
  for(var c=0;c<cats.length;c++)h+='<button data-lib-filter="'+cats[c]+'" class="'+(filter===cats[c]?'on':'')+'">'+(cats[c]==='suggested'?'Vorschläge':categoryLabel(cats[c]))+'</button>';
  h+='</div><div class="actions"><button class="btn primary" id="addLibraryExercise">+ Neue Übung</button></div>';
  var arr=filter==='suggested'?planner().suggest(ci.phase.kind,16).map(function(e){return poolById(e.id);}).filter(Boolean):lib.filter(function(e){return e.category===filter;});
  if(q)arr=arr.filter(function(e){return(e.name+' '+e.pattern+' '+(e.equipment||[]).join(' ')).toLowerCase().indexOf(q)>=0;});
  for(var i=0;i<arr.length;i++)h+='<div class="libManageRow">'+libraryCard(arr[i],true)+'<div class="actions"><button class="btn" data-edit-lib="'+esc(arr[i].id)+'">Bearbeiten</button><button class="btn danger" data-delete-lib="'+esc(arr[i].id)+'">Entfernen</button></div></div>';
  if(!arr.length)h+='<div class="notice">Keine passende Übung gefunden.</div>';
  h+='</div>';
  main.innerHTML=h;wirePlanTabs();
  var addLib=document.getElementById('addLibraryExercise');if(addLib)addLib.onclick=function(){openLibraryDetail(null);};
  var edits=document.querySelectorAll('[data-edit-lib]');for(var ei=0;ei<edits.length;ei++)edits[ei].onclick=function(){openLibraryDetail(this.getAttribute('data-edit-lib'));};
  var dels=document.querySelectorAll('[data-delete-lib]');for(var di=0;di<dels.length;di++)dels[di].onclick=function(){removeLibraryExercise(this.getAttribute('data-delete-lib'));};
  var fs=document.querySelectorAll('[data-lib-filter]');
  for(var j=0;j<fs.length;j++)fs[j].onclick=function(){state.libraryFilter=this.getAttribute('data-lib-filter');renderPlan();};
  var search=document.getElementById('libSearch');
  search.oninput=function(){state.libraryQuery=this.value;renderLibrary();var n=document.getElementById('libSearch');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(e){}}};
  wireLibraryCards();
}
function wireLibraryCards(){
  var bs=document.querySelectorAll('[data-lib-id]');
  for(var i=0;i<bs.length;i++)bs[i].onclick=function(){openLibraryDetail(this.getAttribute('data-lib-id'));};
}
function openLibraryDetail(id){
  var e=id?poolById(id):null;if(id&&!e)return;
  e=e||{id:'',name:'',category:'hypertrophy',target:'3 × 8–12',sets:3,rest:90,equipment:[],desc:'',pattern:'general',fatigue:1,phases:['build','power','preseason','season','match']};
  var cats=['power','strength','hypertrophy','stability','mobility','conditioning','endurance','tennis'],opts='';
  for(var i=0;i<cats.length;i++)opts+='<option value="'+cats[i]+'"'+(e.category===cats[i]?' selected':'')+'>'+esc(categoryLabel(cats[i]))+'</option>';
  var reps=String(e.target||'3 × 8–12').replace(/^\s*\d+\s*[×x]\s*/,'').trim();
  overlay.innerHTML='<div class="overlay"><div class="sheet"><button class="close" id="closeLib">×</button><h2>'+(id?'Übung bearbeiten':'Neue Übung hinzufügen')+'</h2>'+
    '<div class="field"><label>Name</label><input id="libName" value="'+esc(e.name)+'"></div><div class="field"><label>Kategorie</label><select id="libCategory">'+opts+'</select></div>'+
    '<div class="grid3"><div class="field"><label>Sätze</label><input id="libSets" type="number" min="1" max="20" value="'+esc(e.sets||3)+'"></div><div class="field"><label>Wiederholungen / Ziel</label><input id="libReps" value="'+esc(reps)+'" placeholder="8–12"></div><div class="field"><label>Pause (Sek.)</label><input id="libRest" type="number" min="0" max="900" value="'+esc(e.rest==null?90:e.rest)+'"></div></div>'+
    '<div class="field"><label>Equipment (Komma-getrennt)</label><input id="libEquipment" value="'+esc((e.equipment||[]).join(', '))+'"></div><div class="field"><label>Beschreibung / Technik</label><textarea id="libDesc">'+esc(e.desc||'')+'</textarea></div>'+
    '<div class="actions"><button class="btn" id="cancelLib">Abbrechen</button><button class="btn primary" id="saveLib">Speichern</button></div></div></div>';
  function close(){overlay.innerHTML='';}document.getElementById('closeLib').onclick=close;document.getElementById('cancelLib').onclick=close;
  document.getElementById('saveLib').onclick=function(){
    var name=document.getElementById('libName').value.trim(),category=document.getElementById('libCategory').value;if(!name){alert('Bitte einen Übungsnamen eingeben.');return;}
    var sets=Math.max(1,Math.min(20,parseInt(document.getElementById('libSets').value,10)||1)),reps=document.getElementById('libReps').value.trim()||'8–12',rest=Math.max(0,Math.min(900,parseInt(document.getElementById('libRest').value,10)||0));
    var equipment=document.getElementById('libEquipment').value.split(',').map(function(x){return x.trim();}).filter(Boolean),desc=document.getElementById('libDesc').value.trim(),settings=state.data.settings||(state.data.settings={});
    var item={name:name,category:category,target:String(sets)+' × '+reps,sets:sets,rest:rest,equipment:equipment,desc:desc,type:category,metric:category==='tennis'?'tennis':(category==='endurance'||category==='conditioning'?'endurance':'load')};
    if(id){if(!settings.exerciseSettings)settings.exerciseSettings={};settings.exerciseSettings[id]=Object.assign({},settings.exerciseSettings[id]||{},item);}
    else{if(!settings.customExercises)settings.customExercises=[];settings.customExercises.push(Object.assign({id:'custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),pattern:'general',fatigue:1,phases:['build','power','preseason','season','match']},item));}
    save();overlay.innerHTML='';renderPlan();
  };
}
function removeLibraryExercise(id){
  var s=state.data.settings||(state.data.settings={});if(!confirm('Übung aus dem Pool entfernen? Bereits gespeicherte Trainingsprotokolle bleiben erhalten.'))return;
  if((s.customExercises||[]).some(function(e){return e.id===id;}))s.customExercises=s.customExercises.filter(function(e){return e.id!==id;});
  else{if(!s.deletedExercises)s.deletedExercises={};s.deletedExercises[id]=true;}
  save();renderPlan();
}
function findBaseExercise(id){
  var lists=[S.mon.list,S.thuAM.list,S.thuPM.list,S.fri.list,SAT_A,SAT_B,S.sun.list,[E.tennis]];
  for(var i=0;i<lists.length;i++)for(var j=0;j<lists[i].length;j++)if(lists[i][j].id===id)return lists[i][j];
  if(stability(new Date()).id===id)return stability(new Date());
  return E[id]||null;
}
function openExerciseChooser(slot){
  var base=findBaseExercise(slot);if(!base)return;
  var chosen=libraryExerciseForSlot(slot),all=exercisePool().slice(),rec=recommendationsFor(base,new Date()),recommended={};
  for(var i=0;i<rec.length;i++)recommended[rec[i].id]=true;
  var selectedCategory='all',search='';
  function paint(){
    var h='<div class="overlay"><div class="sheet"><button class="close" id="closeChooser">×</button>'+
      '<div class="eyebrow">TRAININGSPLAN ANPASSEN</div><h2>'+esc(base.name)+' ersetzen</h2>'+
      '<p class="small">Du kannst jede Übung aus dem gesamten Pool wählen – auch aus einer anderen Trainingskategorie. Empfehlungen sind optional.</p>'+
      '<div class="field"><label>Übung suchen</label><input id="chooserSearch" placeholder="Name, Equipment oder Ziel suchen …" value="'+esc(search)+'"></div>'+
      '<div class="field"><label>Kategorie</label><select id="chooserCategory"><option value="all">Alle Übungen ('+all.length+')</option><option value="recommended">Empfohlen ('+rec.length+')</option>';
    var cats=['hypertrophy','strength','power','stability','mobility','tennis','conditioning','endurance'];
    for(var k=0;k<cats.length;k++)h+='<option value="'+cats[k]+'"'+(selectedCategory===cats[k]?' selected':'')+'>'+esc(categoryLabel(cats[k]))+'</option>';
    h+='</select></div>';
    if(chosen)h+='<div class="actions"><button class="btn danger" id="resetChoice">Original wiederherstellen</button></div>';
    var list=all.filter(function(e){return(selectedCategory==='all'||selectedCategory==='recommended'&&recommended[e.id]||e.category===selectedCategory)&&(!search||(e.name+' '+e.target+' '+(e.equipment||[]).join(' ')).toLowerCase().indexOf(search.toLowerCase())>=0);});
    h+='<h3>'+list.length+' Übungen zur Auswahl</h3><div class="chooserResults">';
    for(var j=0;j<list.length;j++){var e=list[j];h+='<button class="libCard pickLib" data-pick="'+esc(e.id)+'"><div class="libTop"><b>'+esc(e.name)+'</b><span class="pill">'+esc(categoryLabel(e.category))+'</span></div><div class="small">'+esc(e.target)+' · '+esc((e.equipment||[]).join(', '))+'</div>'+(recommended[e.id]?'<div class="small">✓ Passende Empfehlung</div>':'')+'</button>';}
    if(!list.length)h+='<p>Keine Übung gefunden. Suche oder Kategorie ändern.</p>';
    h+='</div></div></div>';
    overlay.innerHTML=h;
    document.getElementById('closeChooser').onclick=function(){overlay.innerHTML='';};
    var category=document.getElementById('chooserCategory');category.value=selectedCategory;
    category.onchange=function(){selectedCategory=this.value;paint();};
    var inp=document.getElementById('chooserSearch');inp.oninput=function(){search=this.value;var pos=inp.selectionStart;paint();var next=document.getElementById('chooserSearch');next.focus();try{next.setSelectionRange(pos,pos);}catch(e){}};
    var reset=document.getElementById('resetChoice');if(reset)reset.onclick=function(){delete planOverrides()[slot];save();overlay.innerHTML='';renderPlan();};
    var buttons=overlay.querySelectorAll('[data-pick]');for(var n=0;n<buttons.length;n++)buttons[n].onclick=function(){planOverrides()[slot]=this.getAttribute('data-pick');save();overlay.innerHTML='';renderPlan();};
  }
  paint();
}
function openAddDayExercise(dateStr,dayName,slotKey){
  var day=new Date(dateStr+'T12:00:00');
  var lib=exercisePool(),search='';
  function paint(){
    var h='<div class="overlay"><div class="sheet"><button class="close" id="closeAddDay">×</button><h2>Übung hinzufügen</h2><p class="small">'+esc(dayName)+' · dauerhaft für zukünftige Wochen</p><div class="field"><input id="addDaySearch" placeholder="Übung suchen …" value="'+esc(search)+'"></div><div class="chooserResults">';
    var list=lib.filter(function(e){return !search||(e.name+' '+e.category+' '+(e.equipment||[]).join(' ')).toLowerCase().indexOf(search.toLowerCase())>=0;});
    for(var i=0;i<list.length;i++)h+='<button class="libCard" data-add-ex="'+esc(list[i].id)+'"><b>'+esc(list[i].name)+'</b><div class="small">'+esc(list[i].target)+' · '+esc(categoryLabel(list[i].category))+'</div></button>';
    h+='</div></div></div>';overlay.innerHTML=h;
    document.getElementById('closeAddDay').onclick=function(){overlay.innerHTML='';};
    var inp=document.getElementById('addDaySearch');inp.oninput=function(){search=this.value;paint();var n=document.getElementById('addDaySearch');n.focus();n.setSelectionRange(n.value.length,n.value.length);};
    var bs=overlay.querySelectorAll('[data-add-ex]');for(var j=0;j<bs.length;j++)bs[j].onclick=function(){
      var s=state.data.settings||(state.data.settings={});if(!s.permanentDayExercises)s.permanentDayExercises={};
      if(!s.permanentDayExercises[slotKey])s.permanentDayExercises[slotKey]=[];
      var id=this.getAttribute('data-add-ex');if(s.permanentDayExercises[slotKey].indexOf(id)<0)s.permanentDayExercises[slotKey].push(id);
      save();overlay.innerHTML='';renderPlan();
    };
  }paint();
}
function wireBackup(){
  var ex=document.getElementById('export'),im=document.getElementById('import');
  if(ex)ex.onclick=function(){
    var blob=new Blob([JSON.stringify(state.data,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='tennis-performance-v2-backup.json';a.click();
    setTimeout(function(){URL.revokeObjectURL(u);},1000);
  };
  if(im)im.onchange=function(){
    var f=this.files[0];if(!f)return;var r=new FileReader();
    r.onload=function(){try{var x=JSON.parse(r.result);if(!x.logs)throw 0;if(!x.version)x.version=2;state.data=x;save();alert('Backup importiert');renderPlan();}catch(e){alert('Import fehlgeschlagen');}};
    r.readAsText(f);
  };
}
function renderPlan(){
  pageTitle.textContent=state.planTab==='cycle'?'Trainingszyklus':state.planTab==='library'?'Übungspool':'Trainingsplan';
  if(state.planTab==='cycle')renderCyclePlan();
  else if(state.planTab==='library')renderLibrary();
  else renderWeekPlan();
}

var themeButton=document.getElementById('themeToggle');if(themeButton)themeButton.onclick=toggleTheme;
var navButtons=document.querySelectorAll('.nav button');
for(var i=0;i<navButtons.length;i++)navButtons[i].onclick=function(){nav(this.getAttribute('data-route'));};

var diag=document.getElementById('jsDiag');if(diag)diag.style.display='none';
try{initSync();}catch(syncError){setSyncStatus('Sync: Fehler','sync-error');}
try{render();}catch(e){main.innerHTML='<div class="card"><h2>Startfehler</h2><p>'+esc(e.message||e)+'</p></div>';}
})();