import React from 'react';
import { getRating, RATINGS } from './barRatings';
export default function RatingControl({bars,bpm,notesPerBeat,onMark,ratings,workoutId,notice,canUndo,onUndo,afterSession=false}) {
  if(!bars.length)return null;
  const all=bars.map(b=>getRating(ratings,workoutId,b,bpm,notesPerBeat));
  const same=all.every(r=>r && r.rating===all[0]?.rating && r.bpm===all[0]?.bpm && r.notesPerBeat===all[0]?.notesPerBeat);
  const scope=bars.length===1?`Bar ${bars[0]}`:`${bars.length} bars`;
  return <div className="cp-rating-panel">
    <div className="cp-rating-heading">{afterSession?'How did that section feel?':'Mark your selected section'}</div>
    <p>{scope} · {bpm} BPM · {notesPerBeat} notes per beat{afterSession?' · optional':''}</p>
    <div className="cp-rating-options">{RATINGS.map(r=><button key={r.id} className={`cp-rate-${r.id}`} onClick={()=>onMark(bars,r.id,bpm,notesPerBeat)}><span aria-hidden="true">{r.symbol}</span>{r.label}</button>)}</div>
    <div className="cp-rating-footer"><span>{same ? `Marked at ${all[0].bpm} BPM · ${all[0].notesPerBeat} notes per beat` : all.some(Boolean)?'Mixed or partly unmarked — individual ratings kept.':'Your assessment, not an automatic score.'}</span><button onClick={()=>onMark(bars,null,bpm,notesPerBeat)}>Clear marks</button></div>
    <div className="cp-rating-notice" role="status">{notice}{canUndo && <button onClick={onUndo}>Undo</button>}</div>
  </div>;
}
