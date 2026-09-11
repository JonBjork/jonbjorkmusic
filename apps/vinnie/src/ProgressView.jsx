import React from 'react';
import {EXERCISES} from './chromaticData';
import {completedDays,completedExercise,dateKey,emptyRow} from './tracking';
const milestones=[[7,'your first week'],[14,'two weeks'],[21,'three weeks'],[30,'30 days of practice']];
export default function ProgressView({state,onOpen}){
 const days=completedDays(state),row=state.days[dateKey()]||emptyRow();
 const done=EXERCISES.filter((_,i)=>completedExercise(row,i)).length;
 const next=EXERCISES.findIndex((_,i)=>!completedExercise(row,i));
 const milestone=milestones.find(([n])=>days.length<n);
 const sections=[...new Set(EXERCISES.map(e=>e.section))];
 return <main className="vinnie-tracker vinnie-progress-page">
 <p className="vinnie-progress-eyebrow">Your practice, adding up</p><h1>Your 30-day progress</h1>
 <section className="vinnie-today" aria-labelledby="today-title"><div><h2 id="today-title">{done===EXERCISES.length?'Today’s workout is complete.':'Keep your practice moving.'}</h2><p>Today: <strong>{done} of {EXERCISES.length}</strong> exercises complete</p><progress aria-label="Today’s completed exercises" value={done} max={EXERCISES.length}/><p className="vinnie-muted">Complete all twelve to mark a day. Miss a day? Your progress stays here.</p></div><button className="vinnie-continue" onClick={()=>onOpen(next<0?0:next)}>{next<0?'Practice again':row.some(g=>g.length)?'Continue practicing':'Start practicing'} <span aria-hidden="true">→</span></button></section>
 <section aria-labelledby="calendar-title"><div className="vinnie-calendar-heading"><h2 id="calendar-title">{Math.min(30,days.length)} of 30 days complete</h2><p className="vinnie-next-milestone">{milestone?`${milestone[0]-days.length} more completed ${milestone[0]-days.length===1?'day':'days'} to ${milestone[1]}.`:'✓ 30 days of practice. Keep it going!'}</p></div><div className="vinnie-days">{Array.from({length:30},(_,i)=><div key={i} className={i<days.length?'complete':''}><strong>Day {i+1} {i<days.length?'✓':''}</strong><small>{days[i]||'Not completed yet'}</small></div>)}</div></section>
 <section className="vinnie-progress-exercises" aria-labelledby="exercises-title"><h2 id="exercises-title">Today’s exercises</h2><p className="vinnie-muted">Choose an exercise to pick up where you left off.</p>{sections.map(section=><section className="vinnie-progress-group" key={section}><h3>{section}</h3><div className="vinnie-progress-cards">{EXERCISES.map((e,i)=>{if(e.section!==section)return null;const complete=completedExercise(row,i),started=row[i].length>0;return <button key={e.id} className={`vinnie-progress-card${complete?' is-complete':started?' is-started':''}`} onClick={()=>onOpen(i)} aria-label={`Open exercise ${i+1}: ${e.title}`}><span className="vinnie-card-top"><span>Exercise {i+1}</span><span className="vinnie-card-status">{complete?'✓ Complete':started?'In progress':'Not started'}</span></span><strong>{e.pattern.length?e.pattern.join('–'):e.title}</strong><span className="vinnie-card-action">{complete?'Practice again':started?'Resume':'Open exercise'} <span aria-hidden="true">→</span></span></button>;})}</div></section>)}</section>
 <details className="vinnie-practice-history"><summary>Practice history</summary>{Object.keys(state.days).length?Object.entries(state.days).sort(([a],[b])=>b.localeCompare(a)).map(([day,r])=><p key={day}>{day} · {r.filter((_,i)=>completedExercise(r,i)).length} of 12 exercises complete</p>):<p>Your practice history will appear here as you work through the exercises.</p>}</details>
 </main>;
}
