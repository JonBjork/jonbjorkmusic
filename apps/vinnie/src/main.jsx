import Tuning from '../../../packages/workouts/engine/workouts/Tuning';
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import ChromaticWorkout from './ChromaticWorkout';
import ProgressView from './ProgressView';
import {configureAssets} from '../../../packages/workouts/engine/shared/assets';
import {EXERCISES} from './chromaticData';
import {read,fresh,write,validate,merge,completedDays,completedExercise,dateKey,emptyRow,counts} from './tracking';
import './site.css';
configureAssets('/vinnie');
function App(){
 const [busy,setBusy]=useState(false);
 const [initialExercise,setInitialExercise]=useState(null);
 function openExercise(i){setInitialExercise(i);setView('workout');}
 const [view,setView]=useState('workout'),[version,setVersion]=useState(0),[notice,setNotice]=useState(''),[state,setState]=useState(()=>{try{return read();}catch{return fresh();}});
 useEffect(()=>{const update=()=>{try{setState(read());}catch{setNotice('Saved progress could not be read. Import a backup to recover it.');}},error=()=>setNotice('Progress could not be saved. Check browser storage and export a backup before leaving.');update();window.addEventListener('vinnie-progress',update);window.addEventListener('vinnie-save-error',error);return()=>{window.removeEventListener('vinnie-progress',update);window.removeEventListener('vinnie-save-error',error);};},[]);
 const days=completedDays(state),row=state.days[dateKey()]||emptyRow(),done=row.filter((_,i)=>completedExercise(row,i)).length;
 function download(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`vinnie-progress-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function upload(e){const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('Backup is too large.');const incoming=validate(JSON.parse(await file.text()));write(merge(read(),incoming));setVersion(v=>v+1);setNotice('Progress imported. Existing progress has been kept.');}catch(error){setNotice(error.message);}e.target.value='';}
 return <><nav className="vinnie-nav"><a className="vinnie-logo" href="/" aria-label="Jon Bjork Music"><span className="vinnie-logo-name">Jon Bjork</span><span className="vinnie-logo-divider" aria-hidden="true"/><span className="vinnie-logo-tag">Music</span></a><button onClick={()=>{setInitialExercise(null);setView('workout');}} aria-pressed={view==='workout'}>Workout</button><button onClick={()=>setView('progress')} aria-pressed={view==='progress'}>My progress · {Math.min(30,days.length)} / 30</button><div className="vinnie-tuning">{!busy&&<Tuning/>}</div></nav>
 {view==='workout'?<ChromaticWorkout initialExercise={initialExercise} onBusyChange={setBusy} key={version} onBack={()=>{window.location.href='/';}}/>:<ProgressView state={state} onOpen={openExercise}/>}
 <footer className="vinnie-tracker">{view==='progress'&&<section className="vinnie-backup"><h2>Keep your progress</h2><p>Saved in this browser after each completed position. Export a backup to move devices. Import merges progress without removing completed positions.</p><button onClick={download}>Export JSON</button><label className="vinnie-import">Import JSON<input type="file" accept=".json,application/json" onChange={upload}/></label></section>}<p role="status">{notice}</p><section className="vinnie-room" aria-labelledby="practice-room-title"><a className="vinnie-room-art" href="/practiceroom/?ref=vinnie" aria-label="Explore The Practice Room"><img src="/vinnie/practice-room.jpg" alt="The Practice Room: guitar courses, structured programs and the Practice Lab" loading="lazy" width="1672" height="941"/></a><div className="vinnie-room-copy"><p className="vinnie-room-eyebrow">Keep building your playing</p><h2 id="practice-room-title">Take this further inside The Practice Room.</h2><p>Guided courses, structured programs and the Practice Lab to help you make the most of your practice.</p><p>All current and future courses, plus every update to the Practice Lab app.</p><a className="vinnie-room-button" href="/practiceroom/?ref=vinnie">Explore The Practice Room <span aria-hidden="true">↗</span></a><p className="vinnie-room-payment">One-time payment. Lifetime access. No subscription.</p></div></section><a href="/vinnie/audio/CREDITS.txt">Sound credits</a> · <a href="/legal/">Privacy & terms</a></footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
