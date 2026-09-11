import React, {useState} from 'react';
import {getRating,RATINGS,describeRating} from './barRatings';
import './live-bar-rating.css';

// Holds and rests stay in their source bar. The incidental landing note does
// not change the assessment target to a bar outside the practiced chunk.
export function practiceBars(notes) {
  return [...new Set(notes.filter(n=>n.bar && !n.landing).map(n=>n.bar))];
}
export function activePracticeBar(notes,cursor) {
  let bar=practiceBars(notes)[0];
  for(let i=0;i<=cursor && i<notes.length;i++) {
    if(notes[i].bar && !notes[i].landing)bar=notes[i].bar;
  }
  return bar;
}
export default function LiveBarRating({notes,cursor,workoutId,bpm,notesPerBeat,assessment}) {
  const [selected,setSelected]=useState('follow');
  const bars=practiceBars(notes);
  const current=activePracticeBar(notes,cursor);
  const following=selected==='follow' || !bars.includes(Number(selected));
  const target=following?current:Number(selected);
  if(!target)return null;
  const rating=getRating(assessment.ratings,workoutId,target,bpm,notesPerBeat);
  return <section className="wk-live-rating" aria-label="Mark a bar while practicing">
    <div className="wk-live-rating-row">
      <label>Mark bar
        <select aria-label="Bar to mark" value={following?'follow':selected} onChange={e=>setSelected(e.target.value)}>
          <option value="follow">Following bar {current}</option>
          {bars.map(b=><option key={b} value={String(b)}>Bar {b}</option>)}
        </select>
      </label>
      <div className="wk-live-rating-options">{RATINGS.map(r=><button key={r.id}
        className={`wk-live-${r.id}`} aria-label={`Mark bar ${target}: ${r.label}`}
        aria-pressed={rating?.rating===r.id} onClick={()=>assessment.mark([target],r.id,bpm,notesPerBeat)}>
        <span aria-hidden="true">{r.symbol}</span> {r.label}
      </button>)}</div>
      {!following && <button className="wk-live-follow" onClick={()=>setSelected('follow')}>Follow playback</button>}
    </div>
    <div className="wk-live-rating-meta">
      <span>Bar {target} · {describeRating(rating)}</span>
      {rating && <button onClick={()=>assessment.mark([target],null,bpm,notesPerBeat)}>Clear</button>}
      <span role="status">{assessment.notice}</span>
      {assessment.canUndo && <button onClick={assessment.undoMark}>Undo</button>}
    </div>
  </section>;
}
