import {focusPassages,completedFocusSequences} from './sequenceFocus';
import WorkoutCoverHeading from './WorkoutCoverHeading';
import {buildSweep,SWEEP_SECTIONS,FIVE_SWEEP_SECTIONS,sweepKeyLabel} from './sweepData';
import {buildLegato} from './legatoData';
import React,{useState,useMemo,useRef,useEffect} from 'react';
import {buildNps,NPS_ID,NPS_TITLE,NPS_KEY_ORDER,NPS_SCALES,npsKeyLabel} from './npsData';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from '../shared/metronome';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume} from './guitarSynth';
import {addSession,readLog,fmtClock} from './storage';
import {useSessionReporter} from '../shared/sessionEvents';
import {ShapeFretboard,scaleShapeLabel} from './CurrentRoomShape';
import {NumberField} from './PieceSetup';
import TabView from './TabView';
import Tuning from './Tuning';
import VolumeControls from './VolumeControls';
import './room-sessions.css';
import './nps-workout.css';
function read(PREFS){try{return JSON.parse(localStorage.getItem(PREFS))||{};}catch{return {};}}
export default function NpsWorkout({onBack,legato=false,sweep=false,five=false}){
 const sweepSections=five?FIVE_SWEEP_SECTIONS:SWEEP_SECTIONS;
 const keyLabel=k=>sweepKeyLabel((k+(five?5:0))%12);
 const PREFS=five?'workouts.sweep-five.settings':sweep?'workouts.sweep.settings':legato?'workouts.legato.settings':'workouts.nps.settings';
 const workoutId=five?'chops-sweep-5string-1':sweep?'chops-sweep-3string-1':legato?'chops-legato-1':NPS_ID,title=five?'5-String Sweep Picking Workout #1':sweep?'3-String Sweep Picking Workout #1':legato?'Legato Workout #1':NPS_TITLE,sequenceCount=five?14:sweep?56:legato?13:11;
 const initial=useRef(read(PREFS)).current;
 const [key,setKey]=useState(Number.isInteger(initial.key)&&initial.key>=0&&initial.key<12?initial.key:0),[stroke,setStroke]=useState(initial.stroke==='U'?'U':'D');
 const [scale,setScale]=useState(Object.hasOwn(NPS_SCALES,initial.scale)?initial.scale:'natural');
 const [bpm,setBpm]=useState(initial.bpm>=30&&initial.bpm<=200?initial.bpm:80),[frets,setFrets]=useState(initial.frets===22?22:24);
 const [subdivision,setSubdivision]=useState(Number.isInteger(initial.subdivision)&&initial.subdivision>=1&&initial.subdivision<=8?initial.subdivision:2);
 const [tone,setTone]=useState('piano'),[instrumentVolume,setInstrumentVolumeValue]=useState(100),[metronomeVolume,setMetronomeVolume]=useState(70);
 const [sound,setSound]=useState(true),[click,setClick]=useState(true),[sub,setSub]=useState(false);
 const [pass,setPass]=useState(0),[cursor,setCursor]=useState(0),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[count,setCount]=useState(null),[countTotal,setCountTotal]=useState(0),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 const [practiceMode,setPracticeMode]=useState(!sweep&&initial.practiceMode==='focus'?'focus':'full');
 const [focusSequence,setFocusSequence]=useState(Number.isInteger(initial.focusSequence)&&initial.focusSequence>=0&&initial.focusSequence<sequenceCount?initial.focusSequence:0);
 const fullData=useMemo(()=>(sweep?buildSweep:legato?buildLegato:buildNps)({key,startStroke:stroke,frets,scale,bpm,subdivision,five}),[key,stroke,frets,scale,legato,sweep,bpm,subdivision,five]);
 const data=useMemo(()=>focusPassages(fullData,practiceMode,focusSequence),[fullData,practiceMode,focusSequence]);
 const focusChecks=completedFocusSequences(readLog().sessions,{workoutId,bpm,key:npsKeyLabel(key,scale),scale,notesPerBeat:subdivision,frets,...(legato?{}:{startStroke:stroke})},sequenceCount,fullData.pairs?.length||0);
 const passage=data.passages[Math.min(pass,data.passages.length-1)],note=passage.notes[cursor]||passage.notes[0];
 const report=useSessionReporter(),engine=useRef(null);if(!engine.current)engine.current=createMetronomeEngine();
 const runtime=useRef({token:0,timers:[],session:null});
 const options=useRef({});options.current={sound,click,sub,instrumentVolume,metronomeVolume};
 const locked=playing||loading;
 useEffect(()=>{localStorage.setItem(PREFS,JSON.stringify({key,stroke,bpm,frets,subdivision,scale,practiceMode,focusSequence}));},[key,stroke,bpm,frets,subdivision,scale,practiceMode,focusSequence]);
 useEffect(()=>{engine.current.setVolume(click?metronomeVolume/100:0);},[click,metronomeVolume]);
 useEffect(()=>{setInstrumentVolume(getAudioContext(),instrumentVolume/100);},[instrumentVolume]);
 useEffect(()=>{engine.current.setAudibleSubdivision(sub?subdivision:1);},[sub,subdivision]);
 useEffect(()=>{if(!sound)stopGuitar();},[sound]);
 function stop(){runtime.current.token++;runtime.current.timers.forEach(clearTimeout);runtime.current.timers=[];engine.current.stop();stopGuitar();}
 function save(){const r=runtime.current,s=r.session;if(!s)return;r.session=null;if(s.seconds<10)return;
  const record={workoutId,workoutTitle:title,startedAt:s.startedAt,seconds:Math.round(s.seconds),bpm:s.bpm,key:s.key,scale:s.scale,...((legato||sweep)?{}:{startStroke:s.stroke}),notesPerBeat:s.subdivision,complete:s.completed.size===s.total,exercisesDone:s.completed.size,exercisesTotal:s.total,practicedSequences:[...s.visited],frets:s.frets,practiceMode:s.practiceMode,focusSequence:s.focusSequence,completedPositions:[...s.completedPositions]};
  addSession(record);report({lab:'workouts',kind:'session',payload:{...record,durationSec:record.seconds,workoutName:title}});
 }
 function pause(){stop();save();setPlaying(false);setLoading(false);setCount(null);setMessage('Paused. Resume repeats this sequence with a count-in.');}
 useEffect(()=>{const hide=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);stop();save();};},[]);
 function change(fn,value){pause();fn(value);setDone(false);setPass(0);setCursor(0);setMessage('');}
 function jump(index){pause();setDone(false);setPass(index);setCursor(0);setMessage('');}
 async function start(){stop();const r=runtime.current,token=r.token;setLoading(true);setMessage('');
  try{await primeMetronomeAudio();await prepareGuitar(getAudioContext(),tone);if(token!==r.token)return;
   setInstrumentVolume(getAudioContext(),options.current.instrumentVolume/100);setLoading(false);setPlaying(true);
   r.session={startedAt:new Date().toISOString(),seconds:0,completed:new Set(),visited:new Set(),total:data.passages.length,practiceMode,focusSequence,completedPositions:new Set(),bpm,key:sweep?keyLabel(key):npsKeyLabel(key,scale),scale:sweep?undefined:scale,stroke,frets,subdivision};
   setDone(false);await play(done?0:pass,4,token);
  }catch{if(token===r.token){pause();setMessage('Could not start audio. Please try again.');}}
 }
 async function play(index,countIn,token){
  const r=runtime.current;if(token!==r.token)return;const p=data.passages[index];let firstWhen;setPass(index);setCursor(0);setCountTotal(countIn);setCount(countIn||null);
  engine.current.setVolume(options.current.click?options.current.metronomeVolume/100:0);
  await engine.current.start({bpm,subdivision,audibleSubdivision:options.current.sub?subdivision:1,countInBeats:countIn,countInSubdivide:false,
   onCountIn:v=>{if(token===r.token)setCount(v);},
   onScheduleTick:(i,when)=>{
    if(token!==r.token)return false;const n=p.notes[i];if(i===0)firstWhen=when;
    if(n){if(options.current.sound)pluck(getAudioContext(),n.midi[0],when,60/bpm/subdivision*n.len,.5,{tight:true});return true;}
    const delay=Math.max(0,((sweep?firstWhen+p.duration:when)-getAudioContext().currentTime)*1000);
    r.timers.push(setTimeout(()=>{
     if(token!==r.token)return;engine.current.stop();stopGuitar();r.session.completed.add(index);r.session.completedPositions.add(p.position);
     if(index===data.passages.length-1){save();setDone(true);setPlaying(false);setCount(null);setMessage('Workout finished. Your practice is saved.');return;}
     play(index+1,2,token).catch(()=>{if(token===r.token){pause();setMessage('Playback stopped. Please try again.');}});
    },delay));return false;
   },
   onTick:i=>{if(token!==r.token||!p.notes[i])return;setCount(null);setCursor(i);r.session.seconds+=60/bpm/subdivision*p.notes[i].len;r.session.visited.add(index);}
  });
 }
 const remaining=data.passages.slice(pass).reduce((n,p)=>n+p.notes.length,0)-cursor;
 const remainingSeconds=done?0:(sweep?data.passages.slice(pass).reduce((sum,p)=>sum+p.duration,0)-cursor*60/bpm/subdivision:remaining*60/bpm/subdivision)+(Math.max(0,data.passages.length-pass-1)*2+(countTotal===2?(count||0):0))*60/bpm;
 const shape=sweep?passage.shapes[note.shape].notes:passage.pair[note.shape?'upper':'lower'];
 return <div className="prs nps-workout"><header><button onClick={()=>{pause();onBack();}}>← Chops Builders</button>{!locked&&<Tuning/>}</header><main>
 <WorkoutCoverHeading eyebrow="THE PRACTICE ROOM CHOPS BUILDERS" title={title} cover={five?"/workouts/chops-builder-sweep-five.png":sweep?"/workouts/chops-builder-sweep.png":legato?"/workouts/chops-builder-legato.png":"/workouts/chops-builder-3nps.png"}/>
 {sweep?<p>{five?'Four minutes per exercise, then five minutes for each of the final two combinations. 58 minutes of playing using':'56 one-minute exercises using'} {keyLabel(key)} arpeggios. Follow the written picking, keep the notes separate, and choose a tempo where every note is accurate.</p>:<p>{legato?'Thirteen':'Eleven'} sequences in each pair of neighbouring shapes. Start at the lowest available position and work up the fretboard. Choose a tempo where every note is clear and relaxed.</p>}
 <details style={{marginBottom:24}}><summary>Watch the introduction</summary><iframe title={`${title} introduction`} src={`https://www.youtube-nocookie.com/embed/${sweep?(five?'VLc56R5oPZw':'7dB9hDpw1hY'):legato?'YN0IZGywlBs':'VuziMUlW6tQ'}`} loading="lazy" allowFullScreen style={{width:'100%',maxWidth:850,aspectRatio:'16/9',border:0}}/><p>This walkthrough is from when I first made the routine. In the app version you can (and should!) {sweep?'work through any key you want.':'work through any key and 3 different scales.'}</p>{!sweep&&<p>80 BPM · eighth notes is the starting suggestion. Repeat the routine over several days and try different keys. {legato?'Pick when changing strings, then use hammer-ons and pull-offs. Keep the dynamics even.':'Every position reverses the starting pick stroke.'}</p>}</details>
 {!locked&&<details style={{marginBottom:24}}><summary>Before you start · Preview the shapes and exercises</summary><p>Unsure about a pattern? {sweep?'Choose a section and exercise below.':'Choose any shape using Starting position, then pick an exercise from Sequence.'} Scroll sideways through the tab to check the notes before you press Start practicing. Take a look whenever you need it—you don’t have to follow the tab the whole time.</p></details>}
 {locked&&<div className="nps-live-bar"><div><strong>{practiceMode==='focus'?`Focus · Sequence ${focusSequence+1}`:`Exercise ${passage.sequence+1}`}</strong><span>{count?`Count in · ${count}`:sweep?'Playing':`Position ${passage.position+1} of ${data.pairs.length}`}</span></div><div className="nps-live-time"><span>Time remaining</span><strong>{fmtClock(remainingSeconds)}</strong></div><button disabled={loading} onClick={pause}>Pause</button></div>}
 <div className="prs-layout"><section>
 <fieldset disabled={locked} style={{border:0,padding:0}}>
 {!sweep&&<div className="nps-focus"><div className="nps-mode" aria-label="Practice mode">{[['full','Full workout'],['focus','Focus on one sequence']].map(([v,l])=><button key={v} aria-pressed={practiceMode===v} onClick={()=>change(setPracticeMode,v)}>{l}</button>)}</div>
 {practiceMode==='focus'&&!locked&&<><div className="nps-focus-heading"><strong>Choose your sequence</strong><span>{focusChecks.filter(Boolean).length} of {sequenceCount} completed</span></div><div className="nps-sequences">{Array.from({length:sequenceCount},(_,i)=><button key={i} aria-label={`Sequence ${i+1}${focusChecks[i]?', completed':''}`} aria-pressed={focusSequence===i} onClick={()=>change(setFocusSequence,i)}>{i+1}{focusChecks[i]&&<span aria-hidden="true"> ✓</span>}</button>)}</div><p>One sequence through every position, with two beats between each pair of shapes. ✓ means all positions completed in this key and scale, at any tempo or subdivision{legato?'':', with this starting stroke'}. Paused sessions count toward the same checklist. Your practice log keeps the exact tempo and subdivision.</p></>}
 </div>}
 <div className="prs-position">
 {!sweep&&<><label>Scale<select value={scale} onChange={e=>change(setScale,e.target.value)}>{Object.entries(NPS_SCALES).map(([value,s])=><option key={value} value={value}>{s.label}</option>)}</select></label>
 <label>Key<select value={key} onChange={e=>change(setKey,Number(e.target.value))}>{NPS_KEY_ORDER.map(i=><option key={i} value={i}>{npsKeyLabel(i,scale)}</option>)}</select></label>
 {!legato&&<label>Start on<select value={stroke} onChange={e=>change(setStroke,e.target.value)}><option value="D">Downstroke</option><option value="U">Upstroke</option></select></label>}
 <label>Guitar<select value={frets} onChange={e=>change(setFrets,Number(e.target.value))}><option value="24">24 frets</option><option value="22">22 frets</option></select></label></>} </div>
 {!sweep&&<><p className="nps-key-tip">{scale==='natural'?'Try one key per day: C / A minor → G / E minor → D / B minor. Each step changes one note in the scale.':scale==='harmonic'?'Natural minor with a raised seventh. Follow the keys in fifths: A → E → B.':'Raised sixth and seventh, ascending and descending. Follow the keys in fifths: A → E → B.'}</p>
 <div className="prs-position"><label>Starting position<select value={passage.position} onChange={e=>jump(practiceMode==='focus'?Number(e.target.value):Number(e.target.value)*sequenceCount)}>{data.pairs.map((p,i)=><option value={i} key={i}>{i+1} of {data.pairs.length} · low E fret {p.fret}</option>)}</select></label>
 {practiceMode==='full'&&<label>Sequence<select value={passage.sequence} onChange={e=>jump(passage.position*sequenceCount+Number(e.target.value))}>{Array.from({length:sequenceCount},(_,i)=><option value={i} key={i}>Exercise #{i+1}</option>)}</select></label>}</div></>}
 {sweep&&<div className="prs-position"><label>Key<select value={key} onChange={e=>change(setKey,Number(e.target.value))}>{NPS_KEY_ORDER.map(k=><option key={k} value={k}>{keyLabel(k)}</option>)}</select></label><label>Section<select value={passage.section} onChange={e=>jump(sweepSections.find(s=>s.title===e.target.value).start)}>{sweepSections.map(s=><option key={s.title} value={s.title}>{s.title.replaceAll("A minor",keyLabel(key).split(" / ")[0]).replaceAll("E major",keyLabel(key).split(" / ")[1]).replaceAll("Am",keyLabel(key).split(" / ")[0]).replaceAll("E ",keyLabel(key).split(" / ")[1]+" ")}</option>)}</select></label><label>Exercise<select value={pass} onChange={e=>jump(Number(e.target.value))}>{data.passages.filter(p=>p.section===passage.section).map(p=><option key={p.sequence} value={p.sequence}>#{p.sequence+1} · {p.shapes.map(s=>s.label).filter((s,i,a)=>a.indexOf(s)===i).join(" → ")}</option>)}</select></label></div>}</fieldset>
 <div className="prs-passage-heading"><div><h2>{count?`Count in · ${count}`:sweep?`Exercise #${pass+1} of ${data.passages.length}`:`Exercise #${passage.sequence+1} · Position ${passage.position+1}`}</h2><p>{sweep?'Sweep picking':legato?'Hammer-ons & pull-offs':`${passage.stroke==='D'?'Downstroke':'Upstroke'} start`} · {subdivision} {subdivision===1?'note':'notes'} per beat</p><button className="prs-start" disabled={loading} onClick={()=>playing?pause():start()}>{loading?'Loading sound…':playing?'Pause':'Start practicing ▶'}</button></div>
 <ShapeFretboard notes={shape.flat()} root={sweep?passage.shapes[note.shape].root:(key+9)%12} label={sweep?passage.shapes[note.shape].label:scaleShapeLabel(shape,(key+9)%12,npsKeyLabel(key,scale).split(' / ').pop(),NPS_SCALES[scale].intervals)} activeNote={playing&&count===null?note:null}/></div>
 <TabView key={pass} continuous notes={passage.notes} cursor={playing&&count===null?cursor:-1} notesPerBeat={subdivision}/>
 <p>{sweep?`Loop for ${passage.duration/60} ${passage.duration===60?'minute':'minutes'}, then count two beats before the next exercise. H = hammer-on · P = pull-off. Shapes move by octaves where needed to stay within frets 1–24.`: 'Finish on the opening note, then count two beats before the next sequence.'}</p>{legato&&<p>H = hammer-on · P = pull-off · m = middle finger (hybrid picking). Exercise 13 runs twice.</p>}
 </section><aside>{sweep&&<><h2>This exercise</h2><strong className="prs-duration">{fmtClock(done?0:Math.max(0,passage.duration-cursor*60/bpm/subdivision))}</strong></>}<h2>Time remaining</h2><strong className="prs-duration">{fmtClock(remainingSeconds)}</strong><p>Includes two beats between sequences. Initial count-in is extra.</p>
 <fieldset disabled={locked} style={{border:0,padding:0}}><NumberField deliberate label="Tempo · BPM" value={bpm} min={30} max={200} onChange={v=>change(setBpm,v)}/>
 <label>Notes per beat<select value={subdivision} onChange={e=>change(setSubdivision,Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(v=><option key={v} value={v}>{v}{v===2?' · eighth notes':v===3?' · triplets':v===4?' · sixteenths':''}</option>)}</select></label>
 <label>Instrument<select value={tone} onChange={e=>setTone(e.target.value)}>{[['piano','Grand piano'],['harpsichord','Harpsichord'],['electric','Clean electric'],['nylon','Nylon string']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></fieldset>
 <div className="prs-sound-switches">{[[sound,setSound,'Instrument'],[click,setClick,'Metronome'],[sub,setSub,'Subdivisions']].map(([v,set,label])=><button key={label} role="switch" aria-checked={v} onClick={()=>set(!v)}>{label}<span>{v?'On':'Off'}</span></button>)}</div>
 <VolumeControls instrumentVolume={instrumentVolume} metronomeVolume={metronomeVolume} setInstrumentVolume={setInstrumentVolumeValue} setMetronomeVolume={setMetronomeVolume}/><p role="status">{message}</p>
 </aside></div></main></div>;
}
