// Same 3NPS construction and diagram geometry as Practice Lab's roomSequence
// and CurrentRoomShape, with major-scale degrees for this exercise.
export const MAJOR=[0,2,4,5,7,9,11];
const TUNING=[40,45,50,55,59,64];
export function majorShapes(root=0,maxFret=24){
 const pitches=Array.from({length:100},(_,i)=>i+40).filter(m=>MAJOR.includes((m-root+120)%12));
 const shapes=[];
 for(let i=0;i+17<pitches.length;i++){
  const rows=TUNING.map((open,s)=>pitches.slice(i+s*3,i+s*3+3).map((m,j)=>({string:6-s,fret:m-open,midi:m,finger:j===0?1:j===2?4:2})));
  if(rows.flat().every(n=>n.fret>=1&&n.fret<=maxFret))shapes.push({rows,degree:MAJOR.indexOf((rows[0][0].midi-root+120)%12)+1,fret:rows[0][0].fret,root});
 }
 return shapes;
}
export function shapePassage(shape,high=false){
 const run=high?shape.rows.flat().toReversed():shape.rows.flat();
 // A complete return to the starting note, without repeating the turnaround.
 return [...run,...run.slice(0,-1).toReversed()].map((n,i)=>({...n,len:1,at:i,stroke:i%2?'U':'D'}));
}
export function shapeSVG(shape,activeNote=null){
 const notes=shape.rows.flat(),first=Math.min(...notes.map(n=>n.fret)),last=Math.max(...notes.map(n=>n.fret)),cell=32,width=40+(last-first+1)*cell;
 let svg=`<svg viewBox="0 0 ${width} 154" role="img" aria-label="${shape.label||`C major · Shape #${shape.degree}`}, frets ${first}–${last}. High E string at the top.">`;
 for(let i=0;i<last-first+2;i++)svg+=`<line x1="${30+i*cell}" x2="${30+i*cell}" y1="26" y2="126" stroke="#443b50"/>`;
 ['e','B','G','D','A','E'].forEach((name,i)=>{svg+=`<text x="10" y="${30+i*20}" fill="#a99eb7" font-size="11">${name}</text><line x1="30" x2="${width-10}" y1="${26+i*20}" y2="${26+i*20}" stroke="#655a70"/>`;});
 for(let i=0;i<last-first+1;i++)svg+=`<text x="${46+i*cell}" y="148" text-anchor="middle" fill="#bfb2ce" font-size="11">${first+i}</text>`;
 for(const n of notes){const isRoot=(n.midi-shape.root+120)%12===0,active=activeNote?.string===n.string&&activeNote?.fret===n.fret;svg+=`<g data-shape-note="${n.string}-${n.fret}"><circle cx="${46+(n.fret-first)*cell}" cy="${26+(n.string-1)*20}" r="7" fill="${isRoot?'#bf96ff':'#574168'}" stroke="${active?'#fff':isRoot?'#bf96ff':'#b58afa'}" stroke-width="${active?3:1}"/>${isRoot?`<text x="${46+(n.fret-first)*cell}" y="${29+(n.string-1)*20}" fill="#20122e" font-size="8" text-anchor="middle">R</text>`:''}</g>`;}
 return svg+'</svg>';
}
