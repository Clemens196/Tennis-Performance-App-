(function(){
'use strict';
var KEY='tennisPerformanceNutritionV1';
var main=function(){return document.getElementById('main');};
var pageTitle=function(){return document.getElementById('pageTitle');};
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fresh(){return {profile:{height:180,startWeight:69,calories:2600,surplus:200,carb:45,protein:25,fat:30,phase:'Muskelaufbau'},days:{},weights:{},view:'overview'};}
function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.days&&x.weights&&x.profile)return Object.assign(fresh(),x);}catch(e){}return fresh();}
var data=load(),selected=today();
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function day(d){if(!data.days[d])data.days[d]={meals:[]};return data.days[d];}
function totals(d){var t={kcal:0,carb:0,protein:0,fat:0};(day(d).meals||[]).forEach(function(m){t.kcal+=+m.kcal||0;t.carb+=+m.carb||0;t.protein+=+m.protein||0;t.fat+=+m.fat||0;});return t;}
function goal(){return Math.max(0,+data.profile.calories||0);}
function grams(){var p=data.profile,k=goal(),sum=(+p.carb||0)+(+p.protein||0)+(+p.fat||0)||100;return {carb:Math.round(k*(+p.carb||0)/sum/4),protein:Math.round(k*(+p.protein||0)/sum/4),fat:Math.round(k*(+p.fat||0)/sum/9)};}
function ring(value,target,color,size,thick){var pct=target?Math.min(100,Math.round(value/target*100)):0,r=(size-thick)/2,c=2*Math.PI*r;return '<div class="nut-ring" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'" aria-hidden="true"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="'+thick+'"/><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+thick+'" stroke-linecap="round" stroke-dasharray="'+(c*pct/100)+' '+c+'" transform="rotate(-90 '+size/2+' '+size/2+')"/></svg><div class="nut-ring-label">'+Math.round(value)+'<small>'+pct+'%</small></div></div>';}
function dateLabel(s){var d=new Date(s+'T12:00:00');return d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});}
function mealMarkup(m,i){return '<div class="nut-meal"><div class="nut-meal-icon">'+(['☕','🍽️','🍎','🌙'][i%4])+'</div><div class="nut-meal-info"><b>'+esc(m.name)+'</b><small>'+esc(m.description||'Manuell eingetragen')+'</small><div class="nut-mini-bar"><span style="width:'+Math.min(100,(m.kcal/Math.max(1,goal()))*100)+'%"></span></div></div><div class="nut-meal-kcal"><b>'+Math.round(m.kcal)+' kcal</b><button class="nut-link" data-nut="remove-meal" data-index="'+i+'">Entfernen</button></div></div>';}
function subnav(){var items=[['overview','Tagesübersicht'],['weight','Gewicht'],['analysis','Verlauf'],['goals','Ziele'],['health','Apple Health']];return '<div class="nut-subnav">'+items.map(function(x){return '<button class="'+(data.view===x[0]?'active':'')+'" data-nut="view" data-view="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';}
function render(){
 if(!main())return;pageTitle().textContent='Ernährung';
 var p=data.profile;save();
 var html='<section class="nut-wrap">'+subnav();
 if(data.view==='overview')html+=overview();
 else if(data.view==='weight')html+=weightView();
 else if(data.view==='analysis')html+=analysisView();
 else if(data.view==='goals')html+=goalsView();
 else html+=healthView();
 html+='</section>';main().innerHTML=html;bind();
}
function overview(){
 var t=totals(selected),g=grams(),p=data.profile;
 return '<div class="nut-date-row"><button class="btn" data-nut="date" data-delta="-1">‹ Gestern</button><div><b>'+dateLabel(selected)+'</b><small>Tagesübersicht</small></div><button class="btn" data-nut="date" data-delta="1">Morgen ›</button></div>'+
 '<div class="card nut-hero"><div class="nut-eyebrow">KALORIEN HEUTE</div><div class="nut-main-ring">'+ring(t.kcal,goal(),'#20c9a5',190,13)+'<div><strong>'+Math.max(0,goal()-t.kcal).toLocaleString('de-DE')+'</strong><small>kcal übrig</small><p>'+Math.round(t.kcal).toLocaleString('de-DE')+' von '+goal().toLocaleString('de-DE')+' kcal</p></div></div><div class="nut-health-note"><span class="nut-dot"></span> Tagesziel: '+p.phase+' · '+p.surplus+' kcal geplanter Überschuss</div></div>'+
 '<div class="nut-macro-grid">'+macroCard('Kohlenhydrate',t.carb,g.carb,'#f5ad35')+macroCard('Protein',t.protein,g.protein,'#20c9a5')+macroCard('Fett',t.fat,g.fat,'#54a9f5')+'</div>'+
 '<div class="card"><div class="nut-section-head"><h2>Mahlzeiten</h2><span>'+day(selected).meals.length+' Einträge</span></div>'+(day(selected).meals.length?day(selected).meals.map(mealMarkup).join(''):'<p class="muted">Noch keine Mahlzeiten eingetragen. Die Erfassungsfunktionen ergänzen wir später.</p>')+'<button class="btn primary full" data-nut="add-meal">＋ Mahlzeit manuell hinzufügen</button></div>'+
 '<div class="card"><div class="nut-section-head"><h2>Tagesverbrauch</h2><span class="nut-pill">Apple Health geplant</span></div><p class="muted">Wenn die echte iOS-Anbindung eingerichtet ist, erscheinen hier Ruheenergie und aktive Energie. Bis dahin wird kein Verbrauchswert erfunden.</p><button class="btn full" data-nut="view" data-view="health">Apple-Health-Status ansehen</button></div>';
}
function macroCard(name,val,target,color){return '<div class="card nut-macro-card">'+ring(val,target,color,88,8)+'<b>'+name+'</b><strong>'+Math.round(val)+' / '+target+' g</strong><small>'+ (target?Math.round(val/target*100):0)+' % erreicht</small></div>';}
function weightView(){
 var entries=Object.keys(data.weights).sort().slice(-30),latest=entries.length?data.weights[entries[entries.length-1]]:null;
 var pts=entries.map(function(k){return '<div class="nut-weight-row"><span>'+dateLabel(k)+'</span><b>'+Number(data.weights[k]).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:2})+' kg</b><button class="nut-link" data-nut="remove-weight" data-date="'+k+'">×</button></div>';}).reverse();
 var avg=entries.slice(-7).reduce(function(s,k){return s+(+data.weights[k]||0);},0)/(entries.length?Math.min(7,entries.length):1);
 return '<div class="card"><div class="nut-section-head"><h2>Gewichtsentwicklung</h2><span class="nut-pill">Morgens wiegen</span></div><div class="nut-stats"><div><small>Startgewicht</small><b>'+pNum(data.profile.startWeight)+' kg</b></div><div><small>Letzter Eintrag</small><b>'+(latest==null?'—':pNum(latest)+' kg')+'</b></div><div><small>7-Tage-Mittel</small><b>'+(entries.length?pNum(avg)+' kg':'—')+'</b></div></div><form class="nut-form" id="nutWeightForm"><label for="nutWeight">Heutiges Gewicht (kg)</label><div class="nut-inline"><input id="nutWeight" type="number" min="20" max="350" step="0.1" placeholder="z. B. 69,0" required><button class="btn primary" type="submit">Speichern</button></div><small>Am besten nach dem Toilettengang, vor Essen und Trinken und ohne Kleidung.</small></form></div>'+
 '<div class="card"><h2>Deine letzten Einträge</h2>'+(pts.length?pts.join(''):'<p class="muted">Noch keine Gewichtseinträge. 69,0 kg ist dein festgelegter Ausgangswert.</p>')+'</div><div class="card"><h2>Kalorienanpassung</h2><p class="muted">Wir vergleichen den Gewichtstrend über mehrere Wochen mit deinem Ziel. Einzelne Tagesänderungen lösen keine automatische Anpassung aus.</p></div>';
}
function pNum(n){return Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});}
function analysisView(){
 var keys=Object.keys(data.weights).sort().slice(-14),vals=keys.map(function(k){return +data.weights[k];}),min=vals.length?Math.min.apply(null,vals)-.4:68,max=vals.length?Math.max.apply(null,vals)+.4:70,span=max-min||1;
 var dots=vals.map(function(v,i){return {x:24+i*(252/Math.max(1,vals.length-1)),y:132-(v-min)/span*100};});
 var path=dots.map(function(d,i){return (i?'L':'M')+d.x+' '+d.y;}).join(' ');
 return '<div class="card"><div class="nut-section-head"><h2>Gewichtsverlauf</h2><span>Letzte 14 Einträge</span></div>'+(dots.length>1?'<svg class="nut-chart" viewBox="0 0 300 160" role="img" aria-label="Gewichtsverlauf"><path d="M24 20V132H276" fill="none" stroke="var(--line)"/><path d="'+path+'" fill="none" stroke="#20c9a5" stroke-width="3"/>'+dots.map(function(d){return '<circle cx="'+d.x+'" cy="'+d.y+'" r="3.5" fill="#20c9a5"/>';}).join('')+'</svg>':'<p class="muted">Trage dein Gewicht regelmäßig ein, damit hier dein Diagramm entsteht.</p>')+'<p class="muted">Gewicht schwankt natürlich. Für die Bewertung zählt der Trend, nicht ein einzelner Morgen.</p></div>'+
 '<div class="card"><h2>Ernährungsauswertung</h2><p class="muted">Die Makro- und Kalorienverläufe werden sichtbar, sobald du Mahlzeiten einträgst. Die Erfassungsfunktionen kommen in einer späteren Ausbaustufe.</p></div>';
}
function goalsView(){
 var p=data.profile,g=grams();
 return '<form class="card nut-goal-form" id="nutGoalsForm"><div class="nut-section-head"><h2>Ernährungsziele</h2><span class="nut-pill">Individuell</span></div><label for="nutPhase">Zielphase</label><select id="nutPhase"><option '+(p.phase==='Muskelaufbau'?'selected':'')+'>Muskelaufbau</option><option '+(p.phase==='Erhalt'?'selected':'')+'>Erhalt</option><option '+(p.phase==='Definition'?'selected':'')+'>Definition</option></select><label for="nutCalories">Kalorienziel (kcal/Tag)</label><input id="nutCalories" type="number" min="1000" max="7000" step="50" value="'+esc(p.calories)+'" required><label for="nutSurplus">Geplanter Überschuss (kcal)</label><input id="nutSurplus" type="number" min="0" max="500" step="25" value="'+esc(p.surplus)+'"><p class="muted">Das Ziel ist zunächst manuell. Der dynamische Tagesverbrauch wird erst nach einer echten Apple-Health-Integration eingerechnet.</p><h3>Makroverteilung</h3><div class="nut-three-inputs"><div><label for="nutCarb">Kohlenhydrate %</label><input id="nutCarb" type="number" min="0" max="100" value="'+esc(p.carb)+'"></div><div><label for="nutProtein">Protein %</label><input id="nutProtein" type="number" min="0" max="100" value="'+esc(p.protein)+'"></div><div><label for="nutFat">Fett %</label><input id="nutFat" type="number" min="0" max="100" value="'+esc(p.fat)+'"></div></div><div class="nut-macro-preview"><span>Kohlenhydrate <b>'+g.carb+' g</b></span><span>Protein <b>'+g.protein+' g</b></span><span>Fett <b>'+g.fat+' g</b></span></div><button class="btn primary full" type="submit">Ziele speichern</button></form>';
}
function healthView(){return '<div class="card"><div class="nut-health-icon">♥</div><h2>Apple Health</h2><p>Die geplante Verbindung soll die Werte deiner Apple Watch nutzen, damit dein Kalorienziel an ruhigeren und aktiveren Tagen unterschiedlich ausfallen kann.</p><div class="nut-health-list"><div><span>Ruheenergie</span><b>Wird noch nicht verbunden</b></div><div><span>Aktive Energie</span><b>Wird noch nicht verbunden</b></div><div><span>Gesamtverbrauch</span><b>Erst nach Integration</b></div></div><div class="notice">Wichtig: Eine normale Browser-App kann Apple Health nicht einfach direkt auslesen. Dafür benötigen wir eine iOS-App bzw. eine geeignete native HealthKit-Brücke mit deinen ausdrücklichen Berechtigungen. Diese Anzeige ist noch keine aktive Verbindung.</div></div><div class="card"><h2>So wird das Tagesziel berechnet</h2><p class="muted">Ruheenergie + aktive Energie = geschätzter Tagesverbrauch. Darauf kommt dein gewählter kleiner Überschuss. Die Gewichtsentwicklung hilft anschließend, die Schätzung langfristig zu prüfen.</p></div>';}
function bind(){
 main().querySelectorAll('[data-nut]').forEach(function(b){b.onclick=function(){
 var a=b.getAttribute('data-nut');
 if(a==='view'){data.view=b.getAttribute('data-view');save();render();}
 else if(a==='date'){var d=new Date(selected+'T12:00:00');d.setDate(d.getDate()+(+b.getAttribute('data-delta')));selected=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');render();}
 else if(a==='add-meal'){var name=prompt('Name der Mahlzeit (z. B. Frühstück):');if(!name)return;var kcal=Number(prompt('Kalorien (kcal):','400'));if(!Number.isFinite(kcal)||kcal<0)return;var carb=Number(prompt('Kohlenhydrate in g:','45'))||0,protein=Number(prompt('Protein in g:','25'))||0,fat=Number(prompt('Fett in g:','12'))||0;day(selected).meals.push({name:name,kcal:kcal,carb:carb,protein:protein,fat:fat,description:'Manuell eingetragen'});save();render();}
 else if(a==='remove-meal'){day(selected).meals.splice(+b.getAttribute('data-index'),1);save();render();}
 else if(a==='remove-weight'){delete data.weights[b.getAttribute('data-date')];save();render();}
 };});
 var wf=document.getElementById('nutWeightForm');if(wf)wf.onsubmit=function(e){e.preventDefault();var v=Number(document.getElementById('nutWeight').value);if(v<20||v>350)return;data.weights[today()]=v;save();render();};
 var gf=document.getElementById('nutGoalsForm');if(gf)gf.onsubmit=function(e){e.preventDefault();var p=data.profile;p.phase=document.getElementById('nutPhase').value;p.calories=Math.max(1000,Math.min(7000,Number(document.getElementById('nutCalories').value)||2600));p.surplus=Math.max(0,Math.min(500,Number(document.getElementById('nutSurplus').value)||0));p.carb=Math.max(0,Math.min(100,Number(document.getElementById('nutCarb').value)||0));p.protein=Math.max(0,Math.min(100,Number(document.getElementById('nutProtein').value)||0));p.fat=Math.max(0,Math.min(100,Number(document.getElementById('nutFat').value)||0));if(p.carb+p.protein+p.fat===0){alert('Bitte mindestens einen Makroanteil größer 0 eingeben.');return;}save();render();};
}
window.TP_NUTRITION={render:render};
})();
