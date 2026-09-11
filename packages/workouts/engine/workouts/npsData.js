import source from '../../routines/nps-source.json';
import {roomShapes} from './roomSequence';
export const NPS_ID='chops-3nps-1';
export const NPS_TITLE='3-Notes-Per-String Alternate Picking Workout #1';
export const NPS_KEYS=['C major / A minor','D♭ major / B♭ minor','D major / B minor','E♭ major / C minor','E major / C♯ minor','F major / D minor','G♭ major / E♭ minor','G major / E minor','A♭ major / F minor','A major / F♯ minor','B♭ major / G minor','B major / G♯ minor'];
export const NPS_SCALES={
 natural:{label:'Major / Natural Minor',intervals:[0,2,3,5,7,8,10]},
 harmonic:{label:'Harmonic Minor',intervals:[0,2,3,5,7,8,11]},
 melodic:{label:'Melodic Minor',intervals:[0,2,3,5,7,9,11]},
};
export function npsKeyLabel(key,scale='natural'){
 if(scale==='natural')return NPS_KEYS[key];
 return NPS_KEYS[key].split(' / ')[1].replace('minor',scale==='harmonic'?'harmonic minor':'melodic minor');
}
// Key values remain pitch classes so saved selections keep their meaning.
export const NPS_KEY_ORDER=[0,7,2,9,4,11,6,1,8,3,10,5];
const reference=roomShapes(9),index=reference.findIndex(s=>s[0][0].fret===5);
// Each GP sequence uses the lower shape ascending and its neighbour descending.
export const NPS_PATTERNS=source.map(notes=>notes.map(([string,fret],i)=>{
 const shape=i<notes.length/2?0:1;
 const row=reference[index+shape][6-string];
 const finger=row.findIndex(n=>n.fret===fret);
 if(finger<0)throw new Error(`Unmapped 3NPS note ${string}:${fret}`);
 return {shape,string,finger};
}));
export function buildNps({key=0,startStroke='D',frets=24,scale='natural'}={}){
 const shapes=roomShapes((key+9)%12,NPS_SCALES[scale].intervals).filter(shape=>shape.flat().every(n=>n.fret<=frets));
 const pairs=shapes.slice(0,-1).slice(0,10).map((lower,i)=>({lower,upper:shapes[i+1],fret:lower[0][0].fret}));
 const passages=[];
 pairs.forEach((pair,position)=>NPS_PATTERNS.forEach((pattern,sequence)=>{
  const stroke=position%2?(startStroke==='D'?'U':'D'):startStroke;
  const raw=pattern.map(p=>({...pair[p.shape?'upper':'lower'][6-p.string][p.finger],shape:p.shape}));
  // The GP joins straight into the next exercise; isolated sequences need their landing.
  raw.push({...raw[0]});
  const notes=raw.map((n,i)=>({...n,len:1,stroke:i%2?(stroke==='D'?'U':'D'):stroke}));
  passages.push({position,sequence,notes,pair,stroke});
 }));
 return {pairs,passages};
}
