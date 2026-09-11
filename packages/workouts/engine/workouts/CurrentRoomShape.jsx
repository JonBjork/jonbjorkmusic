import React from 'react';

export function scaleShapeLabel(notes,root,keyName,intervals=[0,2,3,5,7,8,10]) {
 const lowest=Math.min(...notes.flat().map(n=>n.midi[0]));
 const degree=intervals.indexOf(((lowest-root)%12+12)%12)+1;
 return `${keyName}${degree?` · Shape #${degree}`:''}`;
}
// The straight run changes shape after 18 notes; the sequence after 30.
export function currentRoomShape(pair, high, noteIndex) {
 const second = (noteIndex >= 18 && noteIndex < 36) || (noteIndex >= 66 && noteIndex < 96);
 return (high !== second) ? pair.upper : pair.lower;
}
export default function CurrentRoomShape({pair, high, noteIndex, root, keyName, activeNote}) {
 const shape=currentRoomShape(pair,high,noteIndex),notes=shape.flat();
 const label=scaleShapeLabel(notes,root,keyName);
 return <ShapeFretboard notes={notes} root={root} label={label} activeNote={activeNote}/>;
}
export function ShapeFretboard({notes,root,label,activeNote,heading='CURRENT SHAPE'}) {
 const first=Math.min(...notes.map(n=>n.fret)),last=Math.max(...notes.map(n=>n.fret));
 const cell=32,width=40+(last-first+1)*cell;
 return <div className="prs-current-shape">
  <div className="prs-shape-label">{heading}</div><strong>{label}</strong>
  <svg viewBox={`0 0 ${width} 154`} role="img" aria-label={`${label}, frets ${first}–${last}. High E string at the top.`}>
   {Array.from({length:last-first+2},(_,i)=><line key={`f${i}`} x1={30+i*cell} x2={30+i*cell} y1="26" y2="126" stroke="#443b50"/>)}
   {['e','B','G','D','A','E'].map((name,i)=><g key={name}><text x="10" y={30+i*20} fill="#a99eb7" fontSize="11">{name}</text><line x1="30" x2={width-10} y1={26+i*20} y2={26+i*20} stroke="#655a70"/></g>)}
   {Array.from({length:last-first+1},(_,i)=><text key={i} x={46+i*cell} y="148" textAnchor="middle" fill="#bfb2ce" fontSize="11">{first+i}</text>)}
   {notes.map(n=>{const isRoot=root!=null&&(n.midi[0]-root+120)%12===0,active=activeNote?.string===n.string&&activeNote?.fret===n.fret;return <g key={`${n.string}-${n.fret}`} data-string={n.string} data-fret={n.fret} data-root={isRoot?'true':undefined} data-active={active?'true':undefined}><circle cx={46+(n.fret-first)*cell} cy={26+(n.string-1)*20} r="7" fill={active?'#d6b5ff':isRoot?'#bf96ff':'#574168'} stroke={active?'#fff':isRoot?'#bf96ff':'#b58afa'} strokeWidth={active?3:1}/>{isRoot&&<text x={46+(n.fret-first)*cell} y={29+(n.string-1)*20} fill="#20122e" fontSize="8" textAnchor="middle">R</text>}</g>;})}
  </svg>
 </div>;
}
