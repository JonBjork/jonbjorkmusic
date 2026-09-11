import {catalog} from '../../routines/catalog';
import {dayKey} from './storage';
export function progressSessions(sessions){
 return sessions.filter(s=>s&&Number.isFinite(Number(s.seconds))&&Number(s.seconds)>0&&Number.isFinite(new Date(s.startedAt).getTime())).map(s=>{
 const id=s.workoutId?.startsWith('room-classic-day-')?'room-classic-sequence':s.workoutId||'picking';
 const workout=catalog.find(w=>w.id===id);
 return {...s,seconds:Number(s.seconds),id,day:dayKey(new Date(s.startedAt)),title:workout?.title||s.workoutTitle||'Workout',category:workout?.category||'Other',cover:workout?.cover};
 }).sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
}
export function summarize(sessions){return {seconds:sessions.reduce((sum,s)=>sum+s.seconds,0),days:new Set(sessions.map(s=>s.day)).size,sessions:sessions.length};}
