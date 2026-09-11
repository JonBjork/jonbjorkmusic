import React from 'react';
export const SUBDIVISIONS = [[2,'Eighth notes'],[3,'Eighth-note triplets'],[4,'Sixteenth notes'],[6,'Sixteenth-note triplets'],[8,'32nd notes']];
export const readSubdivision = (value, fallback=4) => SUBDIVISIONS.some(([n])=>n===value)?value:fallback;
export default function MetronomeSubdivisions({enabled,onToggle,value,onChange}) {
 return <div className="cp-choices" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
  <button type="button" role="switch" aria-checked={enabled} onClick={()=>onToggle(!enabled)}>Subdivisions {enabled?'on':'off'}</button>
  <label style={{fontSize:14,color:'#bba5d6'}}>Metronome subdivision <select style={{display:'block',maxWidth:'100%',marginTop:6,padding:'8px 10px',background:'#202020',color:'#eee',border:'1px solid #594071',borderRadius:6,font:'inherit'}} aria-label="Metronome subdivision" value={value} onChange={e=>onChange(Number(e.target.value))}>{SUBDIVISIONS.map(([n,label])=><option key={n} value={n}>{label}</option>)}</select></label>
 </div>;
}
