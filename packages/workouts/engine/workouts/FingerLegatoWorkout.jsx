import React,{useState,useMemo,useRef,useEffect} from 'react';
import {buildFingerLegato,ROUTINE_META} from './fingerLegatoData';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from '../shared/metronome';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume} from './guitarSynth';
import {addSession,readLog,exportLog,importLog,fmtClock} from './storage';
import {useSessionReporter} from '../shared/sessionEvents';
import {ShapeFretboard} from './CurrentRoomShape';
import {NumberField} from './PieceSetup';
import TabView from './TabView';
import Tuning from './Tuning';
import VolumeControls from './VolumeControls';
import './room-sessions.css';
import './finger-legato.css';
const PREFS='workouts.finger-legato.settings',workoutId='finger-legato',title='The Legato Workout';
function read(){try{return JSON.parse(localStorage.getItem(PREFS))||{};}catch{return {};}}
export default function FingerLegatoWorkout({onBack}){
 const initial=useRef(read()).current;
 const [mode,setMode]=useState(initial.mode==='hammers'?'hammers':'legato');
 const modes=ROUTINE_META.modes,currentMode=modes.find(m=>m.id===mode);
 const [position,setPosition]=useState(currentMode.positions.includes(initial.position)?initial.position:currentMode.positions[0]);
 const [groups,setGroups]=useState(initial.groups?.length&&initial.groups.every(g=>['two','three','four'].includes(g))?initial.groups:['two','three']);
 const [bpm,setBpm]=useState(initial.bpm>=30&&initial.bpm<=200?initial.bpm:50);
 const [subdivision,setSubdivision]=useState([1,2,3,4,5,6,7,8].includes(initial.subdivision)?initial.subdivision:2);
 const [tone,setTone]=useState('piano'),[instrumentVolume,setInstrumentVolumeValue]=useState(100),[metronomeVolume,setMetronomeVolume]=useState(70);
 const [sound,setSound]=useState(true),[click,setClick]=useState(true),[sub,setSub]=useState(false);
 const [pass,setPass]=useState(0),[cursor,setCursor]=useState(0),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[count,setCount]=useState(null),[countTotal,setCountTotal]=useState(0),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 const data=useMemo(()=>({passages:buildFingerLegato({mode,position,groups})}),[mode,position,groups]);
 const passage=data.passages[Math.min(pass,data.passages.length-1)],note=passage.notes[cursor]||passage.notes[0];
 const report=useSessionReporter(),engine=useRef(null);if(!engine.current)engine.current=createMetronomeEngine();
 const runtime=useRef({token:0,timers:[],session:null});
 const options=useRef({});options.current={sound,click,sub,instrumentVolume,metronomeVolume};
 const locked=playing||loading;
 useEffect(()=>{localStorage.setItem(PREFS,JSON.stringify({mode,position,groups,bpm,subdivision}));},[mode,position,groups,bpm,subdivision]);
 useEffect(()=>{engine.current.setVolume(click?metronomeVolume/100:0);},[click,metronomeVolume]);
 useEffect(()=>{setInstrumentVolume(getAudioContext(),instrumentVolume/100);},[instrumentVolume]);
 useEffect(()=>{engine.current.setAudibleSubdivision(sub?subdivision:1);},[sub,subdivision]);
 useEffect(()=>{if(!sound)stopGuitar();},[sound]);
 function stop(){runtime.current.token++;runtime.current.timers.forEach(clearTimeout);runtime.current.timers=[];engine.current.stop();stopGuitar();}
 function save(){const r=runtime.current,s=r.session;if(!s)return;r.session=null;if(s.seconds<10)return;
  const record={workoutId,workoutTitle:title,startedAt:s.startedAt,seconds:Math.round(s.seconds),bpm:s.bpm,position:s.position,mode:s.mode,groups:s.groups,notesPerBeat:s.subdivision,complete:s.completed.size===s.total,exercisesDone:s.completed.size,exercisesTotal:s.total,practicedSequences:[...s.visited]};
  addSession(record);report({lab:'workouts',kind:'session',payload:{...record,durationSec:record.seconds,workoutName:title}});
 }
 function pause(){stop();save();setPlaying(false);setLoading(false);setCount(null);setMessage('Paused. Resume starts this pattern again with a count-in.');}
 useEffect(()=>{const hide=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);stop();save();};},[]);
 function change(fn,value){pause();fn(value);setDone(false);setPass(0);setCursor(0);setMessage('');}
 function jump(index){pause();setDone(false);setPass(index);setCursor(0);setMessage('');}
 async function start(){stop();const r=runtime.current,token=r.token;setLoading(true);setMessage('');
  try{await primeMetronomeAudio();await prepareGuitar(getAudioContext(),tone);if(token!==r.token)return;
   setInstrumentVolume(getAudioContext(),options.current.instrumentVolume/100);setLoading(false);setPlaying(true);
   r.session={startedAt:new Date().toISOString(),seconds:0,completed:new Set(),visited:new Set(),total:data.passages.length,bpm,position,mode,groups,subdivision};
   setDone(false);await play(done?0:pass,4,token);
  }catch{if(token===r.token){pause();setMessage('Could not start audio. Please try again.');}}
 }
 async function play(index,countIn,token){
  const r=runtime.current;if(token!==r.token)return;const p=data.passages[index];setPass(index);setCursor(0);setCountTotal(countIn);setCount(countIn||null);
  engine.current.setVolume(options.current.click?options.current.metronomeVolume/100:0);
  await engine.current.start({bpm,subdivision,audibleSubdivision:options.current.sub?subdivision:1,countInBeats:countIn,countInSubdivide:false,
   onCountIn:v=>{if(token===r.token)setCount(v);},
   onScheduleTick:(i,when)=>{
    if(token!==r.token)return false;const n=p.notes[i];
    if(n){if(options.current.sound)pluck(getAudioContext(),n.midi[0],when,60/bpm/subdivision*n.len,.5,{tight:true});return true;}
    const delay=Math.max(0,(when-getAudioContext().currentTime)*1000);
    r.timers.push(setTimeout(()=>{
     if(token!==r.token)return;engine.current.stop();stopGuitar();r.session.completed.add(index);
     if(index===data.passages.length-1){save();setDone(true);setPlaying(false);setCount(null);setMessage('Workout finished. Your practice is saved.');return;}
     play(index+1,2,token).catch(()=>{if(token===r.token){pause();setMessage('Playback stopped. Please try again.');}});
    },delay));return false;
   },
   onTick:i=>{if(token!==r.token||!p.notes[i])return;setCount(null);setCursor(i);r.session.seconds+=60/bpm/subdivision*p.notes[i].len;r.session.visited.add(index);}
  });
 }

 const remaining=data.passages.slice(pass).reduce((n,p)=>n+p.notes.length,0)-cursor;
 const shape=[...new Map(passage.notes.map(n=>[`${n.string}:${n.fret}`,n])).values()];
 const sessions=readLog().sessions.filter(s=>s.workoutId===workoutId);
 return <div className="prs finger-legato"><header><button onClick={()=>{pause();onBack();}}>← Workouts</button>{!locked&&<Tuning/>}</header><main>
 <div className="prs-eyebrow">FINGER INDEPENDENCE · LEGATO</div><h1>{title}</h1>
 <p>Work through the finger combinations in one position. Keep every note clear, even and relaxed.</p>
 <div className="prs-layout"><section>
 <fieldset disabled={locked} className="fl-settings"><div className="prs-position">
 <label>Technique<select value={mode} onChange={e=>{const m=modes.find(m=>m.id===e.target.value);change(setMode,m.id);setPosition(m.positions[0]);}}>{modes.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 <label>Position<select value={position} onChange={e=>change(setPosition,+e.target.value)}>{currentMode.positions.map(p=><option key={p} value={p}>Index finger · fret {p}</option>)}</select></label></div><p>{currentMode.blurb}</p>
 <div className="fl-groups">{[['two','Two fingers','12 patterns'],['three','Three fingers','24 patterns'],['four','Four fingers','24 patterns']].map(([g,l,n])=><button key={g} aria-pressed={groups.includes(g)} disabled={groups.length===1&&groups.includes(g)} onClick={()=>change(setGroups,groups.includes(g)?groups.filter(v=>v!==g):[...groups,g])}><strong>{l}</strong><span>{n}</span></button>)}</div>
 <p>Start with two fingers and one other group. Add all three for a longer session.</p>
 <details><summary>Preview a pattern before you start</summary><p>Choose a group and finger pattern, then scroll through the tab. The fret numbers match your selected position.</p><div className="prs-position"><label>Group<select value={passage.section} onChange={e=>jump(data.passages.findIndex(p=>p.section===e.target.value))}>{[...new Map(data.passages.map(p=>[p.section,p.sectionTitle]))].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Finger pattern<select value={passage.id} onChange={e=>jump(data.passages.findIndex(p=>p.id===e.target.value))}>{data.passages.filter(p=>p.section===passage.section).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></div></details></fieldset>
 <div className="prs-passage-heading"><div><div className="prs-eyebrow">{passage.sectionTitle}</div><h2>{count?`Count in · ${count}`:passage.label}</h2><p>Position {position} · {subdivision} notes per beat</p><button className="prs-start" disabled={loading} onClick={()=>playing?pause():start()}>{loading?'Loading sound…':playing?'Pause':done?'Practice again':cursor?'Resume pattern ▶':'Start practicing ▶'}</button></div><ShapeFretboard notes={shape} label={`Position ${position}`} activeNote={playing&&count===null?note:null}/></div>
 <TabView key={`${mode}-${position}-${pass}`} continuous notes={passage.notes} cursor={playing&&count===null?cursor:-1} notesPerBeat={subdivision}/>
 <p>{mode==='hammers'?'H = hammer every note, including string changes.':'H = hammer-on · P = pull-off. Pick symbols mark each string entry.'} Two beats between patterns.</p>
 <details><summary>Your practice · {sessions.length} sessions</summary><p>Your sessions are saved in this browser. Export a backup to keep them safe or move to another device.</p>{sessions.slice(-5).reverse().map((s,i)=><p key={i}>{new Date(s.startedAt).toLocaleDateString()} · {s.mode==='hammers'?'All Hammers':'Normal Legato'} · Position {s.position} · {s.bpm} BPM · {fmtClock(s.seconds)}</p>)}<div className="prs-position"><button onClick={()=>{exportLog();setMessage('Practice log exported.');}}>Export JSON</button><label>Import JSON<input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const result=importLog(JSON.parse(await f.text()));setMessage(result.ok?`Imported ${result.added} sessions.`:result.error);}catch{setMessage('Could not import that backup.');}e.target.value='';}}/></label></div></details>
 </section><aside><h2>Time remaining</h2><strong className="prs-duration">{fmtClock(done?0:(remaining/subdivision+Math.max(0,data.passages.length-pass-1)*2+(countTotal===2?(count||0):0))*60/bpm)}</strong><p>Includes two beats between patterns. Initial count-in is extra.</p><fieldset disabled={locked} className="fl-settings"><NumberField deliberate label="Tempo · BPM" value={bpm} min={30} max={200} onChange={v=>change(setBpm,v)}/><label>Notes per beat<select value={subdivision} onChange={e=>change(setSubdivision,+e.target.value)}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}{n===2?' · eighth notes':n===3?' · triplets':''}</option>)}</select></label><label>Instrument<select value={tone} onChange={e=>setTone(e.target.value)}>{[['piano','Grand piano'],['harpsichord','Harpsichord'],['electric','Clean electric'],['nylon','Nylon string']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></fieldset>
 <div className="prs-sound-switches">{[[sound,setSound,'Instrument'],[click,setClick,'Metronome'],[sub,setSub,'Subdivisions']].map(([v,set,l])=><button key={l} role="switch" aria-checked={v} onClick={()=>set(!v)}>{l}<span>{v?'On':'Off'}</span></button>)}</div><VolumeControls instrumentVolume={instrumentVolume} metronomeVolume={metronomeVolume} setInstrumentVolume={setInstrumentVolumeValue} setMetronomeVolume={setMetronomeVolume}/><p role="status">{message}</p></aside></div></main></div>;
}
