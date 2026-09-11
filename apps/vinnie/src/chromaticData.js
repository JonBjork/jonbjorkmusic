import scaleSequences from './vinnieScaleSequences.json';
export const CHROMATIC_ID='chromatic-alternate-picking';
export const CHROMATIC_TITLE='The Vinnie Moore Picking Workout';
export const POSITIONS=[...Array.from({length:12},(_,i)=>i+1),...Array.from({length:11},(_,i)=>11-i)];
export const STRING_ROUTE=[1,2,3,4,5,6,5,4,3,2,1];
export const PAIR_ROUTE=[[6,5],[5,4],[4,3],[3,2],[2,1],[3,2],[4,3],[5,4],[6,5]];
export const EXERCISES=[
 {id:'six-up4',section:'Six strings',title:'Six strings · 1–2–3–4',pattern:[1,2,3,4],kind:'six'},
 {id:'six-down4',section:'Six strings',title:'Six strings · 4–3–2–1',pattern:[4,3,2,1],kind:'six'},
 {id:'six-up3',section:'Six strings',title:'Six strings · 1–2–3',pattern:[1,2,3],kind:'six'},
 {id:'six-down3',section:'Six strings',title:'Six strings · 3–2–1',pattern:[3,2,1],kind:'six'},
 {id:'pairs-up4',section:'Two strings',title:'String pairs · 1–2–3–4',pattern:[1,2,3,4],kind:'pairs'},
 {id:'pairs-down4',section:'Two strings',title:'String pairs · 4–3–2–1',pattern:[4,3,2,1],kind:'pairs'},
 {id:'pairs-up3',section:'Two strings',title:'String pairs · 1–2–3',pattern:[1,2,3],kind:'pairs'},
 {id:'pairs-down3',section:'Two strings',title:'String pairs · 3–2–1',pattern:[3,2,1],kind:'pairs'},
 {id:'single',section:'Single string',title:'Single string · alternating direction',pattern:[1,2,3,4],kind:'single'},
...scaleSequences.map((s,i)=>({...s,id:`scale-${i+1}`,section:'Scale Exercises',kind:'scale',pattern:[]})),
].map(e=>({...e,defaultSubdivision:e.pattern.length===3?3:4}));
export const stringName=n=>['','High E','B','G','D','A','Low E'][n];
export function buildChromatic(exercise){
 const notes=[],groups=[];
 function group(position,strings,pattern,visit,routeIndex){
  const start=notes.length;
  for(const string of strings)for(const finger of pattern){
   const fret=position+finger-1;
   notes.push({string,fret,midi:[[64,59,55,50,45,40][string-1]+fret],stroke:notes.length%2?'U':'D',len:1,position,visit,routeIndex,group:groups.length});
  }
  groups.push({start,end:notes.length,position,strings,visit,routeIndex,label:`Fret ${position} · ${strings.length===11?'High E → low E → high E':strings.map(stringName).join(' → ')}`});
 }
 if(exercise.kind==='six')POSITIONS.forEach((p,i)=>group(p,STRING_ROUTE,exercise.pattern,i,0));
 if(exercise.kind==='pairs')PAIR_ROUTE.forEach((pair,r)=>POSITIONS.forEach((p,i)=>group(p,pair,exercise.pattern,i,r)));
 if(exercise.kind==='single')STRING_ROUTE.forEach((string,r)=>POSITIONS.forEach((p,i)=>group(p,[string],i%2?[4,3,2,1]:[1,2,3,4],i,r)));
 if(exercise.kind==='scale') {
  let attack=0;
  POSITIONS.forEach((position,visit)=>{
   const start=notes.length;
   exercise.sequence.forEach(([string,offset,len])=>{
    const fret=position+offset;
    const note={string,fret,midi:[[64,59,55,50,45,40][string-1]+fret],stroke:attack++%2?'U':'D',len,position,visit,group:groups.length};
    notes.push(note);
    for(let i=1;i<len;i++)notes.push({...note,hold:true,len:1});
    if(len>1)attack=0;
   });
   groups.push({start,end:notes.length,position,visit,strings:[6,5,4,3,2,1],label:`Fret ${position} · ${exercise.title}`});
  });
 }
 return {notes,groups};
}
