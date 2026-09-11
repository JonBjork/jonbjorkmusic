import React,{useEffect,useMemo,useRef,useState} from 'react';
import {EXERCISES,CHROMATIC_ID,CHROMATIC_TITLE,buildChromatic} from './chromaticData';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from '../../../packages/workouts/engine/shared/metronome';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume as applyVolume} from '../../../packages/workouts/engine/workouts/guitarSynth';
import {addSession,readLog,MIN_LOGGED_SEC,fmtClock} from './storage';
import {recordGroup,todayProgress,completedExercise} from './tracking';
import TabView from './TabView';
import {ShapeFretboard} from './CurrentRoomShape';
import Tuning from '../../../packages/workouts/engine/workouts/Tuning';
import VolumeControls from '../../../packages/workouts/engine/workouts/VolumeControls';
import {NumberField} from '../../../packages/workouts/engine/workouts/PieceSetup';
import '../../../packages/workouts/engine/workouts/room-sessions.css';
import './chromatic-workout.css';
const PREFS='jb-vinnie-settings-v1';
function read(){try{return JSON.parse(localStorage.getItem(PREFS)||'{}')||{};}catch{return {};}}
const valid=(n,min,max,fallback)=>Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
export default function ChromaticWorkout({onBack}){
 const initial=useRef(read()).current;
 const [selected,setSelected]=useState(null),[settings,setSettings]=useState(initial.exercises||{});
 const [tone,setTone]=useState(['piano','harpsichord','electric','nylon'].includes(initial.tone)?initial.tone:'piano');
 const [instrumentVolume,setInstrumentVolume]=useState(valid(initial.instrumentVolume,0,100,100)),[metronomeVolume,setMetronomeVolume]=useState(valid(initial.metronomeVolume,0,100,70));
 const [sound,setSound]=useState(true),[click,setClick]=useState(true),[subdivisions,setSubdivisions]=useState(false);
 const [playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[cursor,setCursor]=useState(0),[count,setCount]=useState(null),[done,setDone]=useState(false),[message,setMessage]=useState(''),[logVersion,setLogVersion]=useState(0);
 const exercise=EXERCISES[selected??0],prefs=settings[exercise.id]||{},bpm=valid(prefs.bpm,30,240,60),subdivision=valid(prefs.subdivision,1,8,exercise.defaultSubdivision);
 const data=useMemo(()=>buildChromatic(exercise),[exercise]);
 const n=data.notes[Math.min(cursor,data.notes.length-1)],group=data.groups[n.group];
 const shapeNotes=useMemo(()=>[...new Map(data.notes.slice(group.start,group.end).map(note=>[`${note.string}-${note.fret}`,note])).values()],[data,group]);
 const engine=useRef(null);if(!engine.current)engine.current=createMetronomeEngine();
 const state=useRef({token:0,timer:null,session:null});
 const audio=useRef({});audio.current={sound,click,subdivisions,instrumentVolume,metronomeVolume};
 function stop(){const r=state.current;r.token++;clearTimeout(r.timer);engine.current.stop();stopGuitar();const s=r.session;if(s?.activeAt!=null){s.milliseconds+=Date.now()-s.activeAt;s.activeAt=null;}}
 function save(complete=false){const s=state.current.session;if(!s)return;state.current.session=null;const seconds=Math.round(s.milliseconds/1000);const all=complete&&s.heard.size===s.total;
  if(!all&&seconds<MIN_LOGGED_SEC)return;
  const record={workoutId:CHROMATIC_ID,workoutTitle:CHROMATIC_TITLE,exerciseId:s.id,exerciseTitle:s.title,startedAt:s.startedAt,seconds,bpm:s.bpm,notesPerBeat:s.subdivision,complete:all,exercisesDone:all?1:0,exercisesTotal:1,notesPlayed:s.heard.size};
  addSession(record);
 }
 useEffect(()=>()=>{stop();save();},[]);
 useEffect(()=>{try{localStorage.setItem(PREFS,JSON.stringify({exercises:settings,tone,instrumentVolume,metronomeVolume}));}catch{}},[settings,tone,instrumentVolume,metronomeVolume]);
 useEffect(()=>{applyVolume(getAudioContext(),instrumentVolume/100);},[instrumentVolume]);
 useEffect(()=>{engine.current.setVolume(click?metronomeVolume/100:0);},[metronomeVolume,click]);
 useEffect(()=>{engine.current.setAudibleSubdivision(subdivisions?subdivision:1);},[subdivisions,subdivision]);
 useEffect(()=>{if(!sound)stopGuitar();},[sound]);
 function pause(){stop();setPlaying(false);setLoading(false);setCount(null);}
 useEffect(()=>{const hide=()=>{if(document.hidden){pause();}};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 function choose(i){pause();save();setSelected(i);const progress=todayProgress();const exerciseIndex=i??0;const nextData=buildChromatic(EXERCISES[exerciseIndex]);const pending=nextData.groups.findIndex((g,j)=>!progress[exerciseIndex].includes(j));setCursor(pending<0?0:nextData.groups[pending].start);setDone(false);setMessage('');setLogVersion(v=>v+1);}
 function change(key,value){pause();save();setSettings(s=>({...s,[exercise.id]:{...s[exercise.id],[key]:value}}));setCursor(0);setDone(false);setMessage('');}
 async function start(){stop();const r=state.current,token=r.token,from=done?0:group.start;setLoading(true);setDone(false);setCursor(from);setMessage('');
  try{await primeMetronomeAudio();await prepareGuitar(getAudioContext(),tone);if(token!==r.token)return;
   applyVolume(getAudioContext(),audio.current.instrumentVolume/100);engine.current.setVolume(audio.current.click?audio.current.metronomeVolume/100:0);
   if(!r.session)r.session={id:exercise.id,title:exercise.title,bpm,subdivision,total:data.notes.length,heard:new Set(),milliseconds:0,activeAt:null,startedAt:new Date().toISOString()};
   r.session.activeAt=Date.now();setPlaying(true);setCount(4);setLoading(false);
   await engine.current.start({bpm,subdivision,audibleSubdivision:audio.current.subdivisions?subdivision:1,countInBeats:4,countInSubdivide:audio.current.subdivisions,countInSubdivision:subdivision,
    onCountIn:v=>{if(token===r.token)setCount(v);},
    onScheduleTick:(i,when)=>{if(token!==r.token)return false;const note=data.notes[from+i];if(!note){r.timer=setTimeout(()=>{if(token!==r.token)return;stop();save(true);setPlaying(false);setCount(null);setDone(true);setCursor(data.notes.length);setLogVersion(v=>v+1);setMessage('Exercise finished. Your practice is saved. Start the next one when you’re ready.');},Math.max(0,(when-getAudioContext().currentTime)*1000));return false;}
     if(audio.current.sound&&!note.hold)pluck(getAudioContext(),note.midi[0],when,60/bpm/subdivision*note.len,.5,{tight:true});return true;},
    onTick:i=>{if(token!==r.token||!data.notes[from+i])return;r.session.heard.add(from+i);const heard=data.notes[from+i];if(from+i===data.groups[heard.group].end-1)recordGroup(exercise.id,heard.group);setCursor(from+i);setCount(null);}
   });
  }catch{if(token===r.token){pause();setMessage('Could not start audio. Please try again.');}}
 }
 const logs=useMemo(()=>readLog().sessions.filter(s=>s.workoutId===CHROMATIC_ID),[logVersion]);
 const completed=new Set(EXERCISES.filter((e,i)=>completedExercise(todayProgress(),i)).map(e=>e.id));
 const locked=playing||loading;
 return <div className="prs chromatic"><header><button onClick={()=>{pause();save();onBack();}}>← Jon Bjork Music</button>{!locked&&<Tuning/>}</header><main>
 <div className="prs-eyebrow">ALTERNATE PICKING · CHROMATIC PATTERNS</div><h1>{CHROMATIC_TITLE}</h1><p>Based on the patterns from Vinnie Moore’s first instructional video. Follow the pick strokes, stay relaxed, and keep each note clear.</p>
 {selected===null?<>
 <img src="/vinnie/cover.png" alt="The Vinnie Moore Picking Workout" style={{width:"100%",maxWidth:850,borderRadius:12,marginBottom:24}}/>
 <p>Twelve exercises in four sections. Every moving exercise travels from index-finger fret 1 to 12 and back to 1, without repeating the turnaround position.</p>
 {['Six strings','Two strings','Single string','Scale Exercises'].map(section=><div key={section}><h2>{section}</h2><div className="prs-days">{EXERCISES.map((e,i)=>e.section===section&&<button key={e.id} onClick={()=>choose(i)}><small>EXERCISE {i+1}{completed.has(e.id)?' · PRACTICED':''}</small><h2>{e.title}</h2><p>{e.kind==='scale'?'One sequence per position':e.kind==='pairs'?'Nine string-pair visits':e.kind==='single'?'Eleven string visits':'High E → low E → high E'}</p><small>{e.defaultSubdivision===3?'Triplets':'Sixteenths'} by default · Open ↗</small></button>)}</div></div>)}
 <section className="chromatic-history"><h2>Your practice</h2><p>{logs.length} saved sessions · {fmtClock(logs.reduce((sum,s)=>sum+s.seconds,0))} practiced</p><p>Your daily progress and JSON backup are available in My progress above.</p></section>
 </>:<>
 <button onClick={()=>choose(null)}>← Exercise overview</button><div className="chromatic-select"><label>Exercise<select disabled={locked} value={selected} onChange={e=>choose(Number(e.target.value))}>{EXERCISES.map((e,i)=><option value={i} key={e.id}>{i+1}. {e.title}</option>)}</select></label></div>
 <div className="prs-layout"><section><div className="prs-eyebrow">EXERCISE {selected+1} / {EXERCISES.length}</div><h2>{exercise.title}</h2>
 <p>{exercise.kind==='scale'?'Play the complete scale sequence once, then shift up one fret. Travel from index-finger fret 1 to 12, then straight back through 11 to 1. Keep the written holds ringing.':exercise.kind==='six'?'Play the group once on each string: high E → B → G → D → A → low E → A → D → G → B → high E. Then shift up one fret.':exercise.kind==='pairs'?'Finish the entire fret 1 → 12 → 1 journey on each string pair before moving to the next pair. Always start on the lower string.':'Alternate ascending and descending four-note groups with each one-fret shift. Finish fret 1 → 12 → 1 on each string before moving to the next.'}</p>
 <button className="prs-start" disabled={loading} onClick={()=>playing?pause():start()}>{loading?'Loading sound…':playing?'Pause':done?'Play again ▶':cursor?'Resume position ▶':'Start exercise ▶'}</button>
 <div className="chromatic-position"><div className="chromatic-location"><strong>{count?`Count in · ${count}`:done?'Exercise finished':`Index finger: fret ${group.position}`}</strong><span>{group.visit<12?'Up the neck':'Back down'}</span></div>
 <ShapeFretboard notes={shapeNotes} label={`Position ${group.position}`} heading="CURRENT PATTERN" activeNote={playing&&count===null?n:null}/></div>
 <TabView key={exercise.id} continuous notes={data.notes} cursor={playing&&count===null?cursor:-1} notesPerBeat={subdivision}/>
 <p>⊓ Downstroke · ∨ Upstroke · Keep alternating through every shift.</p>
 <progress aria-label="Exercise progress" value={done?data.notes.length:cursor} max={data.notes.length}/>
 <label>Preview / resume from<select disabled={locked} value={n.group} onChange={e=>{pause();setCursor(data.groups[Number(e.target.value)].start);setDone(false);}}>{data.groups.map((g,i)=><option key={i} value={i}>{i+1}. {g.label}</option>)}</select></label>
 </section><aside><h2>Exercise time remaining</h2><strong className="prs-duration" role="timer">{fmtClock((done?0:data.notes.length-cursor)*60/bpm/subdivision)}</strong><p>Count-ins and breaks are extra.</p>
 <fieldset disabled={locked}><NumberField deliberate label="Tempo · BPM" value={bpm} min={30} max={240} onChange={v=>change('bpm',v)}/><label>Notes per beat<select value={subdivision} onChange={e=>change('subdivision',Number(e.target.value))}>{Array.from({length:8},(_,i)=><option value={i+1} key={i}>{i+1}{i===2?' · triplets':i===3?' · sixteenths':''}</option>)}</select></label>

 <label>Instrument<select value={tone} onChange={e=>setTone(e.target.value)}>{[['piano','Grand piano'],['harpsichord','Harpsichord'],['electric','Clean electric'],['nylon','Nylon string']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></fieldset>
 <div className="prs-sound-switches">{[[sound,setSound,'Instrument'],[click,setClick,'Metronome'],[subdivisions,setSubdivisions,'Subdivisions']].map(([value,set,label])=><button key={label} role="switch" aria-checked={value} onClick={()=>set(!value)}>{label}<span>{value?'On':'Off'}</span></button>)}</div>
 <VolumeControls {...{instrumentVolume,metronomeVolume,setInstrumentVolume,setMetronomeVolume}}/>

 {done&&selected<EXERCISES.length-1&&<button className="chromatic-next" onClick={()=>choose(selected+1)}>Next exercise →</button>}
 <p role="status">{message}</p><p>Each exercise stops on its own. Resume repeats the current position with a fresh count-in.</p></aside></div>
 </>}
 </main></div>;
}
