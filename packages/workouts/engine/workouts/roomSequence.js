// Standard tuning, low string first. A shape is eighteen consecutive scale
// tones, distributed three per string; neighbouring shapes start one degree apart.
export const ROOM_DAYS=[{day:1,key:'A minor',root:9},{day:2,key:'D minor',root:2},{day:3,key:'G minor',root:7},{day:4,key:'C minor',root:0},{day:5,key:'E minor',root:4}];
export const ROOM_ROUNDS=[{bpm:80,subdivision:3,stroke:'D',label:'Triplets · downstroke'},{bpm:60,subdivision:4,stroke:'D',label:'Sixteenths · downstroke'},{bpm:80,subdivision:3,stroke:'U',label:'Triplets · upstroke'},{bpm:60,subdivision:4,stroke:'U',label:'Sixteenths · upstroke'}];
const TUNING=[40,45,50,55,59,64],MINOR=[0,2,3,5,7,8,10];
export function roomShapes(root,intervals=MINOR){
 const pitches=Array.from({length:90},(_,i)=>i+40).filter(m=>intervals.includes((m-root+120)%12));
 const shapes=[];
 for(let i=0;i+17<pitches.length;i++){
  const rows=TUNING.map((open,s)=>pitches.slice(i+s*3,i+s*3+3).map(m=>({string:6-s,fret:m-open,midi:[m]})));
  if(rows.flat().every(n=>n.fret>=1 && n.fret<=24))shapes.push(rows);
 }
 return shapes;
}
export function sequencePairs(root){
 const shapes=roomShapes(root);
 if(shapes.length<11)throw new Error('Not enough playable neighbouring shapes');
 return shapes.slice(0,10).map((lower,i)=>({lower,upper:shapes[i+1],fret:lower[0][0].fret}));
}
const straight=shape=>shape.flat();
const sixes=shape=>shape.slice(0,-1).flatMap((row,i)=>[...row,...shape[i+1]]);
const reverseShape=shape=>shape.slice().reverse().map(row=>row.slice().reverse());
export function roomPassage(pair,high,stroke){
 const asc=pair.lower,desc=reverseShape(pair.upper);
 const first=high?desc:asc,second=high?asc:desc;
 const raw=[...straight(first),...straight(second),...sixes(first),...sixes(second),first[0][0]];
 return raw.map((n,i)=>({...n,stroke:i%2===0?stroke:stroke==='D'?'U':'D',phase:i<36?'Scale run':i<96?'Picking sequence':'Hold',len:1}));
}
// All moving notes take 250ms at the prescribed tempos. Hold four beats,
// a 4/4 landing bar; no silent gap follows it.
export function buildRoomSession(root){
 const pairs=sequencePairs(root),passages=[],ticks=[];
 ROOM_ROUNDS.forEach((round,ri)=>pairs.forEach((pair,pi)=>[false,true].forEach(high=>{
  const notes=roomPassage(pair,high,round.stroke),hold=round.subdivision*4;
  notes[96]={...notes[96],len:hold,noteValue:'Whole',dots:0};
  const columns=[...notes,...Array.from({length:hold-1},()=>({hold:true,phase:'Hold'}))];
  const passage={...round,round:ri,position:pi,high,fret:pair.fret,notes:columns,start:ticks.length};
  const passageIndex=passages.length;passages.push(passage);
  columns.forEach((note,ni)=>ticks.push({...note,passage:passageIndex,ni,bpm:round.bpm,subdivision:round.subdivision,boundary:ni===0}));
 })));
 return {pairs,passages,ticks,seconds:ticks.reduce((t,n)=>t+60/n.bpm/n.subdivision,0)};
}
