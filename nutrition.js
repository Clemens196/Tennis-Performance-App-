(function(){
'use strict';
var KEY='tennisPerformanceNutritionV1';
var main=function(){return document.getElementById('main');};
var pageTitle=function(){return document.getElementById('pageTitle');};
function today(){var d=new Date();return iso(d);}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parseDate(s){return new Date(s+'T12:00:00');}
function fresh(){return {profile:{height:180,startWeight:69,calories:2600,surplus:200,carb:45,protein:25,fat:30,phase:'Muskelaufbau'},days:{},weights:{},trackerDays:{},view:'tracker'};}
function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.days&&x.weights&&x.profile){var d=Object.assign(fresh(),x);if(!d.trackerDays)d.trackerDays={};d.view='tracker';return d;}}catch(e){}return fresh();}
var data=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function num(v){return Number(v).toLocaleString('de-DE',{maximumFractionDigits:1});}
function label(s){return parseDate(s).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});}
function records(){return Object.keys(data.trackerDays||{}).sort().map(function(k){return Object.assign({date:k},data.trackerDays[k]);});}
function energyRecords(){return records().filter(function(r){return Number.isFinite(+r.energy)&&r.energy>0;}).slice(-7);}
function averageEnergy(){var a=energyRecords();return a.length?a.reduce(function(s,r){return s+(+r.energy);},0)/a.length:null;}
function averageWeight(){var a=records().filter(function(r){return Number.isFinite(+r.weight)&&r.weight>0;}).slice(-7);return a.length?a.reduce(function(s,r){return s+(+r.weight);},0)/a.length:null;}
function target(){var a=averageEnergy();return a==null?null:Math.round((a+(+data.profile.surplus||200))/50)*50;}
function render(){
 if(!main())return;
 pageTitle().textContent='Kalorien & Gewicht';
 var todayRecord=data.trackerDays[today()]||{};
 var a=energyRecords(),avg=averageEnergy(),goal=target(),ws=records().filter(function(r){return +r.weight>0;}).slice(-14);
 var progress=Math.min(100,Math.round(a.length/7*100));
 var html='<section class="nut-wrap tracker-wrap">'+
 '<div class="tracker-intro"><div class="nut-eyebrow">MUSKELAUFBAU · DEINE DATEN</div><h2>Kalorien & Gewicht</h2><p>Sieben Tage messen, einen Startwert berechnen und das Ziel anschließend mit deinem Gewichtsverlauf feinjustieren.</p></div>'+
 '<div class="card tracker-progress"><div class="nut-section-head"><h2>Deine Messwoche</h2><span class="nut-pill">'+a.length+' von 7 Tagen</span></div><div class="tracker-progress-track"><span style="width:'+progress+'%"></span></div><small class="muted">Trage den Gesamtverbrauch deiner Apple Watch und dein Morgengewicht ein. Die Daten werden lokal auf diesem Gerät gespeichert.</small></div>'+
 '<div class="tracker-stats"><div class="card tracker-stat"><span class="tracker-stat-icon">🔥</span><small>Ø Tagesverbrauch</small><strong>'+(avg==null?'—':num(avg)+' kcal')+'</strong><span class="muted">'+(a.length?'Aus '+a.length+' Messtagen':'Noch keine Daten')+'</span></div><div class="card tracker-stat"><span class="tracker-stat-icon">⚖️</span><small>Ø Gewicht, letzte 7 Einträge</small><strong>'+(averageWeight()==null?'—':num(averageWeight())+' kg')+'</strong><span class="muted">Morgendliche Messungen</span></div></div>'+
 '<div class="card"><div class="nut-section-head"><h2>Heutige Daten</h2><span class="nut-pill">'+label(today())+'</span></div><form class="tracker-form" id="trackerForm"><label for="trackerEnergy">Gesamtenergieverbrauch laut Apple Watch (kcal)</label><input id="trackerEnergy" type="number" min="500" max="10000" step="1" placeholder="z. B. 2650" value="'+esc(todayRecord.energy||'')+'" required><small class="muted">Nimm den gesamten Tagesverbrauch – nicht nur aktive Energie.</small><label for="trackerWeight">Morgengewicht (kg)</label><input id="trackerWeight" type="number" min="20" max="350" step="0.1" placeholder="z. B. 69,0" value="'+esc(todayRecord.weight||data.weights[today()]||'')+'"><small class="muted">Nach dem Toilettengang, vor Essen und Trinken und ohne Kleidung.</small><label for="trackerEaten">Tatsächlich gegessene Kalorien (optional)</label><input id="trackerEaten" type="number" min="0" max="10000" step="1" placeholder="z. B. 2850" value="'+esc(todayRecord.eaten||'')+'"><button class="btn primary full" type="submit">Tagesdaten speichern</button></form></div>'+
 '<div class="card tracker-target"><div class="nut-eyebrow">VORLÄUFIGES KALORIENZIEL</div><strong>'+(goal==null?'Noch nicht berechnet':num(goal)+' kcal / Tag')+'</strong><p>'+(a.length<7?'Sobald sieben Tagesverbräuche eingetragen sind, berechnen wir den Durchschnitt plus deinen kleinen Überschuss.': 'Berechnet aus dem Durchschnitt der letzten sieben eingetragenen Verbrauchswerte plus '+num(data.profile.surplus)+' kcal Überschuss. Das ist ein Startwert, keine exakte Messung.')+'</p><div class="tracker-surplus"><label for="trackerSurplus">Überschuss für Muskelaufbau</label><select id="trackerSurplus"><option value="150" '+(+data.profile.surplus===150?'selected':'')+'>+150 kcal</option><option value="200" '+(+data.profile.surplus===200?'selected':'')+'>+200 kcal</option><option value="250" '+(+data.profile.surplus===250?'selected':'')+'>+250 kcal</option><option value="300" '+(+data.profile.surplus===300?'selected':'')+'>+300 kcal</option></select></div></div>'+
 '<div class="card"><div class="nut-section-head"><h2>Gewichtsverlauf</h2><span class="nut-pill">Letzte 14 Einträge</span></div>'+chart(ws)+'<p class="muted">Das Gewicht kann von Tag zu Tag schwanken. Wir passen das Kalorienziel erst anhand des Trends über mehrere Wochen an.</p></div>'+
 '<div class="card"><div class="nut-section-head"><h2>Letzte Einträge</h2><span>'+records().length+' Tage</span></div>'+(records().length?'<div class="tracker-history">'+records().slice(-14).reverse().map(function(r){return '<div class="tracker-history-row"><span><b>'+label(r.date)+'</b><small>'+r.date+'</small></span><span><b>'+num(r.energy||0)+' kcal</b><small>Verbrauch</small></span><span><b>'+(r.weight?num(r.weight)+' kg':'—')+'</b><small>Gewicht</small></span><span><b>'+(r.eaten?num(r.eaten)+' kcal':'—')+'</b><small>Gegessen</small></span></div>';}).join('')+'</div>':'<p class="muted">Deine Einträge erscheinen hier, sobald du den ersten Tag speicherst.</p>')+'</div>'+
 '<p class="tracker-footnote">Hinweis: Die Apple Watch schätzt den Energieverbrauch. Wir nutzen die sieben Tage als Ausgangswert und prüfen die Schätzung anschließend anhand deines Gewichtsverlaufs. Diese Ansicht liest Apple Health nicht automatisch aus.</p></section>';
 main().innerHTML=html;
 var form=document.getElementById('trackerForm');
 form.onsubmit=function(e){e.preventDefault();var energy=Number(document.getElementById('trackerEnergy').value),w=document.getElementById('trackerWeight').value,eaten=document.getElementById('trackerEaten').value;if(!Number.isFinite(energy)||energy<500||energy>10000)return;var entry={energy:energy};if(w!==''&&Number(w)>=20&&Number(w)<=350){entry.weight=Number(w);data.weights[today()]=Number(w);}if(eaten!==''&&Number(eaten)>=0)entry.eaten=Number(eaten);data.trackerDays[today()]=entry;save();render();};
 document.getElementById('trackerSurplus').onchange=function(e){data.profile.surplus=Number(e.target.value)||200;save();render();};
}
function chart(ws){
 if(ws.length<2)return '<div class="tracker-empty"><span>↗</span><p>Trage mindestens zwei Morgengewichte ein, damit hier dein Gewichtsdiagramm erscheint.</p></div>';
 var vals=ws.map(function(r){return +r.weight;}),min=Math.min.apply(null,vals)-.3,max=Math.max.apply(null,vals)+.3,span=max-min||1;
 var dots=vals.map(function(v,i){return {x:18+i*(284/Math.max(1,vals.length-1)),y:116-(v-min)/span*82};});
 var path=dots.map(function(d,i){return (i?'L':'M')+d.x+' '+d.y;}).join(' ');
 return '<svg class="tracker-chart" viewBox="0 0 320 145" role="img" aria-label="Gewichtsverlauf"><path d="M18 20V116H302" fill="none" stroke="var(--line)"/><path d="'+path+'" fill="none" stroke="#20c9a5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+dots.map(function(d){return '<circle cx="'+d.x+'" cy="'+d.y+'" r="3.5" fill="#20c9a5"/>';}).join('')+'</svg>';
}
window.TP_NUTRITION={render:render};
})();