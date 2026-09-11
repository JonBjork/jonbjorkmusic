import MetronomeSubdivisions from './MetronomeSubdivisions';
import React, { useEffect, useRef, useState } from 'react';
import { prepareGuitar, pluck, stopGuitar } from './guitarSynth';
import { primeMetronomeAudio, getAudioContext } from '../shared/metronome';
import { PAUSE_OPTIONS, estimatePieceSeconds } from './timing';
import VolumeControls from './VolumeControls';
import RatingControl from './RatingControl';
import { getRating, describeRating, RATINGS } from './barRatings';
import TabView from './TabView';
import FocusMode from './FocusMode';

export function Choices({ label, value, options, onChange }) {
  return <div className="cp-field"><span className="cp-label">{label}</span><div className="cp-choices">{options.map(([v, text]) => <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}</div></div>;
}
export function NumberField({ label, value, min, max, onChange, deliberate = false }) {
  const [draft,setDraft] = useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const commit=()=>{const n=Math.max(min,Math.min(max,Math.round(Number(draft))||min));setDraft(String(n));onChange(n);};
  const lastStep=useRef(0);
  const step=(direction)=>{const now=performance.now();if(now-lastStep.current<250)return;lastStep.current=now;const n=Math.max(min,Math.min(max,value+direction));setDraft(String(n));onChange(n);};
  return <div className={deliberate ? "cp-deliberate-number" : ""}><label className="cp-number"><span>{label}</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={draft} onChange={e=>{if(/^\d*$/.test(e.target.value))setDraft(e.target.value);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} /></label>{deliberate && <div className="cp-step-buttons"><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value<=min} onKeyDown={e=>{if(e.repeat)e.preventDefault();}} onClick={()=>step(-1)}>−</button><button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value>=max} onKeyDown={e=>{if(e.repeat)e.preventDefault();}} onClick={()=>step(1)}>+</button></div>}</div>;

}
export default function PieceSetup(p) {
  const { workout, startBar, setStartBar, endBar, setEndBar, chunkSize, setChunkSize, bpm, setBpm, notesPerBeat, setNotesPerBeat, loopMode, setLoopMode, loopReps, setLoopReps, loopMin, setLoopMin, sound, setSound, clickOn, setClickOn, clickEvery, setClickEvery, countInChoice, setCountInChoice, countInSubdiv, setCountInSubdiv, pauseSeconds, setPauseSeconds, tone, setTone, instrumentVolume, metronomeVolume, setInstrumentVolume, setMetronomeVolume, exercises, sessions, assessment, onStart, onProgress, onBack } = p;
  const [focusOpen,setFocusOpen]=useState(false);
  const [markOpen,setMarkOpen] = useState(false);

  const [audioBusy,setAudioBusy] = useState(false);
  const [auditioning,setAuditioning] = useState(false);
  const [audioError,setAudioError] = useState('');
  const previewTimer=useRef(null);
  const alive=useRef(true);
  const handedOff=useRef(false);
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;clearTimeout(previewTimer.current);if(!handedOff.current)stopGuitar();};},[]);
  const stopPreview=()=>{clearTimeout(previewTimer.current);stopGuitar();setAuditioning(false);};
  const selectTone=(v)=>{stopPreview();setTone(v);};
  const withAudio=async (preview)=>{
    stopPreview();setAudioBusy(true);setAudioError('');
    try {
      await primeMetronomeAudio();
      const ctx=getAudioContext();
      await prepareGuitar(ctx,tone);
      if(!alive.current) return;
      if(preview) {
        const notes=exercises[0].notes.slice(0,32*(workout.piece.ticksPerSixteenth||1)), beatSeconds=60/bpm/(notesPerBeat*(workout.piece.ticksPerSixteenth||1));
        notes.forEach((n,i)=>{if(n.midi)n.midi.forEach(m=>pluck(ctx,m,ctx.currentTime+0.08+i*beatSeconds,(n.len||1)*beatSeconds,0.5));});
        setAuditioning(true);
        previewTimer.current=setTimeout(()=>setAuditioning(false), (notes.length*beatSeconds+0.3)*1000);
      } else {handedOff.current=true;await onStart();}
    } catch(e) {if(alive.current)setAudioError('Instrument could not load. Try again or choose Original synth.');}
    finally {if(alive.current)setAudioBusy(false);}
  };
  const [rangeTarget,setRangeTarget] = useState('start');
  const chooseStart=(b)=>{stopPreview();setStartBar(b);if(b>endBar)setEndBar(b);};
  const chooseEnd=(b)=>{stopPreview();setEndBar(b);if(b<startBar)setStartBar(b);};
  const chooseBar=(b)=>{if(rangeTarget==='start'){chooseStart(b);setRangeTarget('end');}else{chooseEnd(b);setRangeTarget('start');}};
  const resolution = workout.piece.ticksPerSixteenth || 1;
  const total = workout.piece.bars.length;
  const chunk = exercises[0];
  const covered = new Set();
  sessions.forEach(s => { if(s.barsDone) for(let b=s.barsDone[0];b<=s.barsDone[1];b++) covered.add(b); });
  const countInBeats = countInChoice===2 ? 2 : workout.beatsPerBar;
  const seconds = estimatePieceSeconds({exercises,bpm,notesPerBeat:notesPerBeat*resolution,countInBeats,pauseSeconds,loopMode,loopReps,loopMin});
  const apply = (name, size, reps) => {setChunkSize(size); setLoopMode('reps'); setLoopReps(reps);};
  return <main className="cp">
    {focusOpen && <FocusMode {...{workout,startBar,endBar,tone,instrumentVolume,metronomeVolume}} onClose={()=>setFocusOpen(false)}/>}
    <nav className="cp-breadcrumb"><button onClick={onBack}>← All workouts</button><span>/</span><span>REPERTOIRE</span></nav>
    <section className="cp-hero">
      <div><div className="cp-eyebrow">ALTERNATE PICKING INTENSIVE</div><h1>{workout.heading} {workout.headingAccent && <span>{workout.headingAccent}</span>}</h1><p>{workout.tagline}</p><div className="cp-meta"><span>{workout.keyLabel}</span><span>{workout.timeSignature} TIME</span><span>{total} BARS</span><span>MY ARRANGEMENT</span></div></div>
      <img src={workout.cover} alt={`${workout.title} — Alternate Picking Intensive cover`} />
    </section>
    <div className="cp-tabs"><button className="active">Practice workspace</button><button onClick={onProgress}>Your progress <span>↗</span></button><span className="cp-saved">Settings remembered on this device</span></div>
    <div className="cp-layout"><div className="cp-main">
      <section className="cp-card cp-plan"><div className="cp-section-head"><h2><span>01</span> FIND YOUR FOCUS</h2><span>Start small. Build the connection.</span></div>
        <div className="cp-presets">{[['isolate','Isolate',1,4,'One bar. Four deliberate passes.'],['connect','Connect',2,3,'Two bars. Find the transition.'],['flow','Build flow',4,2,'Four bars. Keep the line moving.']].map(([id,title,size,reps,copy]) => <button key={id} aria-pressed={chunkSize===size && loopReps===reps && loopMode==='reps'} onClick={() => apply(id,size,reps)}><b>{title}<span>↗</span></b><small>{copy}</small></button>)}</div>
        <div className="cp-scope"><div className="cp-scope-title"><span className="cp-label">YOUR PRACTICE SECTION</span><button onClick={()=>{stopPreview();setStartBar(1);setEndBar(total);setRangeTarget('start');}}>Whole piece</button></div><div className="cp-scope-fields"><NumberField label="From bar" value={startBar} min={1} max={total} onChange={chooseStart}/><span>→</span><NumberField label="To bar" value={endBar} min={1} max={total} onChange={chooseEnd}/><span className="cp-scope-count">{endBar-startBar+1} bars selected</span></div></div>
        <div className="cp-map-title"><div className="cp-range-target"><button aria-pressed={rangeTarget==='start'} onClick={()=>setRangeTarget('start')}>Set start</button><button aria-pressed={rangeTarget==='end'} onClick={()=>setRangeTarget('end')}>Set end</button></div><span><i className="scope" /> Section <i /> First chunk</span></div>
        <div className="cp-bar-map">{Array.from({length:total},(_,i) => i+1).map(b => <button key={b} title={`Bar ${b}: ${describeRating(getRating(assessment.ratings,workout.id,b,bpm,notesPerBeat))}`} aria-label={`Set ${rangeTarget} at bar ${b}. ${describeRating(getRating(assessment.ratings,workout.id,b,bpm,notesPerBeat))}`} aria-pressed={b>=startBar && b<=endBar} className={`${b>=startBar && b<=endBar ? 'in-scope' : ''} ${b===startBar || b===endBar ? 'range-edge' : ''} ${b>=startBar && b<=chunk.barTo ? 'selected' : ''} ${getRating(assessment.ratings,workout.id,b,bpm,notesPerBeat) ? 'rated rate-'+getRating(assessment.ratings,workout.id,b,bpm,notesPerBeat).rating : ''}`} onClick={() => chooseBar(b)}>{String(b).padStart(2,'0')}{getRating(assessment.ratings,workout.id,b,bpm,notesPerBeat) && <span className="cp-rating-mark" aria-hidden="true">{RATINGS.find(r=>r.id===getRating(assessment.ratings,workout.id,b,bpm,notesPerBeat).rating).symbol}</span>}</button>)}</div>
        <div className="cp-mark-row"><span>Confidence at {bpm} BPM · {notesPerBeat} notes per beat</span><button aria-expanded={markOpen} onClick={()=>setMarkOpen(v=>!v)}>{markOpen?'Close assessment':'Mark section'} <span aria-hidden="true">{markOpen?'−':'+'}</span></button></div>
        {markOpen && <RatingControl bars={Array.from({length:endBar-startBar+1},(_,i)=>startBar+i)} bpm={bpm} notesPerBeat={notesPerBeat} onMark={assessment.mark} ratings={assessment.ratings} workoutId={workout.id} notice={assessment.notice} canUndo={assessment.canUndo} onUndo={assessment.undoMark}/>}
        <div className="cp-focus-launch"><button onClick={()=>{stopPreview();setFocusOpen(true);}}>Open Focus Mode ↗</button><span>Beat to Beat · Rhythm Variations · selected bars {startBar}–{endBar}</span></div>
        <div className="cp-map-footer"><span><b>Bars {startBar}–{endBar}</b> · {exercises.length} chunks</span><NumberField label="Bars per chunk" value={chunkSize} min={1} max={total} onChange={v=>{setChunkSize(v);}} /></div>
      </section>
      <section className="cp-card cp-score"><div className="cp-section-head"><h2><span>02</span> SEE THE PHRASE</h2><span className="cp-purple">{chunk.label} {chunk.barTo<total ? `+ landing note` : ''}</span></div><TabView notes={chunk.notes} cursor={-1} tuning={workout.piece.tuning} resolution={resolution} notesPerBeat={notesPerBeat}/><div className="cp-score-foot"><span><b>⊓</b> Downstroke <span>∨</span> Upstroke</span><span>Swipe or scroll the tab to explore →</span></div>
        <div className="cp-tip"><span>THE CONNECTION MATTERS</span><p>{chunk.barTo<total ? `Land on the first note of bar ${chunk.barTo+1}. Rest for ${pauseSeconds} second${pauseSeconds===1?'':'s'}, then count in again for the next pass. Finish your repeats${chunk.barTo===endBar ? ", then end the session on this landing note" : " before moving on"}.` : `This is the final bar of the piece, so there is no following landing note. Finish your repeats here.`}</p></div>
      </section>
      <div className="cp-principles"><span><b>01 / RELAXED</b> Release unnecessary tension.</span><span><b>02 / ACCURATE</b> Earn the next tempo.</span><span><b>03 / MUSICAL</b> Practice the sound you want.</span></div>
    </div>
    <aside className="cp-card cp-session"><div className="cp-section-head"><h2><span>03</span> SET YOUR PACE</h2></div>
      <label className="cp-label" htmlFor="cp-bpm">PRACTICE TEMPO</label><div className="cp-tempo"><button aria-label="Decrease tempo" onClick={()=>setBpm(Math.max(40,bpm-1))}>−</button><div><input id="cp-bpm" type="number" min="40" max="200" value={bpm} onChange={e=>setBpm(Math.max(40,Math.min(200,Number(e.target.value)||40)))} /><span>BPM</span></div><button aria-label="Increase tempo" onClick={()=>setBpm(Math.min(200,bpm+1))}>+</button></div>
      <input className="cp-slider" aria-label="Practice tempo slider" type="range" min="40" max="200" value={bpm} onChange={e=>setBpm(Number(e.target.value))}/><div className="cp-range"><span>40 · SLOW & CLEAN</span><span>200</span></div>
      <div className="cp-divider"/><Choices label="REPEAT EACH CHUNK" value={loopMode} options={[["off","Once"],["reps","Repetitions"],["timer","Timer"]]} onChange={setLoopMode}/>
      {loopMode==='reps' && <NumberField deliberate label="Repetitions before moving on" value={loopReps} min={1} max={50} onChange={setLoopReps}/>}{loopMode==='timer' && <NumberField label="Minutes per chunk" value={loopMin} min={1} max={60} onChange={setLoopMin}/>}
      <div className="cp-divider"/><div className="cp-tone"><label className="cp-label" htmlFor="guitar-tone">INSTRUMENT</label><select id="guitar-tone" value={tone} disabled={audioBusy} onChange={e=>selectTone(e.target.value)}><option value="electric">Clean electric</option><option value="nylon">Nylon string</option><option value="piano">Grand piano</option><option value="harpsichord">Harpsichord</option><option value="original">Original synth</option></select><button className="cp-audition" disabled={audioBusy} onClick={()=>auditioning ? stopPreview() : withAudio(true)}>{audioBusy ? 'Loading instrument…' : auditioning ? '■ Stop preview' : '▷ Hear this phrase'}</button></div><div className="cp-toggles"><button role="switch" aria-checked={sound} onClick={()=>setSound(!sound)}>Instrument sound <i className={sound?'on':''}/></button><button role="switch" aria-checked={clickOn} onClick={()=>setClickOn(!clickOn)}>Metronome <i className={clickOn?'on':''}/></button></div>
      <VolumeControls {...{instrumentVolume,metronomeVolume,setInstrumentVolume,setMetronomeVolume}}/>
      <details className="cp-advanced"><summary>Timing & count-in <span>＋</span></summary><Choices label="PAUSE BEFORE COUNT-IN" value={pauseSeconds} options={PAUSE_OPTIONS.map(v=>[v,`${v}s`])} onChange={setPauseSeconds}/><p className="cp-pause-help">A fixed pause to reset your hands. The count-in follows your tempo.</p><Choices label="NOTES PER BEAT" value={notesPerBeat} options={Array.from({length:8},(_,i)=>[i+1,String(i+1)])} onChange={setNotesPerBeat}/><MetronomeSubdivisions enabled={clickEvery==='all'} onToggle={on=>setClickEvery(on?'all':'beat')} value={p.clickSubdivision} onChange={p.setClickSubdivision}/><Choices label="COUNT-IN" value={countInChoice} options={[["bar",`${workout.beatsPerBar} beats`],[2,"2 beats"]]} onChange={setCountInChoice}/><Choices label="COUNT-IN SUBDIVISIONS" value={countInSubdiv} options={[[false,"Off"],[true,"On"]]} onChange={setCountInSubdiv}/></details>
      <div className="cp-summary"><div><span>YOUR SESSION</span><b>~{Math.ceil(seconds/60)} min</b></div><p><strong>Bars {startBar}–{endBar}</strong><br/>{exercises.length} chunk{exercises.length===1?'':'s'} · {chunkSize} bar{chunkSize===1?'':'s'} at a time<br/>{notesPerBeat} notes per beat · {loopMode==='reps' ? `${loopReps} passes each` : loopMode==='timer' ? `${loopMin} min each` : 'one pass each'}</p></div>
      <button className="cp-start" disabled={audioBusy} onClick={()=>withAudio(false)}>Start practicing <span>▶</span></button>{audioError && <p role="alert" className="cp-audio-error">{audioError}</p>}<p className="cp-start-caption">{pauseSeconds}s between passes + {countInChoice==='bar'?workout.beatsPerBar:2}-beat count-in</p>
    </aside></div>
    <footer className="cp-footer"><span>JON BJORK MUSIC <b>/</b> PRACTICE LAB</span><span>Small sections. Full attention. Real progress.</span></footer>
  </main>;
}
