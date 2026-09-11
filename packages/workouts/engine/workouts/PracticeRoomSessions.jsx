import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ROOM_DAYS,ROOM_ROUNDS,buildRoomSession} from './roomSequence';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from '../shared/metronome';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume as applyVolume} from './guitarSynth';
import {addSession,readLog,MIN_LOGGED_SEC} from './storage';
import {useSessionReporter} from '../shared/sessionEvents';
import TabView from './TabView';
import CurrentRoomShape from './CurrentRoomShape';
import VolumeControls from './VolumeControls';
import './room-sessions.css';
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export default function PracticeRoomSessions({onBack,onHome}){
 const [day,setDay]=useState(null),[workoutOpen,setWorkoutOpen]=useState(false);
 useEffect(()=>{window.scrollTo(0,0);},[day,workoutOpen]);
 return <div className="prs"><header><button onClick={onHome}>← JON BJORK <span>/ WORKOUTS</span></button><span>● WORKOUTS</span></header><main>
 {day?<RoomPlayer key={day.day} day={day} onBack={()=>setDay(null)}/>:workoutOpen?<>
 <button className="prs-back" onClick={()=>setWorkoutOpen(false)}>← Practice Room Sessions</button>
 <div className="prs-workout-heading"><div><div className="prs-eyebrow">THE PRACTICE ROOM SESSIONS</div>
 <h1>Classic Alternate Picked Shred Sequence</h1>
 <p>Five days, five keys. Play the scale, connect straight into the sequence, then let the landing note ring. Ten positions in four rounds.</p></div>
 <img className="prs-cover" src="/workouts/classic-shred-sequence-cover.png" alt="Classic Alternate Picked Shred Sequence — Play Along"/></div>
 <div className="prs-days">{ROOM_DAYS.map(d=><button key={d.day} onClick={()=>setDay(d)}><span>DAY {d.day}</span><h2>{d.key}</h2><p>Classic Picking Sequence</p><small>36:40 + count-in · Open workout ↗</small></button>)}</div>
 </>:<>
 <button className="prs-back" onClick={onBack}>← All workouts</button>
 <h1>The Practice Room Sessions</h1><p>Choose a workout and play along.</p>
 <button className="prs-workout-cover" aria-label="Open Classic Alternate Picked Shred Sequence" onClick={()=>setWorkoutOpen(true)}>
 <img src="/workouts/classic-shred-sequence-cover.png" alt="Classic Alternate Picked Shred Sequence — Play Along"/>
 <span>Five days · Five keys · Open workout ↗</span>
 </button>
 </>}
 </main></div>;
}
export function RoomPlayer({day,onBack}){
 const addEvent=useSessionReporter();
 const data=useMemo(()=>buildRoomSession(day.root),[day.root]);
 const [cursor,setCursor]=useState(0),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[count,setCount]=useState(null),[message,setMessage]=useState(''),[done,setDone]=useState(false),[view,setView]=useState('practice');
 const [roundReady,setRoundReady]=useState(false);
 const [tone,setTone]=useState('piano'),[instrumentVolume,setInstrumentVolume]=useState(100),[metronomeVolume,setMetronomeVolume]=useState(100);
 const [metronomeOn,setMetronomeOn]=useState(true),[instrumentOn,setInstrumentOn]=useState(true),[subdivisionsOn,setSubdivisionsOn]=useState(false);
 const audioOptions=useRef({});audioOptions.current={metronomeOn,instrumentOn,subdivisionsOn};
 const engine=useRef(null);if(!engine.current)engine.current=createMetronomeEngine();
 const refs=useRef({active:0,start:null,startedAt:null,finished:false,completed:new Set(),cursor:0,token:0,timer:null});
 const volume=useRef(instrumentVolume);volume.current=instrumentVolume;
 const ticks=data.ticks,p=ticks[cursor],passage=data.passages[p.passage];
 // Derive remaining playing time from the score position, not wall time:
 // pauses and count-ins must not consume the remaining music.
 const remainingByTick=useMemo(()=>{
  const remaining=new Array(data.ticks.length+1).fill(0);
  for(let i=data.ticks.length-1;i>=0;i--){const tick=data.ticks[i];remaining[i]=remaining[i+1]+60/tick.bpm/tick.subdivision;}
  return remaining;
 },[data]);
 const remainingSeconds=done?0:Math.ceil(remainingByTick[cursor]);
 const stop=()=>{const r=refs.current;r.token++;clearTimeout(r.timer);engine.current.stop();stopGuitar();if(r.start!==null){r.active+=Date.now()-r.start;r.start=null;}};
 const save=complete=>{
  const r=refs.current;if(r.finished||!r.startedAt)return;r.finished=true;
  complete=complete && r.completed.size===80;
  const seconds=Math.round(r.active/1000);if(!complete&&seconds<MIN_LOGGED_SEC)return;
  const record={startedAt:r.startedAt,workoutId:`room-classic-day-${day.day}`,workoutTitle:`Classic Picking Sequence — Day ${day.day}: ${day.key}`,seconds,complete,exercisesDone:r.completed.size,exercisesTotal:80,roomDay:day.day,key:day.key,passagesPlayed:[...r.completed],rounds:ROOM_ROUNDS};
  addSession(record);addEvent({lab:'workouts',kind:'session',payload:{workoutId:record.workoutId,workoutName:record.workoutTitle,durationSec:seconds,complete,exercisesDone:r.completed.size,exercisesTotal:80,key:day.key,roomDay:day.day}});
 };
 const finishRef=useRef(null);finishRef.current=()=>{stop();save(true);setPlaying(false);setDone(true);setCount(null);setMessage(refs.current.completed.size===80?'Workout complete. Your practice time has been saved.':'Selected passages finished. Your practice time has been saved.');};
 useEffect(()=>()=>{stop();save(false);},[]); // Save an interrupted attempt when leaving the player.
 useEffect(()=>{applyVolume(getAudioContext(),instrumentVolume/100);},[instrumentVolume]);
 useEffect(()=>{engine.current.setVolume(metronomeOn?metronomeVolume/100:0);},[metronomeVolume,metronomeOn]);
 useEffect(()=>{if(!instrumentOn)stopGuitar();},[instrumentOn]);
 async function play(from){
  const r=refs.current;stop();if(r.finished){r.active=0;r.startedAt=null;r.finished=false;r.completed=new Set();}const token=r.token;setCursor(from);r.cursor=from;setLoading(true);setRoundReady(false);setMessage('');
  try{
   await primeMetronomeAudio();await prepareGuitar(getAudioContext(),tone);if(token!==r.token)return;
   applyVolume(getAudioContext(),volume.current/100);engine.current.setVolume(metronomeOn?metronomeVolume/100:0);
   if(!r.startedAt){r.startedAt=new Date().toISOString();r.finished=false;}r.start=Date.now();setPlaying(true);setDone(false);
   const start=ticks[from],startRound=data.passages[start.passage].round;
   await engine.current.start({bpm:start.bpm,subdivision:start.subdivision,audibleSubdivision:audioOptions.current.subdivisionsOn?start.subdivision:1,countInBeats:4,countInSubdivide:audioOptions.current.subdivisionsOn,countInSubdivision:start.subdivision,onCountIn:n=>setCount(n),
    onScheduleTick:(i,when)=>{
     const at=from+i,n=ticks[at];
     if(token!==r.token)return false;
     if(n&&data.passages[n.passage].round!==startRound){
      r.timer=setTimeout(()=>{if(token!==r.token)return;stop();setPlaying(false);setCount(null);setCursor(at);r.cursor=at;setPreviewPhase('Scale run');setRoundReady(true);setMessage(`Round ${startRound+1} complete. Start round ${startRound+2} when you’re ready.`);},Math.max(0,(when-getAudioContext().currentTime)*1000));
      return false;
     }
     if(!n){r.timer=setTimeout(()=>{if(token===r.token)finishRef.current();},Math.max(0,(when-getAudioContext().currentTime)*1000));return false;}
     engine.current.setBpm(n.bpm);engine.current.setSubdivision(n.subdivision);engine.current.setAudibleSubdivision(audioOptions.current.subdivisionsOn?n.subdivision:1);
     if(audioOptions.current.instrumentOn&&n.midi)pluck(getAudioContext(),n.midi[0],when,n.len*60/n.bpm/n.subdivision,.5,{tight:n.phase!=='Hold'});
     return true;
    },
    onTick:i=>{if(token!==r.token)return;const at=from+i,n=ticks[at];if(!n)return;r.cursor=at;setCursor(at);setCount(null);
     if(at===ticks.length-1||ticks[at+1].passage!==n.passage)r.completed.add(n.passage);
    }
   });
  }catch(e){stop();setPlaying(false);setMessage('Could not start audio. Please try again.');}finally{if(token===r.token)setLoading(false);}
 }
 function pause(){stop();setPlaying(false);setLoading(false);setCount(null);}
 function selectPassage(index){pause();setDone(false);setRoundReady(false);setMessage('');setCursor(data.passages[index].start);refs.current.cursor=data.passages[index].start;}
 const logs=readLog().sessions.filter(s=>s.workoutId===`room-classic-day-${day.day}`);
 // Show scale and sequence separately so each remains readable. The cursor
 // follows across their seamless join; selecting a phase is preview-only.
 const phase=p.ni<36?'Scale run':p.ni<96?'Picking sequence':'Hold';
 const [previewPhase,setPreviewPhase]=useState('Scale run');
 const shown=playing?phase:previewPhase;
 const offset=shown==='Scale run'?0:shown==='Picking sequence'?36:96;
 const shownNotes=shown==='Scale run'?passage.notes.slice(0,36):shown==='Picking sequence'?passage.notes.slice(36,96):passage.notes.slice(96);
 return <>
 <button className="prs-back" onClick={onBack}>← All five days</button><div className="prs-eyebrow">DAY {day.day} · {day.key.toUpperCase()}</div>
 <h1>Classic Picking Sequence</h1><p>Scale run → picking sequence → held landing. Ten positions, both directions.</p>
 <nav><button aria-pressed={view==='practice'} onClick={()=>setView('practice')}>Practice</button><button aria-pressed={view==='progress'} onClick={()=>{pause();setView('progress');}}>Your progress</button></nav>
 {view==='progress'?<section><h2>Your sessions</h2><p>{clock(logs.reduce((n,s)=>n+s.seconds,0))} practiced · {logs.length} saved sessions</p>{logs.length?<ul>{logs.slice().reverse().map((s,i)=><li key={i}>{new Date(s.startedAt).toLocaleDateString()} · {clock(s.seconds)} · {s.complete?'Complete':`${s.exercisesDone}/80 passages`}</li>)}</ul>:<p>Your practice time will appear here.</p>}</section>:<>
 <div className="prs-rounds">{ROOM_ROUNDS.map((r,i)=><button key={i} disabled={loading||playing} aria-pressed={passage.round===i} onClick={()=>selectPassage(i*20)}><small>ROUND {i+1}</small><strong>{r.label}</strong><span>{r.bpm} BPM</span></button>)}</div>
 <div className="prs-layout"><section>
 <div className="prs-passage-heading"><div><div className="prs-position"><label>Starting position <select disabled={playing||loading} value={passage.position} onChange={e=>selectPassage(passage.round*20+Number(e.target.value)*2)}>{data.pairs.map((pair,i)=><option key={i} value={i}>{i+1} of 10 · low E fret {pair.fret}</option>)}</select></label><label>Direction <select disabled={playing||loading} value={passage.high?'high':'low'} onChange={e=>selectPassage(passage.round*20+passage.position*2+(e.target.value==='high'?1:0))}><option value="low">Low → low</option><option value="high">High → high</option></select></label></div>
 <h2>{count?`Count in: ${count}`:done?'Complete':`${passage.high?'High → high':'Low → low'} · ${shown}`}</h2>
 <div className="prs-phases">{['Scale run','Picking sequence','Hold'].map(label=><button key={label} disabled={playing} aria-pressed={shown===label} onClick={()=>setPreviewPhase(label)}>{label}</button>)}</div>
 </div><CurrentRoomShape pair={data.pairs[passage.position]} high={passage.high} noteIndex={playing?p.ni:offset} root={day.root} keyName={day.key} activeNote={playing?passage.notes[Math.min(p.ni,96)]:null}/></div>
 <TabView notes={shownNotes} cursor={playing&&count===null?p.ni-offset:-1} notesPerBeat={passage.subdivision}/>
 <p>{shown==='Hold'?'Let the note ring for four beats. Passages connect within each round. At the end of a round, start the next one when you’re ready.':'Strict alternate picking. The scale connects straight into the sequence without a pause.'}</p>
 <progress aria-label="Workout progress" max={ticks.length} value={cursor+1}/><p>Round {passage.round+1}/4 · Position {passage.position+1}/10 · {passage.bpm} BPM · {passage.subdivision===3?'Eighth-note triplets':'Sixteenths'} · {passage.stroke==='D'?'Downstroke':'Upstroke'} start</p>
 </section><aside><h2>Time remaining</h2><strong className="prs-duration" role="timer" aria-label="Playing time remaining">{clock(remainingSeconds)}</strong><p>Playing time to the end of round 4. Pauses and count-ins are extra.</p>
 <label>Instrument <select disabled={playing||loading} value={tone} onChange={e=>setTone(e.target.value)}><option value="piano">Grand piano</option><option value="harpsichord">Harpsichord</option><option value="electric">Clean electric</option><option value="nylon">Nylon string</option></select></label>
 <div className="prs-sound-switches">
 <button role="switch" aria-checked={metronomeOn} onClick={()=>setMetronomeOn(v=>!v)}>Metronome <span aria-hidden="true">{metronomeOn?'On':'Off'}</span></button>
 <button role="switch" aria-checked={instrumentOn} onClick={()=>setInstrumentOn(v=>!v)}>Instrument <span aria-hidden="true">{instrumentOn?'On':'Off'}</span></button>
 <button role="switch" aria-checked={subdivisionsOn} onClick={()=>setSubdivisionsOn(v=>!v)}>Subdivisions <span aria-hidden="true">{subdivisionsOn?'On':'Off'}</span></button>
 </div>
 <VolumeControls {...{instrumentVolume,metronomeVolume,setInstrumentVolume,setMetronomeVolume}}/>
 <button className="prs-start" disabled={loading} onClick={()=>playing?pause():play(done?0:passage.start)}>{loading?'Loading sound…':playing?'Pause':done?'Play again':roundReady?`Start round ${passage.round+1} ▶`:refs.current.startedAt?'Resume passage ▶':'Start practicing ▶'}</button>
 {refs.current.startedAt&&!done&&<button disabled={loading} onClick={()=>{pause();save(false);setDone(true);setMessage('Session ended. Practice attempts of ten seconds or more are saved.');}}>End session</button>}
 <p role="status">{message}</p><p>Pause and resume restarts the current passage with a count-in.</p>
 </aside></div>
 </>}
 </>;
}
