(function(){
'use strict';
var matches=[
  {date:'2026-11-21',name:'Tennisspiel 1'},
  {date:'2027-01-23',name:'Tennisspiel 2'},
  {date:'2027-03-06',name:'Tennisspiel 3'}
];
var phases=[
  {start:'2026-10-20',end:'2026-11-15',name:'Hypertrophie I',kind:'hypertrophy',focus:'Muskelmasse und Belastbarkeit aufbauen; Schnellkraft mit kurzem Qualitätsreiz erhalten.'},
  {start:'2026-11-16',end:'2026-11-21',name:'Match-Check I',kind:'match',focus:'Ermüdung senken, Geschwindigkeit erhalten, frisch ins Spiel gehen.'},
  {start:'2026-11-22',end:'2027-01-17',name:'Hypertrophie II',kind:'hypertrophy',focus:'Muskelaufbau fortsetzen, Umfang und Gewichte kontrolliert steigern; Schnellkraft erhalten.'},
  {start:'2027-01-18',end:'2027-01-23',name:'Match-Check II',kind:'match',focus:'Volumen zurücknehmen und Frische für den zweiten Leistungs-Check herstellen.'},
  {start:'2027-01-24',end:'2027-02-28',name:'Maximalkraft',kind:'maxstrength',focus:'Aufgebaute Muskelmasse für hohe Kraftentwicklung nutzen; Schnellkraft kurz erhalten.'},
  {start:'2027-03-01',end:'2027-03-06',name:'Match-Check III',kind:'match',focus:'Kurze Taper-Woche vor dem dritten Spiel.'},
  {start:'2027-03-07',end:'2027-04-30',name:'Maximalkraft & Schnellkraft',kind:'maxstrength',focus:'Maximalkraft festigen und zunehmend in explosive tennisnahe Bewegungen übertragen.'},
  {start:'2027-05-01',end:'2027-05-31',name:'Pre-Season',kind:'preseason',focus:'Kraftvolumen senken, Explosivität und tennisspezifische Qualität hoch halten.'},
  {start:'2027-06-01',end:'2027-12-31',name:'In-Season',kind:'season',focus:'Kraft und Power erhalten, Tennis und Spiele priorisieren, unnötige Ermüdung vermeiden.'}
];

function x(id,name,category,pattern,target,sets,rest,equipment,fatigue,phases,desc,type,metric){
  return {id:id,name:name,category:category,pattern:pattern,target:target,sets:sets,rest:rest,
    equipment:equipment,fatigue:fatigue,phases:phases,desc:desc,type:type||category,metric:metric||'reps'};
}
var A=['build','power','preseason','season','match'];
var BP=['build','power'], BS=['build','season'], PPS=['power','preseason','season'];

var library=[
  x('cmj','Countermovement Jumps','power','vertical_jump','3 × 4',3,120,['Körpergewicht'],1,A,'Maximal vertikal springen, sauber landen und jede Wiederholung neu vorbereiten.','power','quality'),
  x('squat_jump','Squat Jumps','power','vertical_jump','3 × 4',3,120,['Körpergewicht'],1,PPS,'Kurze Gegenbewegung, explosiv abspringen, Landung stabilisieren.','power','quality'),
  x('box_jump','Box Jumps','power','vertical_jump','3 × 3',3,120,['Box'],1,PPS,'Explosiv abspringen; nur so hoch wählen, dass die Landung sauber bleibt.','power','quality'),
  x('pogo','Pogo Jumps','power','elastic_jump','3 × 12–20 Sek.',3,75,['Körpergewicht'],1,['power','preseason','season'],'Kurze Bodenkontaktzeit, steife Sprunggelenke, rhythmisch springen.','power','quality'),
  x('broad','Standing Broad Jumps','power','horizontal_jump','3 × 3',3,120,['Körpergewicht'],1,A,'Explosiv nach vorne springen und stabil landen.','power','quality'),
  x('bounds','Alternating Bounds','power','horizontal_jump','3 × 10–20 m',3,120,['Körpergewicht'],2,['power','preseason'],'Weite, elastische Schritte; Qualität vor Distanz.','power','quality'),
  x('lat','Lateral Bounds','power','lateral_jump','3 × 4 je Seite',3,120,['Körpergewicht'],1,A,'Explosiv seitlich abspringen, kontrolliert auf einem Bein landen.','power','quality'),
  x('skater','Skater Jumps','power','lateral_jump','3 × 5 je Seite',3,90,['Körpergewicht'],1,PPS,'Seitlich springen und Landung kurz stabilisieren.','power','quality'),
  x('lateral_hop','Lateral Hurdle Hops','power','lateral_jump','3 × 5 je Seite',3,90,['Minihürde'],2,['power','preseason'],'Kurze seitliche Sprünge über niedrige Hürde; Kontaktzeiten kurz halten.','power','quality'),
  x('split_jump','Split Jumps','power','unilateral_jump','3 × 4 je Seite',3,105,['Körpergewicht'],2,['power','preseason'],'Aus Ausfallschritt explosiv springen, stabil landen.','power','quality'),

  x('rot','Seitliche Medizinball-Rotationswürfe','power','rotation_power','3 × 4 je Seite',3,105,['Medizinball','Wand'],1,A,'Hüfte und Rumpf explosiv rotieren und Ball schnell abgeben.','power','quality'),
  x('scoop_toss','Medizinball Scoop Toss','power','rotation_power','3 × 4 je Seite',3,105,['Medizinball','Wand'],1,PPS,'Tief starten, Hüfte einleiten und Ball seitlich explosiv werfen.','power','quality'),
  x('shotput_throw','Medizinball Shot-Put Throw','power','rotation_power','3 × 4 je Seite',3,105,['Medizinball','Wand'],1,PPS,'Einarmig aus Rotation/Brust explosiv gegen die Wand werfen.','power','quality'),
  x('chest','Medizinball-Brustpässe','power','horizontal_push_power','3 × 4',3,105,['Medizinball','Wand'],1,A,'Aus Brusthöhe maximal explosiv nach vorne werfen.','power','quality'),
  x('overhead_throw','Medizinball Overhead Throw','power','overhead_power','3 × 4',3,105,['Medizinball'],1,PPS,'Über Kopf explosiv nach vorne werfen; Rumpf und Hüfte koordinieren.','power','quality'),
  x('slam','Medizinball Overhead Slams','power','overhead_power','3 × 5',3,120,['Medizinball'],1,A,'Ball über Kopf führen und explosiv zum Boden werfen.','power','quality'),
  x('rot_slam','Rotational Medicine Ball Slam','power','rotation_power','3 × 4 je Seite',3,105,['Medizinball'],1,['power','preseason'],'Aus Rotation diagonal/seitlich explosiv zum Boden slammen.','power','quality'),
  x('plyo','Explosive Liegestütze','power','horizontal_push_power','3 × 4–6',3,120,['Körpergewicht'],1,A,'Kontrolliert absenken und maximal explosiv wegdrücken.','power','quality'),

  x('squat','Langhantel-Kniebeugen','strength','knee_dominant','3 × 3–5',3,210,['Langhantel','Rack'],3,BP,'Sauber und schwer, etwa 2 Wiederholungen in Reserve.','strength','load'),
  x('front_squat','Front Squat','strength','knee_dominant','3 × 3–5',3,210,['Langhantel','Rack'],3,BP,'Aufrechter Oberkörper, kontrolliert tief, kräftig hoch.','strength','load'),
  x('goblet_squat','Goblet Squat','strength','knee_dominant','3 × 6–10',3,120,['Kurzhantel','Kettlebell'],2,['build','season'],'Gewicht vor der Brust, kontrolliert tief, stabil aufrichten.','strength','load'),
  x('trap_bar','Trap-Bar Deadlift','strength','hinge_strength','3 × 3–5',3,210,['Trap Bar'],3,BP,'Neutraler Rücken, Boden kräftig wegdrücken, keine Grind-Reps.','strength','load'),
  x('rdl','Rumänisches Kreuzheben','hypertrophy','hinge','2 × 8–10',2,150,['Langhantel'],2,BS,'Hüfte nach hinten, Rücken neutral, hintere Kette kontrolliert belasten.','hypertrophy','load'),
  x('db_rdl','Kurzhantel-RDL','hypertrophy','hinge','2–3 × 8–12',3,120,['Kurzhanteln'],2,BS,'Kurzhanteln dicht am Körper, Hüfte weit nach hinten.','hypertrophy','load'),
  x('hip_thrust','Hip Thrust','hypertrophy','hip_extension','3 × 8–12',3,120,['Langhantel','Bank'],2,BS,'Gesäß aktiv strecken, oben kurz kontrollieren.','hypertrophy','load'),
  x('bulg','Bulgarian Split Squats','hypertrophy','unilateral_knee','2 × 8–12 je Bein',2,150,['Kurzhanteln','Bank'],2,BS,'Kontrolliert absenken; Beinachse stabil halten.','hypertrophy','load'),
  x('reverse_lunge','Reverse Lunges','hypertrophy','unilateral_knee','2–3 × 8–12 je Bein',3,120,['Kurzhanteln'],2,BS,'Rückwärts aussteigen, vorderes Bein stabil belasten.','hypertrophy','load'),
  x('step_up','Step-Ups','hypertrophy','unilateral_knee','2–3 × 8–12 je Bein',3,120,['Box','Kurzhanteln'],2,BS,'Über das obere Bein hochdrücken, nicht vom unteren Bein abspringen.','hypertrophy','load'),
  x('split_squat','Split Squat','hypertrophy','unilateral_knee','2–3 × 8–12 je Bein',3,120,['Kurzhanteln'],2,BS,'Stabiler Ausfallschritt, kontrolliert absenken.','hypertrophy','load'),
  x('calf','Wadenheben stehend','strength','calf_strength','2 × 8–12',2,75,['Maschine','Kurzhanteln'],1,A,'Voller Bewegungsumfang, oben kurz stabilisieren.','strength','load'),
  x('single_calf','Einbeiniges Wadenheben','strength','calf_strength','2–3 × 10–15',3,75,['Körpergewicht','Kurzhantel'],1,A,'Einbeinig kontrolliert über vollen Bewegungsumfang arbeiten.','strength','load'),

  x('bench','Langhantel-Bankdrücken','hypertrophy','horizontal_push','3 × 6–10',3,150,['Langhantel','Bank'],2,BS,'Schulterblätter stabil, kontrolliert absenken, kräftig hochdrücken.','hypertrophy','load'),
  x('db_bench','Kurzhantel-Bankdrücken','hypertrophy','horizontal_push','3 × 8–12',3,120,['Kurzhanteln','Bank'],2,BS,'Neutral/stabil drücken und schmerzfreien Bewegungsumfang nutzen.','hypertrophy','load'),
  x('pushup','Liegestütze','hypertrophy','horizontal_push','3 × 8–20',3,90,['Körpergewicht'],1,A,'Körper als Linie, Brust kontrolliert absenken, sauber hochdrücken.','hypertrophy','reps'),
  x('dips','Dips','hypertrophy','vertical_push','3 × 6–10',3,150,['Barren'],2,BS,'Nur schmerzfreie Tiefe, kontrolliert absenken und kräftig hochdrücken.','hypertrophy','load'),
  x('landmine_press','Landmine Press','strength','vertical_push','3 × 6–10 je Seite',3,105,['Langhantel','Landmine'],1,['build','power','season'],'Diagonal nach vorne/oben drücken; Schulterblatt frei bewegen lassen.','strength','load'),
  x('shoulder','Kurzhantel-Schulterdrücken','hypertrophy','vertical_push','2 × 8–10',2,120,['Kurzhanteln'],2,BS,'Rumpf stabil, kontrolliert über Kopf drücken.','hypertrophy','load'),
  x('pike','Pike Push-ups','hypertrophy','vertical_push','2 × 6–10',2,120,['Körpergewicht'],2,BS,'Hüfte hoch, Kopf kontrolliert Richtung Boden, kräftig wegdrücken.','hypertrophy','reps'),

  x('pull','Klimmzüge','hypertrophy','vertical_pull','3 × 6–10',3,150,['Klimmzugstange'],2,BS,'Sauber aus dem Hang ziehen; Schulterblätter kontrollieren.','hypertrophy','load'),
  x('chinup','Chin-ups','hypertrophy','vertical_pull','3 × 6–10',3,150,['Klimmzugstange'],2,BS,'Untergriff, kontrolliert ziehen, nicht schwingen.','hypertrophy','load'),
  x('lat_pulldown','Lat Pulldown','hypertrophy','vertical_pull','3 × 8–12',3,120,['Kabelzug'],2,BS,'Brust hoch, Ellbogen nach unten ziehen.','hypertrophy','load'),
  x('aus','Australian Pull-ups','hypertrophy','horizontal_pull','3 × 8–12',3,120,['Stange','TRX'],1,A,'Körper als Linie halten und Brust zur Stange ziehen.','hypertrophy','reps'),
  x('row','Einarmiges Kurzhantelrudern','hypertrophy','horizontal_pull','3 × 8–12 je Seite',3,120,['Kurzhantel','Bank'],2,BS,'Rücken stabil, Hantel Richtung Hüfte ziehen.','hypertrophy','load'),
  x('chest_row','Chest-Supported Row','hypertrophy','horizontal_pull','3 × 8–12',3,120,['Kurzhanteln','Bank'],1,BS,'Brust auf Bank ablegen, Ellbogen kontrolliert zurückziehen.','hypertrophy','load'),
  x('cable_row','Kabelrudern','hypertrophy','horizontal_pull','3 × 8–12',3,120,['Kabelzug'],1,BS,'Rumpf stabil und Griff kontrolliert zum Oberkörper ziehen.','hypertrophy','load'),
  x('face_pull','Face Pulls','hypertrophy','scapular_pull','2–3 × 12–15',3,75,['Kabelzug','Band'],1,A,'Zum Gesicht ziehen und Schulterblätter kontrolliert bewegen.','hypertrophy','load'),
  x('blat','Seitheben mit Widerstandsband','hypertrophy','lateral_raise','2 × 10–15',2,75,['Band'],1,A,'Arme kontrolliert seitlich anheben, Schultern unten halten.','hypertrophy','load'),
  x('dblat','Kurzhantel-Seitheben','hypertrophy','lateral_raise','2 × 10–15',2,75,['Kurzhanteln'],1,BS,'Kontrolliert seitlich anheben, ohne Schwung.','hypertrophy','load'),
  x('pullover','Kurzhantel-Pullover','hypertrophy','shoulder_extension','2 × 8–12',2,90,['Kurzhantel','Bank'],1,BS,'Kontrolliert hinter den Kopf führen und zurück.','hypertrophy','load'),

  x('pallof','Pallof Press','stability','anti_rotation','2 × 8 je Seite',2,75,['Kabelzug','Band'],1,A,'Rotation verhindern, Rumpf ruhig halten.','stability','load'),
  x('cable_chop','Cable Chop','stability','rotation_control','2–3 × 8 je Seite',3,75,['Kabelzug'],1,A,'Rotation kontrolliert über Rumpf und Hüfte übertragen.','stability','load'),
  x('dead_bug','Dead Bug','stability','anti_extension','2–3 × 6–10 je Seite',3,60,['Körpergewicht'],1,A,'Lendenwirbelsäule stabil, diagonal Arm/Bein strecken.','stability','reps'),
  x('side_plank','Side Plank','stability','lateral_core','2 × 20–40 Sek. je Seite',2,60,['Körpergewicht'],1,A,'Körperlinie stabil halten, Becken nicht absinken lassen.','stability','time'),
  x('copen','Copenhagen Plank','stability','adductor_core','2 × 15–25 Sek. je Seite',2,75,['Bank'],2,A,'Oberes Knie auf Bank, Becken stabil anheben.','stability','time'),
  x('bandwalk','Miniband Side Walks','stability','hip_abductor','2 × 10–12 Schritte je Seite',2,60,['Miniband'],1,A,'Bandspannung halten, Becken stabil, kontrolliert seitwärts.','stability','reps'),
  x('suitcase','Suitcase Carry','stability','lateral_core','3 × 20–30 m je Seite',3,75,['Kurzhantel','Kettlebell'],1,['build','season'],'Einseitig tragen, Rumpf aufrecht halten.','stability','load'),
  x('farmer','Farmer Carry','strength','carry','3 × 20–40 m',3,90,['Kurzhanteln','Kettlebells'],2,['build','season'],'Schwer tragen, Haltung stabil und Schritte kontrolliert.','strength','load'),

  x('ero','Schulter-Außenrotation am Kabelzug','strength','external_rotation','2 × 12–15 je Seite',2,75,['Kabelzug'],1,A,'Ellenbogen nah am Körper, leicht bis moderat und schmerzfrei.','strength','load'),
  x('band_ero','Schulter-Außenrotation mit Band','strength','external_rotation','2 × 12–15 je Seite',2,60,['Band'],1,A,'Leicht, kontrolliert und schmerzfrei nach außen rotieren.','strength','load'),
  x('wall','Wall Slides','mobility','scapula','2 × 10',2,45,['Wand'],1,A,'Arme kontrolliert an der Wand nach oben führen.','mobility','reps'),
  x('serratus_slide','Serratus Wall Slides','mobility','scapula','2 × 8–12',2,45,['Wand','Miniband'],1,A,'Schulterblatt nach oben rotieren lassen, Rippen kontrollieren.','mobility','reps'),

  x('mob','Allgemeine Mobilisation','mobility','general_mobility','5 Min.',1,0,['Körpergewicht'],1,A,'Armkreisen, Beinpendel und lockere Ganzkörpermobilisation.','mobility','note'),
  x('worlds','World’s Greatest Stretch','mobility','general_mobility','1–2 × 5 je Seite',2,30,['Körpergewicht'],1,A,'Ausfallschritt mit Hüftöffnung und Brustwirbelsäulenrotation.','mobility','reps'),
  x('hip90','90/90 Hip Switches','mobility','hip_rotation','2 × 8 Wechsel',2,30,['Körpergewicht'],1,A,'Kontrollierte Hüftrotation ohne Schwung.','mobility','reps'),
  x('cossack','Cossack Squats','mobility','lateral_hip','2 × 6 je Seite',2,45,['Körpergewicht'],1,A,'Breiter Stand, kontrolliert seitlich absenken.','mobility','reps'),
  x('adductor_rock','Adductor Rockbacks','mobility','lateral_hip','2 × 8 je Seite',2,30,['Körpergewicht'],1,A,'Adduktor kontrolliert mobilisieren, Rücken neutral halten.','mobility','reps'),
  x('knee','Knee-to-Wall','mobility','ankle_mobility','2 × 10 je Seite',2,30,['Wand'],1,A,'Knie Richtung Wand führen, Ferse bleibt am Boden.','mobility','reps'),
  x('calfstretch','Wadendehnung','mobility','ankle_mobility','2 × 30 Sek. je Seite',2,30,['Wand'],1,A,'Ferse unten halten und sanft nach vorne verlagern.','mobility','time'),
  x('open','Open Books','mobility','tspine_rotation','1 × 8 je Seite',1,30,['Körpergewicht'],1,A,'Brustwirbelsäule rotieren, Becken stabil halten.','mobility','reps'),
  x('cool','Lockeres Cool-down','mobility','cooldown','6 Min.',1,0,['Körpergewicht'],1,A,'Ruhige Schulter-/Hüftbewegungen und entspannte Atmung.','mobility','note'),

  x('tennis','Tennistraining','tennis','tennis','Reguläre Einheit',1,0,['Tennisplatz'],2,A,'Dauer, Intensität und Beingefühl dokumentieren.','tennis','tennis'),
  x('shadow','Shadow Tennis Footwork','conditioning','tennis_footwork','3–5 × 20 Sek.',4,60,['Tennisplatz'],2,['power','preseason','season'],'Tennisspezifische Laufwege ohne Ball mit sauberem Split-Step.','endurance','quality'),
  x('intervals','Tennisspezifische Intervalle','conditioning','tennis_intervals','2 Serien × 5 × 15 Sek. / 45 Sek.',2,180,['Tennisplatz'],3,['build','power','preseason'],'15 Sek. intensive Beinarbeit, 45 Sek. locker; 3 Min. Serienpause.','endurance','endurance'),
  x('shuttle_5105','5-10-5 Shuttle','conditioning','change_direction','4–6 Läufe',4,90,['Markierungen'],3,['power','preseason'],'Kurze Richtungswechsel mit klarer Bremsposition und sauberem Abdruck.','endurance','quality'),
  x('court_shuttle','Court Shuttles','conditioning','tennis_intervals','6–10 × 15–20 Sek.',6,45,['Tennisplatz'],3,['preseason'],'Tennislinien als Wendepunkte; saubere Richtungswechsel vor maximaler Ermüdung.','endurance','endurance'),
  x('run','Lockerer Dauerlauf','endurance','easy_endurance','30–45 Min. · RPE 3–4/10',1,0,['Laufschuhe'],2,A,'Gleichmäßiges Gesprächstempo.','endurance','endurance'),
  x('bike_easy','Lockeres Radfahren','endurance','easy_endurance','35–50 Min. · RPE 3–4/10',1,0,['Fahrrad','Ergometer'],1,A,'Lockere Grundlagenausdauer mit geringer Stoßbelastung.','endurance','endurance')
];

function byId(id){
  for(var i=0;i<library.length;i++)if(library[i].id===id)return library[i];
  return null;
}
function scoreExercise(e,kind){
  var score=0;
  if(e.phases.indexOf(kind)>=0)score+=5;
  if(kind==='build'&&(e.category==='strength'||e.category==='hypertrophy'))score+=4;
  if(kind==='power'&&e.category==='power')score+=5;
  if(kind==='preseason'&&(e.category==='power'||e.category==='conditioning'))score+=5;
  if(kind==='season'&&e.fatigue<=1)score+=3;
  if(kind==='match'&&(e.fatigue<=1||e.category==='mobility'))score+=5;
  return score-e.fatigue*.25;
}
function suggest(kind,limit){
  var a=library.slice();
  a.sort(function(p,q){return scoreExercise(q,kind)-scoreExercise(p,kind);});
  return a.slice(0,limit||12);
}
window.TP_PLANNER={matches:matches,phases:phases,library:library,byId:byId,suggest:suggest};
})();