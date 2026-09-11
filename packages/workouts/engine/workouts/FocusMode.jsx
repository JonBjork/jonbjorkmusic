import MetronomeSubdivisions, {readSubdivision} from './MetronomeSubdivisions';
import React,{useState,useEffect,useMemo,useRef} from 'react';
import {Choices,NumberField} from './PieceSetup';
import {buildFocusWindows} from './focusData';
import TabView from './TabView';
import VolumeControls from './VolumeControls';
import {prepareGuitar,pluck,stopGuitar,setInstrumentVolume} from './guitarSynth';
import {createMetronomeEngine,primeMetronomeAudio,getAudioContext} from '../shared/metronome';
import {addSession} from './storage';
import {useSessionReporter} from '../shared/sessionEvents';
import './focus-mode.css';
function prefs(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
export default function FocusMode({workout,startBar,endBar,tone,instrumentVolume,metronomeVolume,onClose}) {
 const addEvent=useSessionReporter();
 const key='workouts.focus.'+workout.id,initial=useRef(prefs(key)).current;
 const [method,setMethod]=useState(initial.method||'beat'),[bpm,setBpm]=useState(initial.bpm||workout.piece.tempo||120);
 const [subdivision,setSubdivision]=useState(initial.subdivision||4),[ratio,setRatio]=useState(initial.ratio||7),[direction,setDirection]=useState(initial.direction||'long-short');
 const [beatsPerBurst,setBeatsPerBurst]=useState(Math.max(1,Math.min(16,Math.floor(Number(initial.beatsPerBurst))||1)));
 const [reps,setReps]=useState(initial.reps||4),[pause,setPause]=useState(initial.pause||1),[countBeats,setCountBeats]=useState(initial.countBeats||2),[advance,setAdvance]=useState(initial.advance!==false);
 const [from,setFrom]=useState(startBar),[to,setTo]=useState(endBar),[index,setIndex]=useState(0),[rep,setRep]=useState(1),[cursor,setCursor]=useState(-1);
 const [status,setStatus]=useState('ready'),[count,setCount]=useState(null),[message,setMessage]=useState('');
 const [sound,setSound]=useState(true),[click,setClick]=useState(true),[iv,setIv]=useState(instrumentVolume),[mv,setMv]=useState(metronomeVolume);
 const [clickSubdivisions,setClickSubdivisions]=useState(initial.clickSubdivisions===true);
 const [clickSubdivision,setClickSubdivision]=useState(readSubdivision(initial.clickSubdivision));
 const [voice,setVoice]=useState(tone),[busy,setBusy]=useState(false);
 const modal=useRef(),engine=useRef(),timer=useRef(),alive=useRef(true),generation=useRef(0),session=useRef(null),active=useRef(false),playRef=useRef();
 if(!engine.current)engine.current=createMetronomeEngine();
 const windows=useMemo(()=>buildFocusWindows(workout.piece,{startBar:from,endBar:to,method,subdivision,beatsPerBurst,ratio,direction}),[workout,from,to,method,subdivision,beatsPerBurst,ratio,direction]);
 const chosen=windows[Math.min(index,windows.length-1)];
 useEffect(()=>{modal.current.showModal();alive.current=true;return()=>{alive.current=false;stop();save();setInstrumentVolume(getAudioContext(),instrumentVolume/100);};},[]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({method,bpm,subdivision,beatsPerBurst,ratio,direction,reps,pause,countBeats,advance,clickSubdivisions,clickSubdivision}));}catch{}},[key,method,bpm,subdivision,beatsPerBurst,ratio,direction,reps,pause,countBeats,advance,clickSubdivisions,clickSubdivision]);
 useEffect(()=>{engine.current.setVolume(mv/100);},[mv]);
 useEffect(()=>{setInstrumentVolume(getAudioContext(),iv/100);},[iv]);
 const audioSettings=useRef({sound,click,iv});audioSettings.current={sound,click,iv};
 useEffect(()=>{engine.current.setMuted(!click);},[click]);
 useEffect(()=>{engine.current.setAudibleSubdivision(clickSubdivisions?clickSubdivision:1);},[clickSubdivisions,clickSubdivision]);
 function stop(){generation.current++;clearTimeout(timer.current);engine.current.stop();stopGuitar();active.current=false;}
 function save(){const s=session.current;if(!s)return;session.current=null;const seconds=Math.round((Date.now()-s.started)/1000);if(!s.bursts&&seconds<10)return;
  const data={workoutId:workout.id,workoutTitle:workout.title,startedAt:new Date(s.started).toISOString(),seconds,bpm:s.bpm,mode:'focus',focusMethod:s.method,focusBeatsPerBurst:s.method==='beat'?s.beatsPerBurst:undefined,focusRange:[s.from,s.to],focusBursts:s.bursts,focusWindows:[...s.windows],complete:false,barsPlayed:[],barsDone:null};
  addSession(data);addEvent({lab:'workouts',kind:'session',payload:{workoutId:workout.id,workoutName:workout.short+' · Focus Mode',durationSec:seconds,bpm:s.bpm,focusMethod:s.method,focusBeatsPerBurst:s.method==='beat'?s.beatsPerBurst:undefined,focusBursts:s.bursts,barsPlayed:[]}});
 }
 function finish(text){stop();save();if(alive.current){setStatus('ready');setCursor(-1);setCount(null);setBusy(false);setMessage(text);}}
 function close(){stop();save();onClose();}
 async function start(){stop();const token=generation.current;setBusy(true);setMessage('');try{await primeMetronomeAudio();if(sound)await prepareGuitar(getAudioContext(),voice);if(!alive.current||token!==generation.current)return;
 session.current={started:Date.now(),bpm,method,beatsPerBurst,from,to,bursts:0,windows:new Set()};setBusy(false);playRef.current(index,1);
 }catch{if(alive.current){setBusy(false);setMessage('Sound could not load. Try Original synth or turn instrument sound off.');}}}
 async function run(i,r){const w=windows[i];if(!w){finish('Session saved.');return;}const token=++generation.current;active.current=true;setStatus('playing');setIndex(i);setRep(r);setCursor(-1);setCount(countBeats);
 const lead=w.leadTicks||0;
 engine.current.setMuted(!audioSettings.current.click);await engine.current.start({bpm,subdivision:w.tickRate,audibleSubdivision:clickSubdivisions?clickSubdivision:1,countInSubdivide:clickSubdivisions,countInBeats:countBeats-(lead?1:0),countInSubdivision:clickSubdivision,
 onCountIn:n=>{if(token===generation.current)setCount(n+(lead?1:0));},
 onScheduleTick:(clockTick,when)=>{const tick=clockTick-lead;if(token!==generation.current||tick>=w.notes.length)return false;engine.current.setMuted(lead&&clockTick===0?false:!audioSettings.current.click);if(tick<0)return true;const n=w.notes[tick];if(n.midi?.length&&audioSettings.current.sound)n.midi.forEach(m=>pluck(getAudioContext(),m,when,(n.duration||24)/w.tickRate*60/bpm,.5,{tight:method==='rhythm'}));return true;},
 onTick:clockTick=>{if(token!==generation.current)return;const tick=clockTick-lead;if(tick<0){setCount(1);return;}setCount(null);if(!w.notes[tick].hold)setCursor(tick);if(tick!==w.notes.length-1)return;
 session.current.bursts++;session.current.windows.add(w.events[0].note);
 const nextRep=r<reps?r+1:1,nextIndex=r<reps?i:(method==='beat'&&advance?i+1:windows.length);
 setStatus('rest');const next=nextIndex<windows.length;
 timer.current=setTimeout(()=>{if(token!==generation.current)return;if(next)playRef.current(nextIndex,nextRep);else finish('Focus session saved to your practice log.');},(next?pause:.7)*1000);
 }});
 }
 playRef.current=run;
 function change(fn,value){stop();save();setStatus('ready');setCursor(-1);setCount(null);setIndex(0);setMessage('');fn(value);}
 const locked=status!=='ready'||busy;
 return <dialog className="fm-dialog" ref={modal} onCancel={e=>{e.preventDefault();close();}} aria-labelledby="fm-title"><header className="fm-header"><div><span className="cp-eyebrow">{workout.short}</span><h1 id="fm-title">FOCUS MODE</h1></div><button onClick={close}>← Back to piece</button></header>
 <div className="fm-layout"><section><fieldset disabled={locked}><Choices label="Practice method" value={method} options={[["beat","Beat to Beat"],["rhythm","Rhythm Variations"]]} onChange={v=>change(setMethod,v)}/><div className="fm-range"><NumberField label="From bar" value={from} min={1} max={workout.piece.bars.length} onChange={v=>{change(setFrom,v);if(v>to)setTo(v);}}/><NumberField label="To bar" value={to} min={from} max={workout.piece.bars.length} onChange={v=>change(setTo,v)}/></div>
 {method==='beat'?<><p>{beatsPerBurst} beat{beatsPerBurst===1?'':'s'} of movement plus the landing note. Each burst starts on the beat, keeping the original pick strokes.</p><NumberField deliberate label="Beats per burst" value={beatsPerBurst} min={1} max={16} onChange={v=>{setBeatsPerBurst(v);setCursor(-1);setMessage('');}}/><p>{beatsPerBurst} × {subdivision} + 1 landing note · written rests and note lengths are preserved</p><Choices label="Notes per beat" value={subdivision} options={[[2,'2'],[3,'3'],[4,'4 · as written'],[6,'6'],[8,'8']]} onChange={v=>change(setSubdivision,v)}/><label className="fm-select">Start at<select value={Math.min(index,windows.length-1)} onChange={e=>{setIndex(Number(e.target.value));setCursor(-1);}}>{windows.map((w,i)=><option key={i} value={i}>{w.label} · {w.events[0].stroke==='U'?'Upstroke':w.events[0].stroke==='D'?'Downstroke':w.events[0].legato||'As written'}</option>)}</select></label></>:<><p>Stretch the long note; make the short transition precise. Original pick strokes stay in place.</p><Choices label="Rhythm" value={ratio} options={[[7,'Double-dotted · 7:1'],[3,'Dotted · 3:1']]} onChange={v=>change(setRatio,v)}/><Choices label="Direction" value={direction} options={[["long-short","Long–short"],["short-long","Short–long"]]} onChange={v=>change(setDirection,v)}/><p>{ratio===7?'Double-dotted eighth + 32nd':'Dotted eighth + sixteenth'} · {direction==='short-long'?'Quick pickup before beat one; long notes land on the beat.':'One pair per beat.'} Rests, longer notes and triplets keep their written rhythm.</p></>}
 </fieldset><div className="fm-score"><div className="fm-score-head"><strong>{chosen?.label}</strong><span>{count?`Count in · ${count}`:status==='rest'?'Reset your hands':status==='playing'?`Pass ${rep} of ${reps}`:'Ready'}</span></div>{chosen&&<TabView notes={chosen.notes} beatOffset={chosen.leadTicks||0} cursor={cursor} tuning={workout.piece.tuning} notesPerBeat={method==='beat'?subdivision:4} resolution={chosen.tickRate/(method==='beat'?subdivision:4)}/>}<p>⊓ Downstroke · ∨ Upstroke {chosen?.events.at(-1)?.landing?'· Includes landing note':'· End of piece'}</p></div>
 {method==='beat'&&<div className="cp-choices"><button disabled={locked||index===0} onClick={()=>setIndex(index-1)}>← Previous note</button><button disabled={locked||index===windows.length-1} onClick={()=>setIndex(index+1)}>Next note →</button><span>Window {index+1} of {windows.length}</span></div>}
 </section><aside><fieldset disabled={locked}><NumberField deliberate label="Focus tempo" value={bpm} min={30} max={320} onChange={setBpm}/><p>BPM · remembered separately from your normal session</p><NumberField deliberate label="Repetitions" value={reps} min={1} max={100} onChange={setReps}/>{method==='beat'&&<Choices label="After repetitions" value={advance} options={[[true,'Next note'],[false,'Finish here']]} onChange={setAdvance}/>}<details><summary>Sound & timing</summary><Choices label="Rest before count-in" value={pause} options={[[.5,'0.5s'],[1,'1s'],[1.5,'1.5s'],[2,'2s'],[3,'3s']]} onChange={setPause}/><Choices label="Count-in" value={countBeats} options={[[2,'2 beats'],[4,'4 beats']]} onChange={setCountBeats}/><label className="fm-select">Instrument<select value={voice} onChange={e=>setVoice(e.target.value)}>{[['piano','Grand piano'],['harpsichord','Harpsichord'],['electric','Clean electric'],['nylon','Nylon string'],['original','Original synth']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></details></fieldset>
 <div className="cp-choices"><button role="switch" aria-checked={sound} onClick={()=>setSound(!sound)}>Instrument</button><button role="switch" aria-checked={click} onClick={()=>setClick(!click)}>Metronome</button></div><MetronomeSubdivisions enabled={clickSubdivisions} onToggle={setClickSubdivisions} value={clickSubdivision} onChange={setClickSubdivision}/><VolumeControls instrumentVolume={iv} metronomeVolume={mv} setInstrumentVolume={setIv} setMetronomeVolume={setMv}/>
 {locked?<button className="fm-start" onClick={()=>finish('Session ended. Completed focus work is saved.')}>Stop</button>:<button className="fm-start" disabled={!chosen} onClick={start}>Start focus session ▶</button>}<p role="status">{message}</p><p className="fm-note">Focus time counts toward your practice log. Short bursts do not mark a whole bar as covered.</p>
 </aside></div></dialog>;
}
