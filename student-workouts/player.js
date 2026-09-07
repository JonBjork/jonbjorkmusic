import {buildPlan,blockAt,noteAt,remaining,localDate,freshState,validateState,mergeState} from './model.js';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from './metronome.js';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume} from './guitarSynth.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>`${Math.floor(Math.ceil(Math.max(0,s))/60)}:${String(Math.ceil(Math.max(0,s))%60).padStart(2,'0')}`;
const tuning={6:40,5:45,4:50,3:55,2:59,1:64};
export function mount(root,config){
 const key=`jb-student-v1:${config.id}`;let state=freshState(config.id),warning='';
 const limit=buildPlan(config,state.settings).length;
 try{const raw=localStorage.getItem(key);if(raw)state=validateState(JSON.parse(raw),config.id,limit);}catch(e){warning='Saved progress could not be read. Export a backup after practising to keep a separate copy.';}
 let plan,activePlan,active=state.activeWorkout||blockAt(buildPlan(config,state.settings),Math.min(state.checkpoint.cursor,limit-1)).kind,playing=false,loading=false,token=0,queue=[],endTime=null,count=null,frame=0,entry=null,lastSave=0,shownPage='',selectedDay=localDate(),unlock=null;
 const engine=createMetronomeEngine();
 function rebuild(){const dayIndex=new Set(state.events.filter(e=>e.day<localDate()&&e.seconds>0).map(e=>e.day)).size;plan=buildPlan(config,state.settings,dayIndex);const blocks=plan.blocks.filter(b=>b.kind===active);activePlan={blocks,length:blocks.length?blocks.at(-1).start+blocks.at(-1).length:0};}
 rebuild();
 root.innerHTML=`<header><a href="/" class="brand">JON BJORK</a><span class="eyebrow">YOUR GUITAR WORKOUT</span><h1>${esc(config.name)}</h1><div class="tabs" role="tablist" aria-label="Workout views"><button role="tab" aria-selected="true" id="practiceTab">Practice</button><button role="tab" aria-selected="false" id="trackerTab">Your progress</button></div></header>
 <p id="message" role="status" class="message"></p>
 <section id="practice"><nav class="workout-choices" aria-label="Choose a routine"><button data-workout="hammers"><span>01</span>All hammers</button><button data-workout="picking"><span>02</span>Triplet picking</button><button data-workout="deepdive"><span>03</span>Alternate Picking Deep Dive</button></nav><section id="unassigned" class="panel" hidden><h2>Alternate Picking Deep Dive</h2><p class="muted">Your exercises will appear here when your routine is ready.</p></section><div id="assigned"><div class="overview"><span id="place"></span><span><b id="remaining"></b> music remaining</span></div><div class="workout-grid"><section class="score-panel"><div class="score-heading"><div><span class="eyebrow" id="kind"></span><h2 id="combination"></h2></div><span id="position" class="pill"></span></div><details class="guide"><summary>Exercise guide</summary><p id="description" class="muted"></p></details><div class="score-label"><span id="rhythm"></span><span id="count" aria-live="polite"></span></div><div class="transport"><button id="play" class="primary">Start workout</button><button id="restart" class="quiet">Restart combination</button></div><div id="tab" class="notation" aria-label="Guitar tablature"></div><div class="notation-nav"><button id="prevPage" class="quiet" aria-label="Previous notation page">←</button><span id="pageLabel"></span><button id="nextPage" class="quiet" aria-label="Next notation page">→</button></div><p class="muted small">Your place saves automatically. Each position finishes before you start the next with a fresh four-beat count-in.</p></section>
 <aside><section class="panel"><h2>Routine</h2><label>Continue from<select id="block"></select></label><div class="tempo-row"><label id="hammersTempo">Tempo · BPM<input id="hammersBpm" type="number" min="20" max="200" step="1"></label><label id="pickingTempo">Tempo · BPM<input id="pickingBpm" type="number" min="20" max="200" step="1"></label></div><p id="subdivisionLabel" class="small muted"></p><details id="strokeSettings"><summary>Starting strokes</summary><label>Alternate starts<select id="strategy"><option value="positions">By position and practice day</option><option value="days">By practice day only</option></select></label><label>First practice day starts<select id="firstStroke"><option value="D">Downstroke</option><option value="U">Upstroke</option></select></label><p class="small muted">The start flips on each new day you practise. Nine-note patterns keep alternating through every repeat.</p></details></section>
 <section class="panel"><h2>Sound</h2><label>Instrument<select id="tone"><option value="electric">Clean electric</option><option value="nylon">Nylon string</option><option value="piano">Grand piano</option><option value="harpsichord">Harpsichord</option></select></label><label class="check"><input type="checkbox" id="instrumentOn">Instrument</label><input aria-label="Instrument volume" id="instrumentVolume" type="range" min="0" max="100"><label class="check"><input type="checkbox" id="metronomeOn">Metronome</label><input aria-label="Metronome volume" id="metronomeVolume" type="range" min="0" max="100"><label class="check"><input type="checkbox" id="subdivisions">Hear subdivisions</label></section></aside></div></div></section>
 <section id="tracker" hidden><div class="stats" id="stats"></div><section class="panel"><div class="score-heading"><h2>Practice days</h2><span class="small muted">Last 13 weeks</span></div><div id="heatmap" class="heatmap"></div><p class="small muted">Select a day to see what you played. Brighter squares mean more playing time.</p><label class="date-label">View day<input type="date" id="day"></label><div id="daily"></div></section><section class="panel backup"><div><h2>Keep a backup</h2><p class="muted">Progress stays in this browser. It is not synced or shared with your teacher. Export a JSON backup to keep it safe or move it to another device.</p></div><div class="backup-buttons"><button id="export">Export JSON</button><label class="file-button">Import JSON<input id="import" type="file" accept=".json,application/json"></label></div></section></section>
 <footer><span>Made for your practice · Jon Bjork</span><a href="/student-workouts/audio/CREDITS.txt">Sound credits</a></footer>`;
 const $=id=>root.querySelector(`#${id}`);
 function message(text){$('message').textContent=text;}
 function save(){state.checkpoint.updatedAt=new Date().toISOString();state.activeWorkout=active;if(active!=="deepdive"){state.progress??={};state.progress[active]={...state.checkpoint};}try{localStorage.setItem(key,JSON.stringify(state));}catch(e){message('This browser could not save your progress. Use Export JSON to keep a backup.');}}
 function settingsUI(){for(const [k,v] of Object.entries(state.settings)){const el=$(k);if(!el)continue;if(el.type==='checkbox')el.checked=v;else el.value=v;}}
 function controls(){if(active==="deepdive")return;for(const id of ['hammersBpm','pickingBpm','strategy','firstStroke','tone','block','restart','prevPage','nextPage'])$(id).disabled=playing||loading;$('play').textContent=loading?'Cancel loading':playing?'Pause':state.checkpoint.cursor>=activePlan.length?'Start next round':state.checkpoint.cursor>activePlan.blocks[0].start?'Resume workout':'Start workout';}
 window.addEventListener('resize',()=>{shownPage='';previewOffset=null;score();});
 function options(){if(active==='deepdive')return;const selected=blockAt(activePlan,state.checkpoint.cursor);$('block').innerHTML=activePlan.blocks.map((b,i)=>`<option value="${i}" ${b.id===selected.id?'selected':''}>${b.title} · position ${b.position} · ${b.fingering}</option>`).join('');}
 let previewOffset=null;
 function score(cursor=state.checkpoint.cursor){if(active==="deepdive")return;
  const b=blockAt(activePlan,cursor),n=noteAt(b,cursor),ni=b.notes.indexOf(n),pageSize=window.matchMedia("(max-width:500px)").matches?6:12,offset=previewOffset??Math.floor(ni/pageSize)*pageSize;
  const page=b.notes.slice(offset,offset+pageSize),pageKey=`${b.id}:${offset}:${b.stroke}`;
  $('kind').textContent=b.title;$('combination').textContent=`Fingers ${b.fingering.split('').join(' · ')}`;$('position').textContent=`Position ${b.position}`;
  $('description').textContent=config.exercises.find(e=>e.kind===b.kind).description;
  $('rhythm').textContent=`${b.bpm} BPM · ${b.sub===3?'Eighth-note triplets':'Eighth notes'} · ${b.kind==='hammers'?'All hammers':b.stroke==='D'?'Downstroke start':'Upstroke start'}`;
  $('place').textContent=`Round ${state.checkpoint.cycle} · Combination ${activePlan.blocks.indexOf(b)+1} of ${activePlan.blocks.length}`;
  $('remaining').textContent=clock(remaining(activePlan,cursor));$('count').textContent=count?`Count in · ${count}`:playing?'Playing':cursor>=activePlan.length?'Round complete':'Ready';
  $('pageLabel').textContent=`Notes ${offset+1}–${offset+page.length} of ${b.notes.length}`;
  if(pageKey!==shownPage){
   shownPage=pageKey;const x=i=>38+i*40,y=s=>80+(s-1)*22,W=38+Math.max(page.length,3)*40;
   let svg=`<svg viewBox="0 0 ${W} 262" role="img" aria-label="${esc(b.title)}, fingering ${b.fingering}, position ${b.position}"><rect id="highlight" width="32" height="222" y="12" rx="5" fill="#7c3aed" opacity=".28" x="-99"/>`;
   ['e','B','G','D','A','E'].forEach((s,i)=>{svg+=`<text x="9" y="${y(i+1)+5}" fill="#b4b4b4" font-size="14">${s}</text><line x1="27" x2="${W-8}" y1="${y(i+1)}" y2="${y(i+1)}" stroke="#666"/>`;});
   page.forEach((note,i)=>{const xx=x(i),yy=y(note.string);svg+=note.stroke==='H'?`<text x="${xx}" y="34" text-anchor="middle" fill="#c9aaff" font-size="15">H</text>`:note.stroke==='D'?`<path d="M${xx-5} 36V25H${xx+5}V36" fill="none" stroke="#c9aaff" stroke-width="2"/>`:`<path d="M${xx-5} 25L${xx} 36L${xx+5} 25" fill="none" stroke="#eee" stroke-width="2"/>`;
    svg+=`<rect x="${xx-13}" y="${yy-11}" width="26" height="22" fill="#181818"/><text x="${xx}" y="${yy+6}" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">${note.fret}</text>`;
    if(note.len>1)svg+=`<text x="${xx}" y="246" text-anchor="middle" fill="#c9aaff" font-size="12">4 beats</text>`;
    else svg+=`<line class="note-stem" x1="${xx}" y1="${yy+11}" x2="${xx}" y2="226" stroke="#eee" stroke-width="1.4"/>`;
   });
   for(let i=0;i<page.length;i+=b.sub){const group=page.slice(i,i+b.sub);if(group.some(n=>n.len>1))continue;const x1=x(i),x2=x(i+group.length-1);svg+=`<path d="M${x1} 226H${x2}" stroke="#eee" stroke-width="3"/>`;if(b.sub===3)svg+=`<path d="M${x1-4} 248v-5h${Math.max(8,x2-x1+8)}v5" fill="none" stroke="#b4b4b4"/><text x="${(x1+x2)/2}" y="259" text-anchor="middle" fill="#ddd" font-size="12">3</text>`;}
   $('tab').innerHTML=svg+'</svg>';
  }
  const h=$('highlight');if(h){h.setAttribute('visibility',playing&&count===null?'visible':'hidden');h.setAttribute('x',String(38+(ni-offset)*40-16));}
 }
 function applySound(){if(active==="deepdive")return;const s=state.settings;engine.setVolume(s.metronomeOn?s.metronomeVolume/100:0);engine.setAudibleSubdivision(s.subdivisions?blockAt(activePlan,state.checkpoint.cursor).sub:1);setInstrumentVolume(getAudioContext(),s.instrumentOn?s.instrumentVolume/100:0);if(!s.instrumentOn)stopGuitar();}
 function credit(t,seconds,finished){
  const b=t.block,day=localDate();
  if(!entry||entry.block!==b.id||entry.day!==day){const e={id:crypto.randomUUID(),day,kind:b.kind,position:b.position,fingering:b.fingering,bpm:b.bpm,stroke:b.kind==='hammers'?'H':b.stroke,seconds:0,notes:0,completed:false};state.events.push(e);entry={event:e,block:b.id,day};}
  entry.event.seconds+=seconds;
  if(finished){const n=noteAt(b,t.index);if(t.index===b.start+n.at+n.len-1)entry.event.notes++;if(t.index===b.start+b.length-1)entry.event.completed=true;}
 }
 function reconcile(partial=false){const now=getAudioContext()?.currentTime??0;while(queue.length&&queue[0].end<=now){const t=queue.shift();credit(t,t.end-t.when,true);state.checkpoint.cursor=t.index+1;}
  if(partial&&queue[0]&&queue[0].when<now){credit(queue[0],Math.min(now,queue[0].end)-queue[0].when,false);}
 }
 function stop(text=''){if(playing)reconcile(true);token++;playing=false;loading=false;engine.stop();stopGuitar();cancelAnimationFrame(frame);queue=[];endTime=null;count=null;entry=null;previewOffset=null;if(unlock){unlock();unlock=null;}save();options();controls();score();renderTracker();if(text)message(text);}
 function animate(){if(!playing)return;reconcile();score(queue[0]&&queue[0].when<=getAudioContext().currentTime?queue[0].index:state.checkpoint.cursor);
  if(endTime!==null&&getAudioContext().currentTime>=endTime){const complete=state.checkpoint.cursor>=activePlan.length;stop(complete?'Round complete. Your practice is saved. Start the next round when you’re ready.':'Position complete. Your place is saved. Continue when you’re ready.');return;}
  if(performance.now()-lastSave>1000){save();lastSave=performance.now();}frame=requestAnimationFrame(animate);
 }
 async function play(){
  if(playing||loading){stop('Paused. Your place is saved.');return;}
  if(navigator.locks){let acquired;await new Promise(resolve=>{navigator.locks.request(key,{ifAvailable:true},async lock=>{acquired=!!lock;resolve();if(lock)await new Promise(r=>{unlock=r;});});});if(!acquired){message('This workout is already playing in another tab. Pause it there first.');return;}}
  if(state.checkpoint.cursor>=activePlan.length){state.checkpoint.cursor=activePlan.blocks[0].start;state.checkpoint.cycle++;}
  rebuild();shownPage='';previewOffset=null;loading=true;controls();message('Preparing instrument…');const my=++token;
  try{await primeMetronomeAudio();await prepareGuitar(getAudioContext(),state.settings.tone);if(token!==my)return;
   applySound();loading=false;playing=true;count=4;entry=null;queue=[];const from=state.checkpoint.cursor,b=blockAt(activePlan,from);const end=plan.blocks.find(x=>x.start>from&&(x.kind!==b.kind||x.position!==b.position))?.start??activePlan.length;
   controls();message('');
   await engine.start({bpm:b.bpm,subdivision:b.sub,countInBeats:4,audibleSubdivision:state.settings.subdivisions?b.sub:1,countInSubdivide:state.settings.subdivisions,countInSubdivision:b.sub,onCountIn:n=>{if(my===token){count=n;score();}},onScheduleTick:(i,when)=>{
    if(token!==my)return false;const index=from+i;if(index>=end){endTime=when;return false;}
    const block=blockAt(activePlan,index),note=noteAt(block,index),seconds=60/block.bpm/block.sub;
    engine.setBpm(block.bpm);engine.setSubdivision(block.sub);engine.setAudibleSubdivision(state.settings.subdivisions?block.sub:1);
    queue.push({index,when,end:when+seconds,block});
    if(state.settings.instrumentOn&&(index===from||index===block.start+note.at))pluck(getAudioContext(),tuning[note.string]+note.fret,when,(note.len-(index-block.start-note.at))*seconds,.5,{tight:note.len===1});return true;
   },onTick:()=>{if(my===token)count=null;}});
   if(token===my)frame=requestAnimationFrame(animate);
  }catch(e){stop('Audio could not start. Check your connection and try again.');}
 }
 function renderTracker(){
  const totals=new Map();for(const e of state.events){const d=totals.get(e.day)||{seconds:0,notes:0,completed:0};d.seconds+=e.seconds;d.notes+=e.notes;d.completed+=Number(e.completed);totals.set(e.day,d);}
  const today=totals.get(localDate())||{seconds:0,notes:0};const all=state.events.reduce((a,e)=>a+e.seconds,0);
  $('stats').innerHTML=`<div><span>Today</span><strong>${clock(today.seconds)}</strong><small>playing time</small></div><div><span>All time</span><strong>${clock(all)}</strong><small>playing time</small></div><div><span>Practice days</span><strong>${[...totals.values()].filter(d=>d.seconds>0).length}</strong><small>days with playing time</small></div><div><span>Today’s notes</span><strong>${today.notes}</strong><small>played through the workout</small></div>`;
  const dates=Array.from({length:91},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-90+i);return localDate(d);});
  $('heatmap').innerHTML=dates.map(day=>{const seconds=totals.get(day)?.seconds||0;const level=seconds===0?0:seconds<300?1:seconds<900?2:seconds<1800?3:4;return `<button class="heat level${level}" data-day="${day}" aria-label="${day}: ${clock(seconds)} playing time" aria-pressed="${day===selectedDay}" title="${day} · ${clock(seconds)}"></button>`;}).join('');
  $('day').value=selectedDay;
  const entries=state.events.filter(e=>e.day===selectedDay),groups=new Map();for(const e of entries){const k=[e.kind,e.position,e.fingering,e.bpm,e.stroke].join(':');const g=groups.get(k)||{...e,seconds:0,notes:0,completed:0};g.seconds+=e.seconds;g.notes+=e.notes;g.completed+=Number(e.completed);groups.set(k,g);}
  $('daily').innerHTML=`<h3>${esc(selectedDay)} · ${clock(totals.get(selectedDay)?.seconds||0)}</h3>`+(groups.size?`<div class="table-scroll"><table><thead><tr><th>Exercise / fingers</th><th>Position</th><th>Tempo / start</th><th>Time</th><th>Notes</th><th>Finishes</th></tr></thead><tbody>${[...groups.values()].map(g=>`<tr><td>${g.kind==='hammers'?'All hammers':'Triplet picking'} · ${g.fingering}</td><td>${g.position}</td><td>${g.bpm} BPM · ${g.stroke==='H'?'Hammers':g.stroke==='D'?'Down':'Up'}</td><td>${clock(g.seconds)}</td><td>${g.notes}</td><td>${g.completed}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Finishes count each time you reach the end of a combination. Playing time excludes pauses and count-ins.</p>`:'<p class="muted">No practice recorded for this day yet.</p>');
 }
 $('play').onclick=play;$('restart').onclick=()=>{state.checkpoint.cursor=blockAt(activePlan,state.checkpoint.cursor).start;previewOffset=null;save();score();controls();};
 $('block').onchange=()=>{state.checkpoint.cursor=activePlan.blocks[Number($('block').value)].start;previewOffset=null;save();score();controls();message('Place changed. Skipped combinations are not logged as practice.');};
 for(const [id,delta] of [['prevPage',-12],['nextPage',12]])$(id).onclick=()=>{const b=blockAt(activePlan,state.checkpoint.cursor),size=window.matchMedia('(max-width:500px)').matches?6:12;previewOffset=Math.max(0,Math.min(Math.floor((b.notes.length-1)/size)*size,(previewOffset??Math.floor(b.notes.indexOf(noteAt(b,state.checkpoint.cursor))/size)*size)+Math.sign(delta)*size));score();};
 for(const k of Object.keys(state.settings)){const el=$(k);if(!el)continue;el.onchange=()=>{const value=el.type==='checkbox'?el.checked:el.type==='number'||el.type==='range'?Number(el.value):el.value;if(el.type==='number'&&(!Number.isInteger(value)||value<20||value>200)){el.value=state.settings[k];message('Choose a tempo between 20 and 200 BPM.');return;}state.settings[k]=value;if(!playing&&!loading)rebuild();shownPage='';applySound();save();score();};if(el.type==='range')el.oninput=el.onchange;}
 function view(tracking){$('practice').hidden=tracking;$('tracker').hidden=!tracking;$('practiceTab').setAttribute('aria-selected',String(!tracking));$('trackerTab').setAttribute('aria-selected',String(tracking));if(tracking)renderTracker();}
 $('practiceTab').onclick=()=>view(false);$('trackerTab').onclick=()=>view(true);$('heatmap').onclick=e=>{const day=e.target.dataset.day;if(day){selectedDay=day;renderTracker();}};$('day').onchange=()=>{selectedDay=$('day').value;renderTracker();};
 $('export').onclick=()=>{if(playing||loading)stop('Paused for backup. Your place is saved.');save();const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${config.id}-practice-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('import').onchange=async()=>{const file=$('import').files[0];if(!file)return;try{if(file.size>30e6)throw Error('This backup is too large.');const incoming=validateState(JSON.parse(await file.text()),config.id,limit);if(playing||loading)stop();state=mergeState(state,incoming);active=state.activeWorkout||active;rebuild();sectionUI();settingsUI();options();save();shownPage='';score();controls();renderTracker();message('Backup merged. Existing practice is kept; the most recently saved place is ready to resume.');}catch(e){message(e.message||'Could not read this backup. Your progress has not changed.');}finally{$('import').value='';}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||loading))stop('Paused while the page is in the background. Your place is saved.');});
 window.addEventListener('pagehide',()=>stop());
 window.addEventListener('storage',e=>{if(e.key!==key||!e.newValue)return;try{const incoming=validateState(JSON.parse(e.newValue),config.id,limit);if(playing||loading)return;state=mergeState(state,incoming);active=state.activeWorkout||active;rebuild();sectionUI();settingsUI();options();shownPage='';score();controls();renderTracker();}catch{}});
 function sectionUI(){
  root.querySelectorAll('[data-workout]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.workout===active)));
  $('assigned').hidden=active==='deepdive';$('unassigned').hidden=active!=='deepdive';$('hammersTempo').hidden=active!=='hammers';$('pickingTempo').hidden=active!=='picking';$('strokeSettings').hidden=active!=='picking';$('subdivisionLabel').textContent=active==='hammers'?'Eighth notes · all 24 three-finger combinations.':'Eighth-note triplets · two, three and four fingers.';
 }
 root.querySelectorAll('[data-workout]').forEach(el=>el.onclick=()=>{
  if(active===el.dataset.workout)return;stop();active=el.dataset.workout;rebuild();
  if(active!=='deepdive')state.checkpoint={...(state.progress?.[active]||{cursor:activePlan.blocks[0].start,cycle:1,updatedAt:new Date().toISOString()})};
  save();sectionUI();options();shownPage='';previewOffset=null;controls();score();message('');
 });
 settingsUI();sectionUI();options();controls();score();renderTracker();if(warning)message(warning);
}
