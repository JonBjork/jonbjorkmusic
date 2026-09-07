import {singleStringScore} from './single-string-score.js';
import {twoStringScore} from './two-string-score.js';
import {majorShapes,shapePassage,MAJOR} from './scale-shapes.js';
import {tripletScore} from './triplet-score.js';
export const VERSION=1;
export const defaultSettings={hammersBpm:50,pickingBpm:60,deepBpm:80,plantingBpm:50,strategy:'positions',firstStroke:'D',tone:'electric',instrumentOn:true,instrumentVolume:65,metronomeOn:true,metronomeVolume:65,subdivisions:false};
export function permutations(a){return a.length===1?[a]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[x,...p]));}
export const hammerFingerings=[[1,2,3],[1,2,4],[1,3,4],[2,3,4]].flatMap(permutations);
export const flip=s=>s==='D'?'U':'D';
export function buildPlan(config,settings,practiceDay=0){
 const blocks=[];let start=0;
 for(const exercise of config.exercises){
  if(exercise.kind==='deepdive'){
   for(const shape of majorShapes(exercise.root,exercise.maxFret))for(const high of [false,true]){
    const notes=shapePassage(shape,high);blocks.push({id:`deepdive-shapes-${shape.fret}-${high?'high':'low'}`,kind:'deepdive',section:'six-string-shapes',title:'Six-string shapes',position:shape.fret,fingering:String(shape.degree),shape,high,notes,start,length:notes.length,sub:1,bpm:settings.deepBpm??80,stroke:'D'});start+=notes.length;
   }
   for(const pair of twoStringScore){
    const tuning={6:40,5:45,4:50,3:55,2:59,1:64};
    const notes=[...pair.ascending,...pair.descending].map((n,i)=>({...n,midi:tuning[n.string]+n.fret,len:1,at:i,stroke:i%2?'U':'D'}));
    const shapes=[];
    for(let i=0;i<notes.length;i+=6){const group=notes.slice(i,i+6).toSorted((a,b)=>b.string-a.string||a.fret-b.fret);shapes.push({rows:[group.slice(0,3),group.slice(3)],root:0,degree:MAJOR.indexOf(group[0].midi%12)+1,fret:group[0].fret});}
    blocks.push({id:`deepdive-two-string-${pair.lowerString}`,kind:'deepdive',section:'two-string-shapes',title:'Two-string shapes',position:pair.lowerString,fingering:String(pair.lowerString),shapes,turnaround:pair.ascending.length,notes,start,length:notes.length,sub:1,bpm:settings.deepBpm??80,stroke:'D'});start+=notes.length;
   }
   for(const line of singleStringScore){
    const open={6:40,5:45,4:50,3:55,2:59,1:64}[line.string],ascending=line.frets.slice(0,-2).flatMap((_,i)=>line.frets.slice(i,i+3));
    const notes=[...ascending,...ascending.toReversed()].map((fret,i)=>({string:line.string,fret,midi:open+fret,len:1,at:i,stroke:i%2?'U':'D'}));
    const shapes=[];for(let i=0;i<notes.length;i+=3){const group=notes.slice(i,i+3).toSorted((a,b)=>a.fret-b.fret);shapes.push({rows:[group],root:0,degree:MAJOR.indexOf(group[0].midi%12)+1,fret:group[0].fret});}
    blocks.push({id:`deepdive-single-string-${line.string}`,kind:'deepdive',section:'single-string',title:'Single String',position:line.string,fingering:String(line.string),groupSize:3,shapes,turnaround:ascending.length,notes,start,length:notes.length,sub:1,bpm:settings.deepBpm??80,stroke:'D'});start+=notes.length;
   }
   // The GP example is base fret 1 across the strings, then base fret 2 back.
   // Continue that half-step zigzag to fret 22 (highest played fret 24), then back.
   const bases=[...Array.from({length:22},(_,i)=>i+1),...Array.from({length:21},(_,i)=>21-i)];
   bases.forEach((base,bi)=>{
    const tuning={6:40,5:45,4:50,3:55,2:59,1:64};
    const pattern=[{string:6,fret:base},{string:5,fret:base+2},{string:4,fret:base},{string:3,fret:base+2},{string:2,fret:base},{string:1,fret:base+2}].map(n=>({...n,midi:tuning[n.string]+n.fret}));
    const high=bi%2===1,notes=(high?pattern.toReversed():pattern).flatMap(n=>[n,n,n]).map((n,i)=>({...n,len:1,at:i,stroke:i%2?'U':'D'}));
    const shape={rows:pattern.map(n=>[n]),fret:base,label:`Fifths · position ${base}`};
    blocks.push({id:`deepdive-planting-${bi}`,kind:'deepdive',section:'picking-hand-focus',title:'Picking Hand Focus',position:base,fingering:String(base),planting:true,high,neckDown:bi>=22,shape,notes,start,length:18,sub:3,bpm:settings.plantingBpm??50,stroke:'D',gateSeconds:0.06});start+=18;
   });
   continue;
  }
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
  if(!e||typeof e.id!=='string'||e.id.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(e.day)||!Number.isFinite(Date.parse(e.day))||!Number.isFinite(e.seconds)||e.seconds<0||e.seconds>86400||!['hammers','picking','deepdive'].includes(e.kind)||!Number.isInteger(e.position)||e.position<1||e.position>24||!Number.isInteger(e.bpm)||e.bpm<20||e.bpm>200||!Number.isInteger(e.notes)||e.notes<0||typeof e.completed!=='boolean'||!/^\d{1,4}$/.test(e.fingering)||!['D','U','H'].includes(e.stroke))throw Error('This backup contains an invalid practice entry.');
 }
 if(data.activeWorkout!==undefined&&!['hammers','picking','deepdive'].includes(data.activeWorkout))throw Error('Unknown routine in backup.');
 if(data.progress!==undefined){if(!data.progress||typeof data.progress!=='object'||Array.isArray(data.progress))throw Error('Invalid routine progress.');for(const [kind,p] of Object.entries(data.progress)){if(!['hammers','picking','deepdive','deepdive:six-string-shapes','deepdive:two-string-shapes','deepdive:single-string','deepdive:picking-hand-focus'].includes(kind)||!p||!Number.isInteger(p.cursor)||p.cursor<0||p.cursor>maxCursor||!Number.isInteger(p.cycle)||p.cycle<1||!Number.isFinite(Date.parse(p.updatedAt)))throw Error('Invalid routine progress.');}}
 if(data.deepSection!==undefined&&!['six-string-shapes','two-string-shapes','single-string','picking-hand-focus'].includes(data.deepSection))throw Error('Unknown Deep Dive section.');
 if(data.soundProfiles!==undefined){if(!data.soundProfiles||typeof data.soundProfiles!=='object'||Object.keys(data.soundProfiles).length>10)throw Error('Invalid sound settings.');for(const p of Object.values(data.soundProfiles)){if(!p||!['electric','nylon','piano','harpsichord'].includes(p.tone)||![p.instrumentVolume,p.metronomeVolume].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('Invalid sound settings.');}}
 if(data.positions!==undefined&&(!data.positions||![3,7,11,15,17].includes(data.positions.hammers)||![1,5,9,13,17].includes(data.positions.picking)))throw Error('Invalid saved position.');
 const result=structuredClone(data);result.settings.deepBpm??=80;result.settings.plantingBpm??=50;if(!Number.isInteger(result.settings.plantingBpm)||result.settings.plantingBpm<20||result.settings.plantingBpm>100)throw Error('Invalid planting tempo.');if(!Number.isInteger(result.settings.deepBpm)||result.settings.deepBpm<20||result.settings.deepBpm>80)throw Error('Choose a six-string shape tempo from 20 to 80 BPM.');return result;
}
export function mergeState(current,incoming){
 const events=new Map(current.events.map(e=>[e.id,e]));
 for(const e of incoming.events){const old=events.get(e.id);if(!old||e.seconds>old.seconds||e.notes>old.notes||e.completed&&!old.completed)events.set(e.id,e);}
 const latest=Date.parse(incoming.checkpoint.updatedAt)>Date.parse(current.checkpoint.updatedAt)?incoming:current;
 const progress={...current.progress};for(const [kind,p] of Object.entries(incoming.progress||{})){if(!progress[kind]||Date.parse(p.updatedAt)>Date.parse(progress[kind].updatedAt))progress[kind]=p;}
 return {...latest,progress,events:[...events.values()].sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id))};
}
