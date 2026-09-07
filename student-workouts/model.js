import {tripletScore} from './triplet-score.js';
export const VERSION=1;
export const defaultSettings={hammersBpm:50,pickingBpm:60,strategy:'positions',firstStroke:'D',tone:'electric',instrumentOn:true,instrumentVolume:65,metronomeOn:true,metronomeVolume:65,subdivisions:false};
export function permutations(a){return a.length===1?[a]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[x,...p]));}
export const hammerFingerings=[[1,2,3],[1,2,4],[1,3,4],[2,3,4]].flatMap(permutations);
export const flip=s=>s==='D'?'U':'D';
export function buildPlan(config,settings,practiceDay=0){
 const blocks=[];let start=0;
 for(const exercise of config.exercises){
  exercise.positions.forEach((position,pi)=>{
   const startingStroke=(practiceDay%2?flip(settings.firstStroke):settings.firstStroke);
   const stroke=settings.strategy==='positions'&&pi%2?flip(startingStroke):startingStroke;
   const source=exercise.kind==='hammers'?hammerFingerings.map(f=>({fingering:f.join(''),notes:[6,5,4,3,2,1,1,2,3,4,5,6].flatMap(string=>f.map(fret=>({string,fret,len:1})))})):tripletScore;
   for(const e of source){
    let noteTick=0;
    const notes=e.notes.map((n,i)=>{const note={...n,fret:n.fret+position-1,stroke:exercise.kind==='hammers'?'H':i%2?flip(stroke):stroke,at:noteTick};noteTick+=n.len;return note;});
    const block={id:`${exercise.kind}-${position}-${e.fingering}`,kind:exercise.kind,title:exercise.title,position,fingering:e.fingering,notes,start,length:noteTick,sub:exercise.kind==='hammers'?2:3,bpm:settings[exercise.kind==='hammers'?'hammersBpm':'pickingBpm'],stroke};
    blocks.push(block);start+=noteTick;
   }
  });
 }
 return {blocks,length:start};
}
export function blockAt(plan,cursor){return plan.blocks.find(b=>cursor>=b.start&&cursor<b.start+b.length)||plan.blocks.at(-1);}
export function noteAt(block,cursor){const tick=cursor-block.start;return block.notes.findLast(n=>n.at<=tick)||block.notes[0];}
export function remaining(plan,cursor){return plan.blocks.reduce((sum,b)=>sum+Math.max(0,b.length-Math.max(0,cursor-b.start))*60/b.bpm/b.sub,0);}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function freshState(student){return {format:'jonbjork-student-workout',version:VERSION,student,settings:{...defaultSettings},checkpoint:{cursor:0,cycle:1,updatedAt:new Date().toISOString()},events:[]};}
export function validateState(data,student,maxCursor){
 if(!data||data.format!=='jonbjork-student-workout'||data.version!==VERSION||data.student!==student||!Array.isArray(data.events)||data.events.length>200000)throw Error('This is not a compatible workout backup for this student.');
 const c=data.checkpoint,s=data.settings;
 if(!c||!Number.isInteger(c.cursor)||c.cursor<0||c.cursor>maxCursor||!Number.isInteger(c.cycle)||c.cycle<1||!Number.isFinite(Date.parse(c.updatedAt)))throw Error('The saved place in this backup is invalid.');
 if(!s||![s.hammersBpm,s.pickingBpm].every(n=>Number.isInteger(n)&&n>=20&&n<=200)||!['positions','days'].includes(s.strategy)||!['D','U'].includes(s.firstStroke)||!['electric','nylon','piano','harpsichord'].includes(s.tone)||![s.instrumentVolume,s.metronomeVolume].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||!['instrumentOn','metronomeOn','subdivisions'].every(k=>typeof s[k]==='boolean'))throw Error('The settings in this backup are invalid.');
 for(const e of data.events){
  if(!e||typeof e.id!=='string'||e.id.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(e.day)||!Number.isFinite(Date.parse(e.day))||!Number.isFinite(e.seconds)||e.seconds<0||e.seconds>86400||!['hammers','picking'].includes(e.kind)||!Number.isInteger(e.position)||e.position<1||e.position>20||!Number.isInteger(e.bpm)||e.bpm<20||e.bpm>200||!Number.isInteger(e.notes)||e.notes<0||typeof e.completed!=='boolean'||!/^\d{2,4}$/.test(e.fingering)||!['D','U','H'].includes(e.stroke))throw Error('This backup contains an invalid practice entry.');
 }
 if(data.activeWorkout!==undefined&&!['hammers','picking','deepdive'].includes(data.activeWorkout))throw Error('Unknown routine in backup.');
 if(data.progress!==undefined){if(!data.progress||typeof data.progress!=='object'||Array.isArray(data.progress))throw Error('Invalid routine progress.');for(const [kind,p] of Object.entries(data.progress)){if(!['hammers','picking'].includes(kind)||!p||!Number.isInteger(p.cursor)||p.cursor<0||p.cursor>maxCursor||!Number.isInteger(p.cycle)||p.cycle<1||!Number.isFinite(Date.parse(p.updatedAt)))throw Error('Invalid routine progress.');}}
 return structuredClone(data);
}
export function mergeState(current,incoming){
 const events=new Map(current.events.map(e=>[e.id,e]));
 for(const e of incoming.events){const old=events.get(e.id);if(!old||e.seconds>old.seconds||e.notes>old.notes||e.completed&&!old.completed)events.set(e.id,e);}
 const latest=Date.parse(incoming.checkpoint.updatedAt)>Date.parse(current.checkpoint.updatedAt)?incoming:current;
 const progress={...current.progress};for(const [kind,p] of Object.entries(incoming.progress||{})){if(!progress[kind]||Date.parse(p.updatedAt)>Date.parse(progress[kind].updatedAt))progress[kind]=p;}
 return {...latest,progress,events:[...events.values()].sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id))};
}
