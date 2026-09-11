// Integer timing grid shared by the preview and audio scheduler.
export const FOCUS_TICKS = 96;
export function focusEvents(piece) {
 const resolution=piece.ticksPerSixteenth||1;let time=0,note=0;
 return piece.bars.flatMap((bar,b)=>{let within=0;return bar.map(([tick,len,stroke,frets,meta={}])=>{
  const event={...meta,bar:b+1,sourceTick:time+tick,sourceLength:len,stroke,
   string:frets[0]?.[0],fret:frets[0]?.[1],extra:frets.slice(1).map(([string,fret])=>({string,fret})),
   midi:frets.map(([string,fret])=>piece.tuning[piece.tuning.length-string]+fret),rest:!frets.length,
   note:frets.length?++note:null,barNote:frets.length?++within:null};
  if(tick+len===bar.reduce((sum,e)=>sum+e[1],0))time+=tick+len;
  return event;
 });});
}
export function buildFocusWindows(piece,{startBar,endBar,method='beat',subdivision=4,beatsPerBurst=1,ratio=7,direction='long-short'}={}) {
 const all=focusEvents(piece),r=piece.ticksPerSixteenth||1;
 const tickRate=FOCUS_TICKS*(method==='beat' && subdivision%3===0 && r%3===0?3:1);
 const starts=all.map((e,i)=>({e,i})).filter(({e})=>!e.rest&&e.bar>=startBar&&e.bar<=endBar);
 if(method==='beat')return starts.map(({e,i})=>{
  const beats=Math.max(1,Math.min(16,Math.floor(Number(beatsPerBurst))||1));
  const target=e.sourceTick+beats*subdivision*r;
  let last=all.findIndex((n,j)=>j>i&&!n.rest&&n.sourceTick>=target);
  const hasLanding=last>=0;
  if(last<0)last=all.length-1;
  const selected=all.slice(i,last+1).map((n,j)=>({...n,duration:Math.round(n.sourceLength/r/subdivision*tickRate),landing:hasLanding && j===last-i}));
  return makeWindow(selected,`Bar ${e.bar} · note ${e.barNote}`,e.bar,tickRate);
 });
 const selected=all.filter(e=>e.bar>=startBar&&e.bar<=endBar).map(n=>({...n,duration:Math.round(n.sourceLength/r/4*FOCUS_TICKS)}));
 for(let i=0;i<selected.length-1;i++) {
  const a=selected[i],b=selected[i+1];
  if(a.rest||b.rest||a.tuplet||b.tuplet||a.sourceLength!==r||b.sourceLength!==r)continue;
  const long=FOCUS_TICKS*ratio/(ratio+1),short=FOCUS_TICKS/(ratio+1);
  [a.duration,b.duration]=direction==='long-short'?[long,short]:[short,long];
  for(const n of [a,b]){const isLong=n.duration===long;n.noteValue=isLong?'Eighth':ratio===7?'32nd':'16th';n.dots=isLong?(ratio===7?2:1):0;}
  i++;
 }
 const landing=all.find(e=>e.bar>endBar&&!e.rest);
 if(landing)selected.push({...landing,duration:FOCUS_TICKS/4,landing:true});
 if(!selected.length)return [];
 const window=makeWindow(selected,`Bars ${startBar}–${endBar}`,startBar);
 // The short note is an anacrusis: the first long note lands on beat one.
 window.pickupTicks=direction==='short-long' && selected[0].dots===0 && selected[1]?.dots>0 ? selected[0].duration : 0;
 window.leadTicks=window.pickupTicks?FOCUS_TICKS-window.pickupTicks:0;
 return [window];
}
function makeWindow(events,label,bar,tickRate=FOCUS_TICKS) {
 const notes=[];events.forEach((e,i)=>{const len=e.landing?1:Math.max(1,Math.round(e.duration));notes.push({...e,bar:i===0||events[i-1].bar!==e.bar?e.bar:undefined,len,last:i===events.length-1});for(let j=1;j<len;j++)notes.push({hold:true});});
 // End after the landing attack; without a landing, finish the written duration.
 if(notes.length)notes[notes.length-1].last=true;
 return {label,bar,notes,events,tickRate};
}
