import {buildGroups,cycleLayout,timerElapsed,stages,stageLabel,localDay,freshChunkState,validateChunkState,mergeChunkState} from './chunk-model.js';
import {chunkNotation} from './chunk-notation.js';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from './metronome.js';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume} from './guitarSynth.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>`${Math.floor(Math.ceil(Math.max(0,s))/60)}:${String(Math.ceil(Math.max(0,s))%60).padStart(2,'0')}`;
export function mountChunkPlayer(root,config) {
  const score=config.score,key=`jb-chunks-v1:${config.id}:${score.id}`,engine=createMetronomeEngine();
  let state=freshChunkState(config.id,score),warning='';
  try{const raw=localStorage.getItem(key);if(raw)state=validateChunkState(JSON.parse(raw),config.id,score);}catch{warning='Saved progress could not be read. You can import a backup in Your progress.';}
  let running=false,loading=false,token=0,queue=[],frame=0,finishAt=null,entry=null,lastSave=0,activeNote=-1,unlock=null,startedAt=null,runBase=0;
  const groups=()=>buildGroups(score,state.stage),group=()=>groups()[state.start];
  const progress=()=>state.progress[group().id]??=( {elapsed:0,done:false,updatedAt:new Date().toISOString()} );
  root.innerHTML=`<header><a href="/" class="brand">JON BJORK</a><span class="eyebrow">${esc(config.programTitle)}</span><h1>${esc(config.name)}</h1><div class="tabs" role="tablist" aria-label="Workout views"><button role="tab" aria-selected="true" data-view="plan">Your plan</button><button role="tab" aria-selected="false" data-view="practice">Practice</button><button role="tab" aria-selected="false" data-view="tracker">Your progress</button></div></header>
  <p id="chunkMessage" role="status" class="message"></p>
  <section id="chunkPlan" class="plan-view"><div class="plan-intro"><span class="eyebrow">${esc(score.title)}</span><h2>Small chunks. Connected into the whole piece.</h2><p>${esc(config.name.split(' ')[0])}, begin with two beats at a time. The opening chunk includes the pickup. Play through to the first note of the following chunk so you practise the connection, too.</p><p>Then connect two, three and four chunks at a time, moving your starting point forward by one chunk each time. Finish by practising the whole piece.</p></div><div class="plan-steps">${stages.map((size,i)=>`<article><span class="step-number">0${i+1}</span><div><h3>${stageLabel(size)}</h3><p>${size==='whole'?'Play the complete passage, including the pickup and final held note.':buildGroups(score,size).map(g=>g.start===g.end?`${g.start+1}`:`${g.start+1}–${g.end+1}`).join(' → ')}</p></div><strong class="step-time">${buildGroups(score,size).length*2}:00<small>at two minutes each</small></strong></article>`).join('')}</div><div class="plan-bottom"><div><h3>Two minutes per group</h3><p>Start at <strong>${score.bpm} BPM</strong> with eighth-note triplets. Each group repeats with a two-beat count-in. The timer runs continuously through playing, count-ins and the spaces between repetitions. Pause whenever you need a break.</p><p class="muted">All five stages give you 38 minutes of practice at the preset, including count-ins, plus any breaks. You can spread this over several days: your selected group and remaining timer are saved in this browser.</p></div><button id="chunkBegin" class="primary">Open your workout →</button></div></section>
  <section id="chunkPractice" hidden><nav id="chunkStages" class="chunk-stages" aria-label="Practice stage"></nav><div class="workout-grid"><section class="score-panel"><div class="score-heading"><div><span class="eyebrow">${esc(score.title)}</span><h2 id="chunkTitle"></h2></div><div class="chunk-timer"><strong id="chunkRemaining"></strong><span class="small muted">time left</span></div></div><div class="chunk-navigation"><button id="chunkPrevious" class="quiet" aria-label="Previous group">←</button><label>Practice group<select id="chunkSelect"></select></label><button id="chunkNext" class="quiet" aria-label="Next group">→</button></div><p id="chunkHint" class="small muted"></p><div class="transport"><button id="chunkPlay" class="primary">Start timer</button><button id="chunkReset" class="quiet">Restart timer</button></div><p id="chunkStatus" role="status" class="small muted">Ready</p><progress id="chunkProgress" aria-label="Practice timer"></progress><div id="chunkTab" class="chunk-notation"></div><p class="small muted">Keep the picking strokes as shown. Purple “land” notes connect you to the next chunk.</p></section><aside><section class="panel"><h2>Practice settings</h2><label>Tempo · BPM<input id="chunkBpm" type="number" min="20" max="200" step="1"></label><label>Minutes per group<input id="chunkMinutes" type="number" min="0.5" max="20" step="0.5"></label><p class="small muted">The same timer applies to individual chunks, connected groups and the whole piece.</p></section><section class="panel"><h2>Sound</h2><label>Instrument<select id="chunkTone"><option value="electric">Clean electric</option><option value="nylon">Nylon string</option><option value="piano">Grand piano</option><option value="harpsichord">Harpsichord</option></select></label><label class="check"><input id="chunkInstrument" type="checkbox">Instrument</label><input id="chunkInstrumentVolume" aria-label="Instrument volume" type="range" min="0" max="100"><label class="check"><input id="chunkMetronome" type="checkbox">Metronome</label><input id="chunkMetronomeVolume" aria-label="Metronome volume" type="range" min="0" max="100"><label class="check"><input id="chunkSubdivisions" type="checkbox">Hear triplet subdivisions</label></section></aside></div></section>
  <section id="chunkTracker" hidden><div id="chunkStats" class="stats"></div><section class="panel"><h2>Practice days</h2><div id="chunkHeatmap" class="heatmap"></div><p class="small muted">Last 13 weeks. Choose a day to see your practice.</p><label class="date-label">Day<input id="chunkDay" type="date"></label><div id="chunkDaily" class="table-scroll"></div></section><section class="panel backup"><div><h2>Your backup</h2><p class="muted">Your practice and place are saved in this browser. They are not synced or visible to your teacher. Export a JSON backup to keep a copy, or import it on another device.</p></div><div class="backup-buttons"><button id="chunkExport">Export JSON</button><label class="file-button">Import JSON<input id="chunkImport" type="file" accept=".json,application/json"></label></div></section></section><footer><span>Jon Bjork · Guitar practice</span><a href="/student-workouts/audio/CREDITS.txt">Sound credits</a></footer>`;
  const $=id=>root.querySelector(`#${id}`),message=t=>$('chunkMessage').textContent=t;
  function save(){state.updatedAt=new Date().toISOString();progress().updatedAt=state.updatedAt;try{localStorage.setItem(key,JSON.stringify(state));}catch{message('This browser could not save progress. Export a JSON backup to keep a copy.');}}
  function sound(){const s=state.settings;engine.setVolume(s.metronomeOn?s.metronomeVolume/100:0);engine.setAudibleSubdivision(s.subdivisions?3:1);setInstrumentVolume(getAudioContext(),s.instrumentOn?s.instrumentVolume/100:0);if(!s.instrumentOn)stopGuitar();}
  function settings(){const s=state.settings;$('chunkBpm').value=s.bpm;$('chunkMinutes').value=s.timerSeconds/60;$('chunkTone').value=s.tone;$('chunkInstrument').checked=s.instrumentOn;$('chunkMetronome').checked=s.metronomeOn;$('chunkSubdivisions').checked=s.subdivisions;$('chunkInstrumentVolume').value=s.instrumentVolume;$('chunkMetronomeVolume').value=s.metronomeVolume;}
  function timer(){const p=progress();$('chunkRemaining').textContent=clock(state.settings.timerSeconds-p.elapsed);$('chunkProgress').max=state.settings.timerSeconds;$('chunkProgress').value=Math.min(p.elapsed,state.settings.timerSeconds);}
  function controls(){const busy=running||loading;for(const id of ['chunkBpm','chunkMinutes','chunkTone','chunkSelect','chunkPrevious','chunkNext','chunkReset'])$(id).disabled=busy;$('chunkPrevious').disabled=busy||(state.stage===1&&state.start===0);$('chunkNext').disabled=busy||state.stage==='whole';root.querySelectorAll('[data-stage]').forEach(el=>el.disabled=busy);$('chunkPlay').textContent=loading?'Cancel loading':running?'Pause':progress().done?'Practise again':progress().elapsed>0?'Resume timer':'Start timer';}
  function render(){
    const g=group();$('chunkStages').innerHTML=stages.map(size=>`<button data-stage="${size}" aria-pressed="${size===state.stage}">${stageLabel(size)}</button>`).join('');
    $('chunkTitle').textContent=g.label;$('chunkSelect').innerHTML=groups().map((g,i)=>`<option value="${i}">${g.label}${state.progress[g.id]?.done?' · ✓':''}</option>`).join('');$('chunkSelect').value=state.start;
    $('chunkHint').textContent=`${state.settings.bpm} BPM · Eighth-note triplets · ${g.pickup?'Includes pickup · ':''}${g.size==='whole'?'Full passage':g.end===score.chunkCount-1?'Finish on the four-beat held note':'Includes the next chunk’s first note'}`;
    $('chunkTab').innerHTML=chunkNotation(g,score);activeNote=-1;timer();controls();
  }
  function highlight(index){if(index===activeNote)return;activeNote=index;root.querySelectorAll('[data-note] .note-highlight').forEach(el=>el.setAttribute('opacity','0'));const el=root.querySelector(`[data-note="${index}"] .note-highlight`);if(el){el.setAttribute('opacity','.35');const pane=$('chunkTab'),r=el.closest('svg').getBoundingClientRect(),p=pane.getBoundingClientRect();if(r.top<p.top||r.bottom>p.bottom)pane.scrollTop+=r.top-p.top;}}
  function credit(seconds,repetition=false,completion=false){
    if(!entry||entry.day!==localDay()){entry={id:crypto.randomUUID(),day:localDay(),group:group().id,bpm:state.settings.bpm,seconds:0,repetitions:0,completions:0};state.events.push(entry);}
    entry.seconds+=seconds;entry.repetitions+=Number(repetition);entry.completions+=Number(completion);
  }
  function reconcile(){const now=getAudioContext()?.currentTime??0;
    progress().elapsed=timerElapsed(runBase,startedAt,now,state.settings.timerSeconds);
    for(const q of queue){if(now<q.when)break;const amount=Math.max(0,Math.min(now,q.end)-q.when-q.credited);if(amount){credit(amount);q.credited+=amount;}if(now>=q.end&&!q.finished){q.finished=true;if(q.last)credit(0,true);}}
    queue=queue.filter(q=>!q.finished);
    if(finishAt!==null&&now>=finishAt&&!progress().done){progress().done=true;credit(0,false,true);}
    timer();
  }
  function stop(text='Paused. Resume continues your timer from the start of this group.'){
    if(running)reconcile();token++;running=false;loading=false;engine.stop();stopGuitar();cancelAnimationFrame(frame);queue=[];finishAt=null;entry=null;startedAt=null;highlight(-1);if(unlock){unlock();unlock=null;}save();controls();$('chunkStatus').textContent=text;
  }
  function animate(){if(!running)return;reconcile();if(finishAt!==null&&getAudioContext().currentTime>=finishAt){stop('Timer complete. Choose the next group when you’re ready.');render();return;}if(performance.now()-lastSave>1000){save();lastSave=performance.now();}frame=requestAnimationFrame(animate);}
  async function start(){
    if(running||loading){stop();return;}
    if(progress().done||progress().elapsed>=state.settings.timerSeconds){progress().elapsed=0;progress().done=false;}
    const my=++token;loading=true;message('');controls();$('chunkStatus').textContent='Loading sound…';
    try{
      if(navigator.locks){const acquired=await new Promise((resolve,reject)=>{navigator.locks.request(key,{ifAvailable:true},lock=>{if(!lock){resolve(false);return;}if(token!==my){resolve(false);return;}return new Promise(release=>{unlock=release;resolve(true);});}).catch(reject);});if(my!==token)return;if(!acquired){stop('This workout is already playing in another tab.');return;}}
      if(!await primeMetronomeAudio())throw Error('Sound could not start. Please press Start again.');
      await prepareGuitar(getAudioContext(),state.settings.tone);if(my!==token)return;
      const g=group(),layout=cycleLayout(g),seconds=60/state.settings.bpm/3;
      runBase=progress().elapsed;startedAt=null;
      loading=false;running=true;queue=[];entry=null;finishAt=null;sound();controls();
      const ok=await engine.start({bpm:state.settings.bpm,subdivision:3,countInBeats:0,audibleSubdivision:state.settings.subdivisions?3:1,
        onScheduleTick(i,when){
          if(my!==token)return false;
          if(startedAt===null){startedAt=when;finishAt=when+state.settings.timerSeconds-runBase;}
          if(when>=finishAt)return false;
          const pos=i%layout.length,at=pos-layout.musicStart,inMusic=pos>=layout.musicStart&&pos<layout.musicEnd;
          engine.setMuted(pos>=layout.musicEnd);
          if(inMusic){
            const noteIndex=g.notes.findIndex(n=>at>=n.at&&at<n.at+n.len),note=g.notes[noteIndex],last=at===g.length-1;
            queue.push({when,end:Math.min(when+seconds,finishAt),credited:0,finished:false,last:last&&when+seconds<=finishAt+1e-6});
            if(at===note.at&&state.settings.instrumentOn)pluck(getAudioContext(),note.midi,when,Math.min(note.len*seconds,finishAt-when),.5,{tight:note.len===1});
          }
          return true;
        },
        onTick(i){if(my!==token)return;const pos=i%layout.length,at=pos-layout.musicStart;
          if(pos<layout.musicStart){highlight(-1);$('chunkStatus').textContent=`Count in · ${2-Math.floor(pos/3)}`;}
          else if(pos<layout.musicEnd){highlight(g.notes.findIndex(n=>at>=n.at&&at<n.at+n.len));$('chunkStatus').textContent='Playing';}
          else{highlight(-1);$('chunkStatus').textContent='Next repetition…';}
        }
      });
      if(my!==token)return;if(ok===false)throw Error('Sound could not start. Please try again.');frame=requestAnimationFrame(animate);
    }catch(e){if(my===token){stop('Ready');message(e.message||'Playback could not start. Please try again.');}}
  }
  function choose(size,start=0){if(running||loading)stop();state.stage=size;state.start=start;save();render();$('chunkStatus').textContent=progress().done?'Timer complete. Practise again or choose another group.':'Ready';}
  function move(direction){const next=state.start+direction;if(next>=0&&next<groups().length)choose(state.stage,next);else{const i=stages.indexOf(state.stage)+direction;if(i>=0&&i<stages.length)choose(stages[i],direction<0?buildGroups(score,stages[i]).length-1:0);}}
  function view(name){if(running||loading)stop();for(const [id,n] of [['chunkPlan','plan'],['chunkPractice','practice'],['chunkTracker','tracker']])$(id).hidden=n!==name;root.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.view===name)));if(name==='tracker')tracker();}
  function tracker(){
    const events=state.events,total=events.reduce((s,e)=>s+e.seconds,0),today=events.filter(e=>e.day===localDay()).reduce((s,e)=>s+e.seconds,0);
    $('chunkStats').innerHTML=[['Today',clock(today)],['Playing time',clock(total)],['Practice days',new Set(events.filter(e=>e.seconds>0).map(e=>e.day)).size],['Repetitions',events.reduce((s,e)=>s+e.repetitions,0)]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('chunkHeatmap').innerHTML=Array.from({length:91},(_,i)=>{const date=new Date();date.setDate(date.getDate()-90+i);const day=localDay(date),seconds=events.filter(e=>e.day===day).reduce((s,e)=>s+e.seconds,0),level=seconds?Math.min(4,Math.ceil(seconds/300)):0;return `<button class="heat level${level}" data-day="${day}" aria-label="${day}: ${clock(seconds)} played" title="${day}: ${clock(seconds)}" aria-pressed="${$('chunkDay').value===day}"></button>`;}).join('');
    const rows=new Map();for(const e of events.filter(e=>e.day===$('chunkDay').value)){const id=`${e.group}:${e.bpm}`,r=rows.get(id)||{...e,seconds:0,repetitions:0,completions:0};r.seconds+=e.seconds;r.repetitions+=e.repetitions;r.completions+=e.completions;rows.set(id,r);}
    $('chunkDaily').innerHTML=rows.size?`<table><thead><tr><th>Stage / group</th><th>Tempo</th><th>Playing time</th><th>Repetitions</th><th>Timers finished</th></tr></thead><tbody>${[...rows.values()].map(e=>{const g=stages.flatMap(s=>buildGroups(score,s)).find(g=>g.id===e.group);return `<tr><td>${stageLabel(g.size)} · ${g.label}</td><td>${e.bpm} BPM</td><td>${clock(e.seconds)}</td><td>${e.repetitions}</td><td>${e.completions}</td></tr>`;}).join('')}</tbody></table>`:'<p class="muted">No practice recorded for this day.</p>';
  }
  root.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>view(el.dataset.view));$('chunkBegin').onclick=()=>view('practice');
  $('chunkStages').onclick=e=>{const button=e.target.closest('[data-stage]');if(button&&!button.disabled)choose(button.dataset.stage==='whole'?'whole':Number(button.dataset.stage));};
  $('chunkSelect').onchange=e=>choose(state.stage,Number(e.target.value));$('chunkPrevious').onclick=()=>move(-1);$('chunkNext').onclick=()=>move(1);$('chunkPlay').onclick=start;
  $('chunkReset').onclick=()=>{progress().elapsed=0;progress().done=false;save();render();$('chunkStatus').textContent='Timer reset. Your practice log is kept.';};
  for(const [id,setting] of [['chunkBpm','bpm'],['chunkMinutes','timerSeconds']])$(id).oninput=e=>{if(!e.target.checkValidity()||!e.target.value)return;state.settings[setting]=Number(e.target.value)*(setting==='timerSeconds'?60:1);if(setting==='timerSeconds')progress().done=progress().elapsed>=state.settings.timerSeconds;save();render();};
  $('chunkTone').onchange=e=>{state.settings.tone=e.target.value;save();};
  for(const [id,setting] of [['chunkInstrument','instrumentOn'],['chunkMetronome','metronomeOn'],['chunkSubdivisions','subdivisions'],['chunkInstrumentVolume','instrumentVolume'],['chunkMetronomeVolume','metronomeVolume']])$(id).oninput=e=>{state.settings[setting]=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);sound();save();};
  $('chunkDay').value=localDay();$('chunkDay').onchange=tracker;$('chunkHeatmap').onclick=e=>{const b=e.target.closest('[data-day]');if(b){$('chunkDay').value=b.dataset.day;tracker();}};
  $('chunkExport').onclick=()=>{save();const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${config.id}-practice-${localDay()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('chunkImport').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>20e6)throw Error('Choose a JSON backup smaller than 20 MB.');const incoming=validateChunkState(JSON.parse(await file.text()),config.id,score);state=mergeChunkState(state,incoming);save();settings();render();tracker();message('Backup imported. Existing practice entries were kept without duplicates.');}catch(error){message(error.message||'The backup could not be read.');}finally{e.target.value='';}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||loading))stop('Paused while this page was away. Your timer is saved.');});
  window.addEventListener('pagehide',()=>{if(running||loading)stop();else save();});
  window.addEventListener('storage',e=>{if(e.key===key&&!running&&!loading&&e.newValue){try{state=mergeChunkState(state,validateChunkState(JSON.parse(e.newValue),config.id,score));settings();render();tracker();}catch{}}});
  settings();render();if(warning)message(warning);
}
