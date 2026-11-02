(function(){
'use strict';
var KEY='tennisPerformanceNutritionV1', OFF='https://world.openfoodfacts.org';
var main=function(){return document.getElementById('main');}, pageTitle=function(){return document.getElementById('pageTitle');};
function today(){var d=new Date();return iso(d);} function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parseDate(s){return new Date(s+'T12:00:00');} function fresh(){return {profile:{height:180,startWeight:69,calories:2600,surplus:200,carb:45,protein:25,fat:30,phase:'Muskelaufbau'},days:{},weights:{},trackerDays:{},foodDays:{},view:'tracker'};}
function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.days&&x.weights&&x.profile){var d=Object.assign(fresh(),x);if(!d.trackerDays)d.trackerDays={};if(!d.foodDays)d.foodDays={};d.view='tracker';return d;}}catch(e){}return fresh();}
var data=load(), draft=[], matches={}, status='', stream=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function num(v){return Number(v||0).toLocaleString('de-DE',{maximumFractionDigits:1});}
function label(s){return parseDate(s).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});}
function records(){return Object.keys(data.trackerDays||{}).sort().map(function(k){return Object.assign({date:k},data.trackerDays[k]);});}
function energyRecords(){return records().filter(function(r){return Number.isFinite(+r.energy)&&r.energy>0;}).slice(-7);}
function averageEnergy(){var a=energyRecords();return a.length?a.reduce(function(s,r){return s+(+r.energy);},0)/a.length:null;}
function averageWeight(){var a=records().filter(function(r){return Number.isFinite(+r.weight)&&r.weight>0;}).slice(-7);return a.length?a.reduce(function(s,r){return s+(+r.weight);},0)/a.length:null;}
function target(){var a=averageEnergy();return energyRecords().length<7||a==null?null:Math.round((a+(+data.profile.surplus||200))/50)*50;}
function foodToday(){return data.foodDays[today()]||[];}
function totals(items){return items.reduce(function(t,x){var n=x.nutrients||{};Object.keys(t).forEach(function(k){t[k]+=Number(n[k]||0)*Number(x.grams||0)/100;});return t;},{kcal:0,protein:0,carbs:0,fat:0,fiber:0});}
function ring(value,goal,color,labelText){var pct=goal>0?Math.min(100,value/goal*100):0,c=2*Math.PI*37;return '<div class="food-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="37" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="50" cy="50" r="37" fill="none" stroke="'+color+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+(c*pct/100)+' '+c+'" transform="rotate(-90 50 50)"/></svg><b>'+Math.round(pct)+'%</b></div><strong>'+num(value)+' / '+num(goal)+' g</strong><small>'+labelText+'</small>';}
function render(){
 if(!main())return; pageTitle().textContent='Ernährung';
 var html='<section class="nut-wrap tracker-wrap"><div class="nut-subnav"><button class="'+(data.view==='tracker'?'active':'')+'" data-nview="tracker">Kalorien & Gewicht</button><button class="'+(data.view==='diary'?'active':'')+'" data-nview="diary">Ernährungstagebuch</button></div>';
 if(data.view==='diary'){html+=diaryHTML();}else{html+=trackerHTML();}
 html+='</section>';main().innerHTML=html;
 Array.from(document.querySelectorAll('[data-nview]')).forEach(function(b){b.onclick=function(){data.view=b.dataset.nview;save();render();};});
 if(data.view==='tracker')bindTracker();else bindDiary();
}
function trackerHTML(){
 var todayRecord=data.trackerDays[today()]||{},a=energyRecords(),avg=averageEnergy(),goal=target(),ws=records().filter(function(r){return +r.weight>0;}).slice(-14),progress=Math.min(100,Math.round(a.length/7*100));
 return '<div class="tracker-intro"><div class="nut-eyebrow">MUSKELAUFBAU · DEINE DATEN</div><h2>Kalorien & Gewicht</h2><p>Sieben Tage messen, einen Startwert berechnen und das Ziel anschließend mit deinem Gewichtsverlauf feinjustieren.</p></div><div class="card tracker-progress"><div class="nut-section-head"><h2>Deine Messwoche</h2><span class="nut-pill">'+a.length+' von 7 Tagen</span></div><div class="tracker-progress-track"><span style="width:'+progress+'%"></span></div><small class="muted">Trage den Gesamtverbrauch deiner Apple Watch und dein Morgengewicht ein. Lokal auf diesem Gerät gespeichert.</small></div><div class="tracker-stats"><div class="card tracker-stat"><span class="tracker-stat-icon">🔥</span><small>Ø Tagesverbrauch</small><strong>'+(avg==null?'—':num(avg)+' kcal')+'</strong></div><div class="card tracker-stat"><span class="tracker-stat-icon">⚖️</span><small>Ø Gewicht, letzte 7 Einträge</small><strong>'+(averageWeight()==null?'—':num(averageWeight())+' kg')+'</strong></div></div><div class="card"><div class="nut-section-head"><h2>Heutige Daten</h2><span class="nut-pill">'+label(today())+'</span></div><form class="tracker-form" id="trackerForm"><label>Gesamtenergieverbrauch laut Apple Watch (kcal)</label><input id="trackerEnergy" type="number" min="500" max="10000" placeholder="z. B. 2650" value="'+esc(todayRecord.energy||'')+'" required><small class="muted">Gesamter Tagesverbrauch – nicht nur aktive Energie.</small><label>Morgengewicht (kg)</label><input id="trackerWeight" type="number" min="20" max="350" step="0.1" placeholder="z. B. 69,0" value="'+esc(todayRecord.weight||data.weights[today()]||'')+'"><label>Tatsächlich gegessene Kalorien (optional)</label><input id="trackerEaten" type="number" min="0" max="10000" placeholder="wird aus dem Ernährungstagebuch übernommen" value="'+esc(todayRecord.eaten||'')+'"><button class="btn primary full" type="submit">Tagesdaten speichern</button></form></div><div class="card tracker-target"><div class="nut-eyebrow">VORLÄUFIGES KALORIENZIEL</div><strong>'+(goal==null?'Noch nicht berechnet':num(goal)+' kcal / Tag')+'</strong><p>'+(a.length<7?'Sobald sieben Tagesverbräuche eingetragen sind, berechnen wir den Durchschnitt plus deinen Überschuss.':'Durchschnitt der letzten sieben Verbrauchswerte plus '+num(data.profile.surplus)+' kcal Überschuss.')+'</p><div class="tracker-surplus"><label>Überschuss für Muskelaufbau</label><select id="trackerSurplus"><option value="150" '+(+data.profile.surplus===150?'selected':'')+'>+150 kcal</option><option value="200" '+(+data.profile.surplus===200?'selected':'')+'>+200 kcal</option><option value="250" '+(+data.profile.surplus===250?'selected':'')+'>+250 kcal</option><option value="300" '+(+data.profile.surplus===300?'selected':'')+'>+300 kcal</option></select></div></div><div class="card"><div class="nut-section-head"><h2>Gewichtsverlauf</h2><span class="nut-pill">Letzte 14 Einträge</span></div>'+chart(ws)+'<p class="muted">Das Gewicht schwankt täglich. Wir passen das Ziel anhand des Trends über mehrere Wochen an.</p></div>';
}
function diaryHTML(){
 var meals=foodToday(),t=totals(meals),calGoal=target()||data.profile.calories||2600,proteinGoal=Math.round(calGoal*.25/4),carbGoal=Math.round(calGoal*.45/4),fatGoal=Math.round(calGoal*.30/9);
 return '<div class="tracker-intro"><div class="nut-eyebrow">DEIN ERNÄHRUNGSTAGEBUCH</div><h2>Was hast du heute gegessen?</h2><p>Lebensmittel vor dem Kochen mit Rohgewicht erfassen. Produkte werden anhand von Name und Marke gesucht.</p></div><div class="card food-summary"><div class="food-calories"><span>Kalorien heute</span><strong>'+num(t.kcal)+' <small>/ '+num(calGoal)+' kcal</small></strong><div class="tracker-progress-track"><span style="width:'+Math.min(100,t.kcal/calGoal*100)+'%"></span></div></div><div class="food-macros"><div>'+ring(t.protein,proteinGoal,'#20c9a5','Protein')+'</div><div>'+ring(t.carbs,carbGoal,'#f59e0b','Kohlenhydrate')+'</div><div>'+ring(t.fat,fatGoal,'#8b5cf6','Fett')+'</div></div><p class="muted">Ziele aus deiner aktuellen Kalorienverteilung. Nährwerte werden pro 100 g skaliert.</p></div><div class="card"><div class="nut-section-head"><h2>Mahlzeit hinzufügen</h2><span class="nut-pill">Rohgewicht</span></div><label for="foodInput">Zutaten eingeben oder diktieren</label><textarea id="foodInput" rows="3" placeholder="z. B. 200 g Basmati-Reis von REWE Bio, 150 g Hähnchenbrust, 100 g Brokkoli"></textarea><div class="food-actions"><button class="btn" id="voiceFood" type="button">🎙️ Diktieren</button><button class="btn primary" id="parseFood" type="button">Zutaten erkennen</button></div><p class="muted">Beispiel: „200 Gramm Basmati-Reis von REWE Bio und 150 Gramm Hähnchenbrust“. Du kannst erkannte Mengen und Produkte vor dem Speichern prüfen.</p><div id="foodDraft"></div></div><div class="card"><div class="nut-section-head"><h2>Barcode scannen</h2></div><div class="food-actions"><input id="barcodeInput" inputmode="numeric" placeholder="Barcode eingeben"><button class="btn" id="lookupBarcode" type="button">Suchen</button><button class="btn" id="cameraBarcode" type="button">Kamera öffnen</button></div><div id="barcodeResult"></div><video id="barcodeVideo" playsinline muted style="display:none;width:100%;max-height:240px;border-radius:12px;margin-top:10px"></video><p class="muted">Kamera-Scan benötigt eine sichere HTTPS-Verbindung und Browserunterstützung. Manuelle Barcode-Eingabe bleibt als Alternative.</p></div><div class="card"><div class="nut-section-head"><h2>Heutige Lebensmittel</h2><span class="nut-pill">'+meals.length+' Einträge</span></div>'+(meals.length?meals.map(function(x,i){return '<div class="food-entry"><div><b>'+esc(x.name)+'</b><small>'+esc(x.brand||'')+' · '+num(x.grams)+' g roh</small></div><strong>'+num((x.nutrients.kcal||0)*x.grams/100)+' kcal</strong><button class="nut-link" data-remove="'+i+'">Entfernen</button></div>';}).join(''):'<p class="muted">Noch keine Lebensmittel eingetragen.</p>')+'<button class="btn primary full" id="saveMeal" type="button" '+(!meals.length?'disabled':'')+'>Mahlzeit / Einträge speichern</button></div><div class="card"><div class="nut-section-head"><h2>Mikronährstoffe & Aminosäuren</h2></div><p class="muted">Diese Werte zeigen wir je Lebensmittel an, wenn sie in der Datenbank tatsächlich hinterlegt sind. Fehlende Angaben werden nicht geschätzt. Die aktuelle Produktdatenbank liefert je nach Produkt unterschiedlich vollständige Profile.</p>'+microSummary(meals)+'</div>';
}
function microSummary(meals){
 var fields=[['fiber','Ballaststoffe','g'],['sugars','Zucker','g'],['salt','Salz','g'],['sodium','Natrium','mg'],['calcium','Calcium','mg'],['iron','Eisen','mg'],['potassium','Kalium','mg'],['magnesium','Magnesium','mg'],['vitamin-c','Vitamin C','mg'],['vitamin-d','Vitamin D','µg'],['vitamin-b12','Vitamin B12','µg']];
 return '<div class="food-micro-grid">'+fields.map(function(f){var available=meals.some(function(x){return x.nutrients[f[0]]!=null;});return '<div><small>'+f[1]+'</small><b>'+(available?'In Produktdetails':'Keine vollständigen Daten')+'</b></div>';}).join('')+'</div><p class="muted">Aminosäureprofile sind in Open Food Facts nicht flächendeckend verfügbar. Wir kennzeichnen sie nur, wenn konkrete Werte vorliegen.</p>';
}
function bindTracker(){
 var form=document.getElementById('trackerForm');form.onsubmit=function(e){e.preventDefault();var energy=Number(document.getElementById('trackerEnergy').value),w=document.getElementById('trackerWeight').value,eaten=document.getElementById('trackerEaten').value;if(!Number.isFinite(energy)||energy<500||energy>10000)return;var entry={energy:energy};if(w!==''&&Number(w)>=20&&Number(w)<=350){entry.weight=Number(w);data.weights[today()]=Number(w);}var foodKcal=totals(foodToday()).kcal;if(eaten!=='')entry.eaten=Number(eaten);else if(foodKcal>0)entry.eaten=Math.round(foodKcal);data.trackerDays[today()]=entry;save();render();};
 document.getElementById('trackerSurplus').onchange=function(e){data.profile.surplus=Number(e.target.value)||200;save();render();};
}
function parseIngredients(text){
 var out=[],re=/(?:^|[,;\\n]\\s*|\\s+und\\s+|\\s+)(\\d+(?:[.,]\\d+)?)\\s*(kg|gramm|g|ml)\\s+([\\s\\S]*?)(?=\\s*(?:(?:[,;\\n]+|\\s+und\\s+)\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:kg|gramm|g|ml)\\b|$)/gi,m;
 while((m=re.exec(text))!==null){
  var name=m[3].trim().replace(/^[,;]+|[,;]+$/g,'').trim();
  if(!name)continue;
  var grams=Number(m[1].replace(',','.'))*(/^kg$/i.test(m[2])?1000:1);
  out.push({name:name,grams:grams,raw:m[0].trim()});
 }
 return out;
}
function bindDiary(){
 document.getElementById('parseFood').onclick=async function(){var parsed=parseIngredients(document.getElementById('foodInput').value);if(!parsed.length){alert('Bitte gib Zutaten mit Mengen an, zum Beispiel „200 g Basmati-Reis von REWE Bio“.');return;}draft=parsed;matches={};renderDraft();for(var i=0;i<draft.length;i++){await searchFood(i,draft[i].name);}};
 document.getElementById('voiceFood').onclick=startVoice;
 document.getElementById('lookupBarcode').onclick=function(){lookupBarcode(document.getElementById('barcodeInput').value.trim());};
 document.getElementById('cameraBarcode').onclick=startCamera;
 document.querySelectorAll('[data-remove]').forEach(function(b){b.onclick=function(){var list=foodToday();list.splice(Number(b.dataset.remove),1);data.foodDays[today()]=list;save();render();};});
 var saveBtn=document.getElementById('saveMeal');if(saveBtn)saveBtn.onclick=function(){if(!foodToday().length)return;var tr=data.trackerDays[today()]||{};tr.eaten=Math.round(totals(foodToday()).kcal);data.trackerDays[today()]=tr;save();render();};
}
function renderDraft(){
 var el=document.getElementById('foodDraft');if(!el)return;
 el.innerHTML=draft.map(function(x,i){var list=matches[i]||[];return '<div class="food-draft-row"><b>'+esc(x.name)+'</b><div class="food-actions"><label>Menge (g roh)<input data-grams="'+i+'" type="number" min="1" value="'+esc(x.grams)+'"></label><button class="btn" data-search="'+i+'">Erneut suchen</button></div>'+(list.length?list.map(function(p,j){return '<button class="food-match" data-match="'+i+'" data-index="'+j+'"><b>'+esc(p.name)+'</b><small>'+esc(p.brand||'Marke nicht angegeben')+' · '+num(p.nutrients.kcal||0)+' kcal / 100 g</small></button>';}).join(''):'<p class="muted">'+(matches[i]===null?'Suche läuft …':'Noch kein Treffer – du kannst manuell eintragen.')+'</p>')+'<button class="nut-link" data-manual="'+i+'">Nährwerte manuell eingeben</button></div>';}).join('');
 el.querySelectorAll('[data-grams]').forEach(function(inp){inp.onchange=function(){draft[Number(inp.dataset.grams)].grams=Math.max(1,Number(inp.value)||1);};});
 el.querySelectorAll('[data-match]').forEach(function(b){b.onclick=function(){var i=Number(b.dataset.match),p=matches[i][Number(b.dataset.index)];p.grams=draft[i].grams;foodToday().push(p);data.foodDays[today()]=foodToday();save();draft.splice(i,1);render();};});
 el.querySelectorAll('[data-search]').forEach(function(b){b.onclick=function(){searchFood(Number(b.dataset.search),draft[Number(b.dataset.search)].name);};});
 el.querySelectorAll('[data-manual]').forEach(function(b){b.onclick=function(){manualEntry(Number(b.dataset.manual));};});
}
async function searchFood(i,query){
 matches[i]=null;renderDraft();
 try{
  var clean=query.replace(/\\b(von|bei|aus|marke)\\b/gi,' ').replace(/\\b(rewe|edeka|aldi|lidl|kaufland|bio)\\b/gi,' ').replace(/\\s+/g,' ').trim();
  var words=clean.split(' ').filter(function(w){return w.length>2;});
  var queries=[query,clean,words.slice(0,3).join(' ')].filter(function(q,j,a){return q&&a.indexOf(q)===j;});
  var found=[];
  for(var q=0;q<queries.length&&found.length<6;q++){
   var url=OFF+'/cgi/search.pl?search_terms='+encodeURIComponent(queries[q])+'&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,code,nutriments,quantity';
   var res=await fetch(url,{headers:{'Accept':'application/json'}});
   if(!res.ok)continue;
   var json=await res.json();
   (json.products||[]).filter(function(p){return p.product_name&&p.nutriments;}).forEach(function(p){
    var item=productObject(p),key=(item.name+'|'+item.brand).toLowerCase();
    if(!found.some(function(x){return (x.name+'|'+x.brand).toLowerCase()===key;}))found.push(item);
   });
  }
  matches[i]=found;
 }catch(e){matches[i]=[];status='Datenbank gerade nicht erreichbar.';}
 renderDraft();
}
function nutrientMap(n){var keys={'energy-kcal_100g':'kcal','proteins_100g':'protein','carbohydrates_100g':'carbs','fat_100g':'fat','fiber_100g':'fiber','sugars_100g':'sugars','salt_100g':'salt','sodium_100g':'sodium','calcium_100g':'calcium','iron_100g':'iron','potassium_100g':'potassium','magnesium_100g':'magnesium','vitamin-c_100g':'vitamin-c','vitamin-d_100g':'vitamin-d','vitamin-b12_100g':'vitamin-b12'};var out={};Object.keys(keys).forEach(function(k){if(n[k]!=null&&Number.isFinite(Number(n[k])))out[keys[k]]=Number(n[k]);});if(out.kcal==null&&n['energy-kj_100g']!=null)out.kcal=Number(n['energy-kj_100g'])/4.184;return out;}
function productObject(p){return {name:p.product_name,brand:p.brands||'',grams:100,barcode:p.code||'',nutrients:nutrientMap(p.nutriments||{}),quantity:p.quantity||''};}
async function lookupBarcode(code){
 var el=document.getElementById('barcodeResult');if(!/^\d{8,14}$/.test(code)){el.textContent='Bitte gib einen gültigen Barcode ein.';return;}el.textContent='Produkt wird gesucht …';
 try{var r=await fetch(OFF+'/api/v2/product/'+encodeURIComponent(code)+'.json?fields=product_name,brands,code,nutriments,quantity');var j=await r.json();if(j.status!==1||!j.product)throw Error('Nicht gefunden');var p=productObject(j.product);el.innerHTML='<div class="food-match"><b>'+esc(p.name)+'</b><small>'+esc(p.brand)+' · '+num(p.nutrients.kcal||0)+' kcal / 100 g</small><label>Menge (g roh)<input id="barcodeGrams" type="number" value="100" min="1"></label><button class="btn primary full" id="addBarcode">Zum Tag hinzufügen</button></div>';document.getElementById('addBarcode').onclick=function(){p.grams=Number(document.getElementById('barcodeGrams').value)||100;foodToday().push(p);data.foodDays[today()]=foodToday();save();render();};}
 catch(e){el.textContent='Produkt nicht gefunden oder Datenbank nicht erreichbar. Du kannst es über die manuelle Eingabe ergänzen.';}
}
function manualEntry(i){var x=draft[i],k=prompt('Kalorien pro 100 g für '+x.name+'?');if(k===null)return;var p={name:x.name,brand:'Manuell',grams:x.grams,nutrients:{kcal:Number(k)||0,protein:Number(prompt('Protein (g) pro 100 g?')||0),carbs:Number(prompt('Kohlenhydrate (g) pro 100 g?')||0),fat:Number(prompt('Fett (g) pro 100 g?')||0)}};foodToday().push(p);data.foodDays[today()]=foodToday();save();draft.splice(i,1);render();}
function startVoice(){
 var inp=document.getElementById('foodInput');if(!inp)return;
 inp.placeholder='Tippe auf das Mikrofon der iPhone-Tastatur und sprich deine Zutaten ein …';
 inp.focus();
 // Kostenlose native iOS-Tastatur-Diktierfunktion statt nicht unterstützter Web Speech API.
 var hint=document.getElementById('voiceHint');
 if(hint){hint.textContent='Die Tastatur ist geöffnet. Tippe dort auf das Mikrofon, sprich deine Zutaten und tippe anschließend auf „Zutaten erkennen“. ';hint.style.display='block';}
}
async function startCamera(){
 if(!('BarcodeDetector'in window)||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert('Automatischer Kamera-Scan wird auf diesem Browser nicht unterstützt. Bitte Barcode manuell eingeben.');return;}
 var video=document.getElementById('barcodeVideo');try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});video.srcObject=stream;video.style.display='block';await video.play();var detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});var scan=function(){if(!stream)return;detector.detect(video).then(function(codes){if(codes.length){var code=codes[0].rawValue;stopCamera();document.getElementById('barcodeInput').value=code;lookupBarcode(code);}else{requestAnimationFrame(scan);}}).catch(function(){stopCamera();});};scan();}catch(e){stopCamera();alert('Kamerazugriff nicht möglich. Bitte erlaube den Zugriff oder gib den Barcode manuell ein.');}
}
function stopCamera(){if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}}
function chart(ws){if(ws.length<2)return '<div class="tracker-empty"><span>↗</span><p>Trage mindestens zwei Morgengewichte ein, damit hier dein Gewichtsdiagramm erscheint.</p></div>';var vals=ws.map(function(r){return +r.weight;}),min=Math.min.apply(null,vals)-.3,max=Math.max.apply(null,vals)+.3,span=max-min||1,dots=vals.map(function(v,i){return {x:18+i*(284/Math.max(1,vals.length-1)),y:116-(v-min)/span*82};}),path=dots.map(function(d,i){return (i?'L':'M')+d.x+' '+d.y;}).join(' ');return '<svg class="tracker-chart" viewBox="0 0 320 145" role="img" aria-label="Gewichtsverlauf"><path d="M18 20V116H302" fill="none" stroke="var(--line)"/><path d="'+path+'" fill="none" stroke="#20c9a5" stroke-width="3" stroke-linecap="round"/>'+dots.map(function(d){return '<circle cx="'+d.x+'" cy="'+d.y+'" r="3.5" fill="#20c9a5"/>';}).join('')+'</svg>';}
window.TP_NUTRITION={render:render};
})();