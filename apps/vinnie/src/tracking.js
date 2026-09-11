import {EXERCISES,buildChromatic} from './chromaticData';
export const KEY='jb-vinnie-progress-v1';
export const counts=EXERCISES.map(e=>buildChromatic(e).groups.length);
export const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const emptyRow=()=>counts.map(()=>[]);
export const fresh=()=>({app:'jb-vinnie',version:1,days:{}});
export function validate(raw){
 if(!raw||raw.app!=='jb-vinnie'||raw.version!==1||!raw.days||Array.isArray(raw.days)||typeof raw.days!=='object'||Object.keys(raw.days).length>5000)throw Error('Choose a Vinnie workout progress backup.');
 const next=fresh();
 for(const [day,row] of Object.entries(raw.days)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day||!Array.isArray(row)||row.length!==counts.length)throw Error('Invalid daily progress.');
  next.days[day]=row.map((groups,i)=>{if(!Array.isArray(groups)||groups.length>counts[i]||groups.some(g=>!Number.isInteger(g)||g<0||g>=counts[i]))throw Error('Invalid exercise progress.');return [...new Set(groups)].sort((a,b)=>a-b);});
 }
 return next;
}
export function merge(a,b){const next=validate(a);for(const [day,row] of Object.entries(validate(b).days))next.days[day]=row.map((g,i)=>[...new Set([...g,...(next.days[day]?.[i]||[])])].sort((a,b)=>a-b));return next;}
export function read(){const raw=localStorage.getItem(KEY);return raw?validate(JSON.parse(raw)):fresh();}
export function write(state){localStorage.setItem(KEY,JSON.stringify(validate(state)));window.dispatchEvent(new Event('vinnie-progress'));}
export function todayProgress(){try{return read().days[dateKey()]||emptyRow();}catch{return emptyRow();}}
export const completedExercise=(row,i)=>row[i].length===counts[i];
export const completedDays=state=>Object.entries(state.days).filter(([,row])=>counts.every((_,i)=>completedExercise(row,i))).map(([d])=>d).sort();
export function recordGroup(id,group){try{const state=read(),day=dateKey(),i=EXERCISES.findIndex(e=>e.id===id);const row=state.days[day]||emptyRow();if(!row[i].includes(group)){row[i].push(group);state.days[day]=row;write(state);}}catch{window.dispatchEvent(new Event('vinnie-save-error'));}}
