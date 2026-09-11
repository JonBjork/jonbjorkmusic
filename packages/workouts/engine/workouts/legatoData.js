import source from '../../routines/legato-source.json';
import {roomShapes} from './roomSequence';
import {NPS_SCALES} from './npsData';
const reference=roomShapes(9),start=reference.findIndex(s=>s[0][0].fret===5);
export const LEGATO_PATTERNS=source.map(section=>section.notes.map((n,i)=>{
 const shape=i<section.notes.length/2?0:1;
 const finger=reference[start+shape][6-n.string].findIndex(p=>p.fret===n.fret);
 if(finger<0)throw new Error(`Unmapped legato note ${n.string}:${n.fret}`);
 return {...n,shape,fingerIndex:finger};
}));
export function buildLegato({key=0,frets=24,scale='natural'}={}){
 const shapes=roomShapes((key+9)%12,NPS_SCALES[scale].intervals).filter(s=>s.flat().every(n=>n.fret<=frets));
 const pairs=shapes.slice(0,-1).slice(0,10).map((lower,i)=>({lower,upper:shapes[i+1],fret:lower[0][0].fret}));
 const passages=[];
 pairs.forEach((pair,position)=>LEGATO_PATTERNS.forEach((pattern,sequence)=>{
  const played=sequence===12?[...pattern,...pattern]:pattern;
  const raw=[...played,pattern[0]];
  const notes=raw.map((p,i)=>{
   const n=pair[p.shape?'upper':'lower'][6-p.string][p.fingerIndex];
   const prev=i?raw[i-1]:null;
   const previous=prev?pair[prev.shape?'upper':'lower'][6-prev.string][prev.fingerIndex]:null;
   // Explicit score attacks take priority; every remaining note gets one articulation.
   let legato,stroke;
   if(p.finger)legato=p.finger.toLowerCase();
   else if(p.stroke)stroke=p.stroke==='Down'?'D':'U';
   else if(!previous)stroke='D';
   else if(previous.string!==n.string)stroke=n.string<previous.string?'D':'U';
   else if(sequence===12&&prev.shape!==p.shape)stroke=n.string===1?'U':'D';
   else if(p.hopo&&previous.fret!==n.fret)legato=n.fret>previous.fret?'H':'P';
   else stroke=p.shape?'U':'D';
   return {...n,shape:p.shape,len:1,legato,stroke};
  });
  passages.push({position,sequence,notes,pair});
 }));
 return {pairs,passages};
}
