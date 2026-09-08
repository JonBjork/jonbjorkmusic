import {exercises,positions,fresh,validate,merge,completedDays,checkpoint,dateKey,clock,storageKey} from './model.js';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from '../student-workouts/metronome.js';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume} from '../student-workouts/guitarSynth.js';
const $=id=>document.getElementById(id);
let state=fresh(),initialWarning='';
try{const saved=localStorage.getItem(storageKey);if(saved)state=validate(JSON.parse(saved));}catch{initialWarning='Saved progress could not be loaded. You can still practise; import a backup if you have one.';}
let day=dateKey(),active=0,cursor=0,playing=false,loading=false,token=0,endTimer=null,count=null,shownPosition='';
const engine=createMetronomeEngine(),progress=()=>state.days[day]||[0,0,0,0];
active=Math.max(0,progress().findIndex((n,i)=>n<exercises[i].notes.length));cursor=progress()[active];
function store(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{$('notice').textContent='This browser could not save your progress. Use Export JSON before closing this page.';}}
function record(at){const row=[...progress()];row[active]=Math.max(row[active],checkpoint(at,exercises[active]));state.days[day]=row;store();}
function today(){if(day===dateKey())return false;stop();day=dateKey();active=Math.max(0,progress().findIndex((n,i)=>n<exercises[i].notes.length));cursor=progress()[active];shownPosition='';$('status').textContent='A new day. Your previous practice is saved.';return true;}
function stop(){token++;clearTimeout(endTimer);engine.stop();stopGuitar();playing=false;loading=false;count=null;}
function pause(){stop();record(cursor);$('status').textContent='Paused. Resume repeats the current position.';render();}
function select(id){stop();record(cursor);active=id;cursor=progress()[active];shownPosition='';$('status').textContent='';render();}
function nextExercise(){return [...exercises.slice(active+1),...exercises.slice(0,active)].find(e=>progress()[e.id]<e.notes.length)?.id;}
function controls(){
 for(const id of ['tone','bpm'])$(id).disabled=playing||loading;
 $('import').disabled=playing||loading;
 $('play').disabled=loading;
 $('play').textContent=loading?'Loading sound…':playing?'Pause':cursor>=exercises[active].notes.length?(nextExercise()!==undefined?`Start exercise ${nextExercise()+1} ▶`:`Replay exercise ${active+1} ▶`):cursor>0?`Resume exercise ${active+1} ▶`:`Start exercise ${active+1} ▶`;
 for(const id of ['instrument','metronome','subdivisions']){const enabled=state.settings[id];$(id).setAttribute('aria-checked',enabled);$(id).querySelector('span').textContent=enabled?'On':'Off';}
}
function render(){
 const exercise=exercises[active],n=exercise.notes[Math.min(cursor,exercise.notes.length-1)],finished=cursor>=exercise.notes.length;
 const pending=exercises.reduce((sum,e,i)=>sum+e.notes.length-(i===active?Math.min(cursor,e.notes.length):progress()[i]),0);
 $('remaining').textContent=clock(pending*30/state.settings.bpm);
 $('exerciseTime').textContent=clock((exercise.notes.length-Math.min(cursor,exercise.notes.length))*30/state.settings.bpm)+' left in exercise';
 $('exerciseLabel').textContent=`EXERCISE ${active+1} / 4`;$('exerciseName').textContent=exercise.name;
 $('positionLabel').textContent=`Index finger: fret ${n.position} · ${n.visit<16?'Up the neck':n.visit===16?'Turnaround':'Back down'}`;
 $('repLabel').textContent=count?`Count in · ${count}`:finished?'Exercise complete':`Repetition ${n.rep+1} of 2`;
 $('place').textContent=`Position ${n.visit+1} of 33 · 1 → 17 → 1`;
 $('rhythmLabel').textContent=`Eighth notes · ${state.settings.bpm} BPM`;
 $('musicProgress').max=exercise.notes.length;$('musicProgress').value=cursor;
 $('exerciseChoices').innerHTML=exercises.map((e,i)=>`<button data-exercise="${i}" aria-pressed="${active===i}" ${loading||playing?'disabled':''}><small>EXERCISE ${i+1} ${progress()[i]===e.notes.length?'· ✓':''}</small><strong>${e.name}</strong><span>${clock(e.notes.length*30/state.settings.bpm)}</span></button>`).join('');
 const key=`${active}:${n.position}`;
 if(key!==shownPosition){shownPosition=key;drawNotation(exercise,n.position);}
 document.querySelectorAll('#shape circle').forEach(dot=>{const lit=playing&&count===null&&+dot.dataset.string===n.string&&+dot.dataset.fret===n.fret;dot.setAttribute('fill',lit?'#dcc5ff':'#574168');dot.setAttribute('stroke',lit?'#fff':'#a779d4');dot.setAttribute('stroke-width',lit?'3':'1');});
 const marker=$('noteHighlight');marker.setAttribute('x',playing&&count===null?String(38+(n.rep*exercise.pattern.length+n.index)*40-15):'-99');
 if(playing&&count===null){const x=38+(n.rep*exercise.pattern.length+n.index)*40;$('tab').scrollLeft=Math.max(0,x-$('tab').clientWidth*.6);}
 $('completion').hidden=playing||loading||!progress().every((n,i)=>n===exercises[i].notes.length);
 controls();tracker();
}
function drawNotation(exercise,position){
 const notes=exercise.pattern.map(n=>({...n,fret:n.fret+position-1})),page=[...notes,...notes];const W=38+page.length*40,x=i=>38+i*40,y=s=>76+(s-1)*22;
 let svg=`<svg viewBox="0 0 ${W} 244" style="width:${W}px;height:244px" role="img" aria-label="${exercise.name}, position ${position}, two repetitions"><rect id="noteHighlight" x="-99" y="8" width="30" height="218" rx="5" fill="#7c3aed" opacity=".3"/>`;
 ['e','B','G','D','A','E'].forEach((s,i)=>svg+=`<text x="9" y="${y(i+1)+5}" fill="#aaa" font-size="14">${s}</text><path d="M27 ${y(i+1)}H${W-8}" stroke="#666"/>`);
 page.forEach((n,i)=>{const xx=x(i),yy=y(n.string);svg+=n.stroke==='D'?`<path d="M${xx-5} 35V24H${xx+5}V35" fill="none" stroke="#aa78f8" stroke-width="2"/>`:`<path d="M${xx-5} 24L${xx} 35L${xx+5} 24" fill="none" stroke="#eee" stroke-width="2"/>`;svg+=`<rect x="${xx-12}" y="${yy-10}" width="24" height="21" fill="#141414"/><text x="${xx}" y="${yy+6}" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">${n.fret}</text><path d="M${xx} 194V215" stroke="#eee" stroke-width="1.5"/>`;});
 for(let i=0;i<page.length;i+=2)svg+=`<path d="M${x(i)} 215H${x(i+1)}" stroke="#eee" stroke-width="3"/>`;
 svg+=`<text x="${x(0)}" y="238" fill="#a595b4" font-size="11">REP 1</text><text x="${x(notes.length)}" y="238" fill="#a595b4" font-size="11">REP 2</text></svg>`;
 $('tab').innerHTML=svg;$('tab').scrollLeft=0;
 const unique=[...new Map(notes.map(n=>[`${n.string}:${n.fret}`,n])).values()],min=Math.min(...notes.map(n=>n.fret)),max=Math.max(...notes.map(n=>n.fret)),width=40+(max-min+1)*34;
 let shape=`<p class="eyebrow">CURRENT SHAPE</p><strong>Position ${position}</strong><svg viewBox="0 0 ${width} 151" role="img" aria-label="${exercise.name} shape, frets ${min} to ${max}, high E at the top">`;
 for(let i=0;i<=max-min+1;i++)shape+=`<path d="M${30+i*34} 22V122" stroke="#443b50"/>`;
 ['e','B','G','D','A','E'].forEach((s,i)=>shape+=`<text x="9" y="${26+i*20}" font-size="10" fill="#aaa">${s}</text><path d="M30 ${22+i*20}H${width-10}" stroke="#655a70"/>`);
 for(let i=min;i<=max;i++)shape+=`<text x="${47+(i-min)*34}" y="144" text-anchor="middle" font-size="11" fill="#bfb2ce">${i}</text>`;
 unique.forEach(n=>shape+=`<circle data-string="${n.string}" data-fret="${n.fret}" cx="${47+(n.fret-min)*34}" cy="${22+(n.string-1)*20}" r="7" fill="#574168" stroke="#a779d4"/>`);
 $('shape').innerHTML=shape+'</svg>';
}
function tracker(){
 const days=completedDays(state),count=Math.min(30,days.length),done=progress().filter((n,i)=>n===exercises[i].notes.length).length;
 $('dayBadge').textContent=`${count} / 30`;$('daysTitle').textContent=`${count} of 30 days complete`;$('todayProgress').textContent=`Today: ${done} of 4 exercises complete.`;
 $('daysGrid').innerHTML=Array.from({length:30},(_,i)=>`<div class="day ${i<count?'complete':''}" title="${days[i]||'Not completed yet'}"><span>DAY ${i+1}</span><b>${i<count?'✓':i+1}</b>${days[i]?`<small>${days[i]}</small>`:''}</div>`).join('');
 $('milestones').innerHTML=[[7,'First week'],[14,'Two weeks'],[21,'Three weeks'],[30,'30 days of practice']].map(([n,label])=>`<div class="${count>=n?'reached':''}"><b>${count>=n?'✓ ':''}${label}</b><span>${count>=n?'Completed':`${n} practice days`}</span></div>`).join('');
 $('history').innerHTML=Object.entries(state.days).sort(([a],[b])=>b.localeCompare(a)).map(([date,p])=>`<li>${date} · ${p.filter((n,i)=>n===exercises[i].notes.length).length} of 4 exercises complete</li>`).join('')||'<li>Your first practice is waiting.</li>';
 $('completionText').textContent=count>=30?'You’ve completed the 30-day builder. Keep going whenever you want a focused sweep-picking session.':`Day ${count} complete. Come back for the next one—your progress is saved.`;
}
async function play(){
 today();if(playing){pause();return;}if(loading)return;
 if(cursor>=exercises[active].notes.length)cursor=0;else cursor=checkpoint(cursor,exercises[active]);
 loading=true;const run=++token,from=cursor,exercise=exercises[active],bpm=state.settings.bpm;$('status').textContent='';render();
 try{await primeMetronomeAudio();await prepareGuitar(getAudioContext(),state.settings.tone);if(run!==token)return;loading=false;playing=true;count=4;setInstrumentVolume(getAudioContext(),state.settings.instrumentVolume/100);engine.setVolume(state.settings.metronome?state.settings.metronomeVolume/100:0);render();
 const started=await engine.start({bpm,subdivision:2,audibleSubdivision:state.settings.subdivisions?2:1,countInBeats:4,onCountIn:n=>{if(run===token){count=n;render();}},onScheduleTick:(i,when)=>{
 if(run!==token)return false;const n=exercise.notes[from+i];if(!n){endTimer=setTimeout(()=>{if(run!==token)return;stop();cursor=exercise.notes.length;record(cursor);$('status').textContent=`Exercise ${active+1} complete. Take a breath.`;render();},Math.max(0,(when-getAudioContext().currentTime)*1000));return false;}
 engine.setAudibleSubdivision(state.settings.subdivisions?2:1);if(state.settings.instrument)pluck(getAudioContext(),n.midi,when,30/bpm,.5,{tight:true});return true;
 },onTick:i=>{if(run!==token)return;cursor=from+i;count=null;if(cursor%exercise.positionLength===0)record(cursor);render();}});
 if(started===false&&run===token)throw Error('Audio did not start.');
 }catch{if(run===token){stop();$('status').textContent='Could not start the audio. Check your connection and try again.';render();}}
}
$('play').onclick=()=>{today();if(!playing&&!loading&&cursor>=exercises[active].notes.length&&nextExercise()!==undefined)select(nextExercise());play();};
$('exerciseChoices').onclick=e=>{const b=e.target.closest('[data-exercise]');if(b&&!playing&&!loading){today();select(+b.dataset.exercise);}};
$('bpm').value=state.settings.bpm;$('tone').value=state.settings.tone;
$('bpm').onchange=()=>{state.settings.bpm=Math.max(40,Math.min(160,Math.round(Number($('bpm').value)||60)));$('bpm').value=state.settings.bpm;store();render();};
$('bpm').onwheel=e=>e.target.blur();
$('tone').onchange=()=>{state.settings.tone=$('tone').value;store();};
for(const id of ['instrument','metronome','subdivisions'])$(id).onclick=()=>{state.settings[id]=!state.settings[id];if(id==='instrument'&&!state.settings.instrument)stopGuitar();if(id==='metronome')engine.setVolume(state.settings.metronome?state.settings.metronomeVolume/100:0);store();controls();};
for(const id of ['instrumentVolume','metronomeVolume']){$(id).value=state.settings[id];$(id+'Value').textContent=state.settings[id]+'%';$(id).oninput=()=>{state.settings[id]=+$(id).value;$(id+'Value').textContent=$(id).value+'%';if(id==='instrumentVolume')setInstrumentVolume(getAudioContext(),state.settings[id]/100);else engine.setVolume(state.settings.metronome?state.settings[id]/100:0);store();};}
function view(progressView){if(playing||loading)pause();today();$('practiceView').hidden=progressView;$('progressView').hidden=!progressView;$('practiceTab').setAttribute('aria-pressed',!progressView);$('progressTab').setAttribute('aria-pressed',progressView);render();}
$('practiceTab').onclick=()=>view(false);$('progressTab').onclick=()=>view(true);
$('export').onclick=()=>{record(cursor);const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sweeps-progress-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('notice').textContent='Progress exported. Keep this file somewhere safe.';};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw Error('Choose a backup smaller than 2 MB.');const incoming=validate(JSON.parse(await file.text()));if(playing||loading)throw Error('Pause before importing.');state=merge(state,incoming);day=dateKey();cursor=progress()[active];shownPosition='';store();render();$('notice').textContent='Backup merged. Existing progress was kept.';}catch(error){$('notice').textContent=error instanceof SyntaxError?'That file is not valid JSON.':error.message;}finally{e.target.value='';}};
window.addEventListener('pagehide',()=>{stop();record(cursor);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||loading))pause();else if(!document.hidden&&today())render();});
$('notice').textContent=initialWarning;render();
