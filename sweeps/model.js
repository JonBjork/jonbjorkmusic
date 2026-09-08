import {patterns} from './patterns.js';
export const names=['Five-string sweep','Three-string sweep','Ascending sweep','Descending sweep'];
export const positions=[...Array.from({length:17},(_,i)=>i+1),...Array.from({length:16},(_,i)=>16-i)];
export const exercises=patterns.map((pattern,id)=>({id,name:names[id],pattern,positionLength:pattern.length*2,notes:positions.flatMap((position,visit)=>[0,1].flatMap(rep=>pattern.map((n,index)=>({...n,fret:n.fret+position-1,midi:n.midi+position-1,position,visit,rep,index}))))}));
export const storageKey='jb-sweeps-v1';
export const dateKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const clock=seconds=>{const s=Math.ceil(Math.max(0,seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
export const fresh=()=>({version:1,app:'jb-sweeps',days:{},settings:{bpm:60,tone:'piano',instrument:true,metronome:true,subdivisions:false,instrumentVolume:100,metronomeVolume:70}});
export function validate(raw){
 if(!raw||raw.version!==1||raw.app!=='jb-sweeps'||!raw.days||typeof raw.days!=='object'||Array.isArray(raw.days))throw Error('Choose a Sweeps progress backup.');
 const state=fresh(),entries=Object.entries(raw.days);if(entries.length>5000)throw Error('Backup has too many days.');
 for(const [date,progress] of entries){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||!Array.isArray(progress)||progress.length!==4)throw Error('Invalid progress in backup.');
  if(progress.some((n,i)=>!Number.isInteger(n)||n<0||n>exercises[i].notes.length||n%exercises[i].positionLength!==0))throw Error('Invalid exercise progress.');
  state.days[date]=[...progress];
 }
 const s=raw.settings||{};
 for(const k of ['bpm','instrumentVolume','metronomeVolume'])if(s[k]!==undefined){const low=k==='bpm'?40:0,high=k==='bpm'?160:100;if(!Number.isFinite(s[k])||s[k]<low||s[k]>high)throw Error('Invalid sound or tempo setting.');state.settings[k]=s[k];}
 if(s.tone!==undefined){if(!['piano','harpsichord','electric','nylon'].includes(s.tone))throw Error('Unknown instrument.');state.settings.tone=s.tone;}
 for(const k of ['instrument','metronome','subdivisions'])if(s[k]!==undefined){if(typeof s[k]!=='boolean')throw Error('Invalid sound setting.');state.settings[k]=s[k];}
 return state;
}
export function merge(a,b){const next=validate(a),incoming=validate(b);for(const [day,progress] of Object.entries(incoming.days))next.days[day]=progress.map((n,i)=>Math.max(n,next.days[day]?.[i]||0));return next;}
export const completedDays=state=>Object.entries(state.days).filter(([,p])=>p.every((n,i)=>n===exercises[i].notes.length)).map(([d])=>d).sort();
export function checkpoint(cursor,exercise){return Math.min(exercise.notes.length,Math.floor(cursor/exercise.positionLength)*exercise.positionLength);}
