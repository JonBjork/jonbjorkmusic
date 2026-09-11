import fiveSource from '../../routines/sweep-five-source.json';
import source from '../../routines/sweep-source.json';
export const SWEEP_SECTIONS=[
 {start:0,end:8,title:'High-note loops'}, {start:8,end:12,title:'Paired Am / E loops'},
 {start:12,end:20,title:'Low-note loops'}, {start:20,end:24,title:'Paired low-note loops'},
 {start:24,end:32,title:'Descending groups of four'}, {start:32,end:40,title:'Ascending groups of four'},
 {start:40,end:44,title:'Am descending / E ascending'}, {start:44,end:48,title:'Am ascending / E descending'},
 {start:48,end:52,title:'Connecting A minor shapes'}, {start:52,end:56,title:'Connecting E major shapes'},
];
export const sweepKeyLabel=key=>`${['A','B♭','B','C','C♯','D','E♭','E','F','F♯','G','G♯'][key]} minor / ${['E','F','F♯','G','G♯','A','B♭','B','C','C♯','D','E♭'][key]} major`;
export const FIVE_SWEEP_SECTIONS=[
 {start:0,end:3,title:'Minor shapes'}, {start:3,end:6,title:'Major shapes'},
 {start:6,end:9,title:'Pairings · change at the top'}, {start:9,end:12,title:'Pairings · change at the bottom'},
 {start:12,end:14,title:'All shapes · up and back'},
];
const tuning=[64,59,55,50,45,40];
const inversions=['Root position','First inversion','Second inversion'];
function shapeFor(bar,key,five){
 const unique=[...new Map(bar.map(n=>[`${n.string}:${n.fret}`,n])).values()];
 const pitches=unique.map(n=>tuning[n.string-1]+n.fret);
 const offset=five?5:0;
 const minor=pitches.every(p=>[9,0,4].includes((p-offset+12)%12));
 const degrees=(minor?[9,0,4]:[4,8,11]).map(p=>(p+offset)%12);
 let shift=key>6?key-12:key;
 while(Math.min(...unique.map(n=>n.fret))+shift<1)shift+=12;
 while(Math.max(...unique.map(n=>n.fret))+shift>24)shift-=12;
 const names=sweepKeyLabel((key+offset)%12).split(' / ');
 return {shift,root:(degrees[0]+key)%12,notes:unique.map(n=>({...n,fret:n.fret+shift,midi:[tuning[n.string-1]+n.fret+shift]})),label:`${names[minor?0:1]} · ${inversions[degrees.indexOf(Math.min(...pitches)%12)]}`};
}
export function buildSweep({bpm=80,subdivision=2,key=0,five=false}={}){
 const sections=five?FIVE_SWEEP_SECTIONS:SWEEP_SECTIONS;
 const passages=(five?fiveSource:source).map((exercise,sequence)=>{
  const shapes=exercise.bars.map(bar=>shapeFor(exercise.notes.filter(n=>n.bar===bar),key,five));
  const cycle=exercise.notes.map(n=>{
   const shape=exercise.bars.indexOf(n.bar),fret=n.fret+shapes[shape].shift;
   // GP bar IDs identify source shapes, not a bar line on every note.
   return {string:n.string,fret,stroke:n.stroke,legato:n.legato,midi:[tuning[n.string-1]+fret],shape,len:1};
  });
  // Exactly one minute, independent of tempo or subdivision. The final note may be shorter.
  const duration=five?(sequence<12?240:300):60;
  const ticks=bpm*subdivision*duration/60;
  const notes=Array.from({length:Math.ceil(ticks)},(_,i)=>({...cycle[i%cycle.length],len:Math.min(1,ticks-i)}));
  return {duration,sequence,position:0,notes,shapes,section:sections.find(s=>sequence>=s.start&&sequence<s.end).title};
 });
 return {pairs:[],passages};
}
