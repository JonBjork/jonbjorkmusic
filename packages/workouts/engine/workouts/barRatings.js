import { useState } from 'react';
export const RATINGS = [
  { id:'red', label:'Needs work', symbol:'!' },
  { id:'yellow', label:'Getting there', symbol:'~' },
  { id:'green', label:'Comfortable', symbol:'✓' },
];
const KEY='workouts.barRatings.v1';
export const ratingKey=(workoutId,bar,bpm,notesPerBeat)=>`${workoutId}:${bar}:${bpm}:${notesPerBeat}`;
export function getRating(ratings,workoutId,bar,bpm,notesPerBeat) {
  const exact=ratings[ratingKey(workoutId,bar,bpm,notesPerBeat)];
  const legacy=ratings[`${workoutId}:${bar}`];
  return exact || (legacy?.bpm===bpm && legacy?.notesPerBeat===notesPerBeat?legacy:undefined);
}
export function normalizeRatings(data) {
  if(!data || typeof data!=='object' || Array.isArray(data))return {};
  const clean={};
  for(const [key,r] of Object.entries(data)) {
    if(!r || !RATINGS.some(v=>v.id===r.rating) || !Number.isFinite(r.bpm) || !Number.isFinite(r.notesPerBeat))continue;
    const parts=key.split(':');
    if(parts.length!==2 && parts.length!==4)continue;
    const [id,bar]=parts;
    if(!Number.isInteger(Number(bar)) || Number(bar)<1)continue;
    const target=ratingKey(id,Number(bar),r.bpm,r.notesPerBeat);
    if(!clean[target] || (r.updatedAt||'')>=(clean[target].updatedAt||''))clean[target]=r;
  }
  return clean;
}
export function readRatings() {
  try {return normalizeRatings(JSON.parse(localStorage.getItem(KEY)||'{}'));}
  catch(e){return {};}
}
export function applyRating(ratings,workoutId,bars,rating,bpm,notesPerBeat) {
  const next=normalizeRatings(ratings);
  for(const bar of bars) {
    if(!Number.isInteger(bar)||bar<1)continue;
    const key=ratingKey(workoutId,bar,bpm,notesPerBeat);
    if(rating===null)delete next[key];
    else if(RATINGS.some(r=>r.id===rating))next[key]={rating,bpm,notesPerBeat,updatedAt:new Date().toISOString()};
  }
  return next;
}
export function useBarRatings(workoutId) {
  const [ratings,setRatings]=useState(readRatings);
  const [undo,setUndo]=useState(null);
  const [notice,setNotice]=useState('');
  const save=(next)=>{try{localStorage.setItem(KEY,JSON.stringify(next));setRatings(next);return true;}catch(e){setNotice('Could not save on this device. Please try again.');return false;}};
  const mark=(bars,rating,bpm,notesPerBeat)=>{
    const next=applyRating(ratings,workoutId,bars,rating,bpm,notesPerBeat);
    if(save(next)){setUndo(ratings);setNotice(rating===null?`Assessment cleared at ${bpm} BPM · ${notesPerBeat} notes per beat.`:`${bars.length===1?`Bar ${bars[0]}`:'Section'} marked “${RATINGS.find(r=>r.id===rating).label}” at ${bpm} BPM.`);}
  };
  const undoMark=()=>{if(undo&&save(undo)){setUndo(null);setNotice('Previous markings restored.');}};
  return {ratings,mark,notice,undoMark,canUndo:!!undo};
}
export function describeRating(r) {
  if(!r)return 'Not assessed';
  return `${RATINGS.find(v=>v.id===r.rating)?.label || 'Not assessed'} at ${r.bpm} BPM, ${r.notesPerBeat} notes per beat`;
}
