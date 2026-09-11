import React,{useState} from 'react';
import {RATINGS,getRating,normalizeRatings} from './barRatings';
import {buildPieceChunks} from './routines';
import TabView from './TabView';
import FocusMode from './FocusMode';
import './rated-bars.css';

export function ratedBarsFor(workout,ratings,colour,bpm,notesPerBeat) {
  return Array.from({length:workout.piece.bars.length},(_,i)=>i+1)
    .filter(bar=>getRating(ratings,workout.id,bar,bpm,notesPerBeat)?.rating===colour)
    .map(bar=>({bar,...getRating(ratings,workout.id,bar,bpm,notesPerBeat)}));
}
export default function RatedBars({workout,ratings,tone,instrumentVolume,metronomeVolume,onFocusClose,bpm=60,notesPerBeat=4}) {
  const [context,setContext]=useState(`${bpm}:${notesPerBeat}`);
  const [ratingBpm,ratingSubdivision]=context.split(':').map(Number);
  const contexts=[...new Set([`${bpm}:${notesPerBeat}`,context,...Object.entries(normalizeRatings(ratings))
    .filter(([key])=>key.startsWith(`${workout.id}:`))
    .map(([,r])=>`${r.bpm}:${r.notesPerBeat}`)])].sort((a,b)=>{
      const [ab,an]=a.split(':').map(Number),[bb,bn]=b.split(':').map(Number);return ab-bb || an-bn;
    });
  const [colour,setColour]=useState('red');
  const [selected,setSelected]=useState(null);
  const [focusBar,setFocusBar]=useState(null);
  const rows=ratedBarsFor(workout,ratings,colour,ratingBpm,ratingSubdivision);
  const chosen=rows.find(r=>r.bar===selected);
  const preview=chosen?buildPieceChunks(workout.piece,{startBar:chosen.bar,endBar:chosen.bar,chunkSize:1})[0]:null;
  const label=RATINGS.find(r=>r.id===colour).label;
  return <section className="wk-rated-bars" aria-labelledby="rated-bars-title">
    <h2 id="rated-bars-title">Your marked bars</h2>
    <p>Choose a colour, then a bar to preview or work on in Focus Mode.</p>
    <label className="wk-rated-tempo">Ratings at
      <select aria-label="Rating tempo and subdivision" value={context} onChange={e=>{setContext(e.target.value);setSelected(null);}}>
        {contexts.map(value=><option key={value} value={value}>{value.split(':')[0]} BPM · {value.split(':')[1]} notes per beat</option>)}
      </select>
    </label>
    <p>Each tempo and subdivision keeps its own marks.</p>
    <div className="wk-rated-filters" aria-label="Filter marked bars">{RATINGS.map(r=>{
      const count=ratedBarsFor(workout,ratings,r.id,ratingBpm,ratingSubdivision).length;
      return <button key={r.id} className={`wk-rated-${r.id}`} aria-pressed={colour===r.id}
        aria-label={`${r.label}: ${count} ${count===1?'bar':'bars'}`} onClick={()=>{setColour(r.id);setSelected(null);}}>
        <span aria-hidden="true">{r.symbol}</span> {r.label} <b>{count}</b>
      </button>;
    })}</div>
    {!rows.length?<p className="wk-rated-empty">No bars marked “{label}” at {ratingBpm} BPM · {ratingSubdivision} notes per beat yet. Mark bars while practicing or from the practice workspace.</p>:
    <div className="wk-rated-layout"><ul className="wk-rated-list" aria-label={`${label} bars`}>
      {rows.map(row=><li key={row.bar}><button className={`wk-rated-${colour}`} aria-pressed={selected===row.bar}
        aria-label={`Preview bar ${row.bar}`} onClick={()=>setSelected(row.bar)}>
        <strong>Bar {row.bar}</strong><span>{row.bpm} BPM · {row.notesPerBeat} notes per beat</span><span aria-hidden="true">→</span>
      </button></li>)}
    </ul>
    <div className="wk-rated-preview">{chosen?<>
      <h3>Bar {chosen.bar}</h3><p>{label} · marked at {chosen.bpm} BPM, {chosen.notesPerBeat} notes per beat</p>
      <TabView notes={preview.notes} cursor={-1} tuning={workout.piece.tuning} resolution={workout.piece.ticksPerSixteenth||1} notesPerBeat={chosen.notesPerBeat}/>
      <p>{chosen.bar<workout.piece.bars.length?`Includes the landing note from bar ${chosen.bar+1}.`:'Final bar of the piece.'}</p>
      <button className="wk-rated-focus" onClick={()=>setFocusBar(chosen.bar)}>Open Focus Mode for bar {chosen.bar} ↗</button>
    </>:<p className="wk-rated-empty">Select a bar to see its tab.</p>}</div></div>}
    {focusBar!==null && <FocusMode workout={workout} startBar={focusBar} endBar={focusBar}
      tone={tone} instrumentVolume={instrumentVolume} metronomeVolume={metronomeVolume}
      onClose={()=>{setFocusBar(null);onFocusClose?.();}}/>}
  </section>;
}
