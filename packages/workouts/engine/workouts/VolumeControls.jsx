import React from 'react';
export function volumePercent(value) {return Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):100;}
export default function VolumeControls({instrumentVolume,metronomeVolume,setInstrumentVolume,setMetronomeVolume}) {
  return <div className="cp-volumes">{[['Instrument volume',instrumentVolume,setInstrumentVolume],['Metronome volume',metronomeVolume,setMetronomeVolume]].map(([label,value,setValue])=><label key={label}><span>{label}<output>{value}%</output></span><input type="range" min="0" max="100" step="1" aria-label={label} aria-valuetext={`${value} percent`} value={value} onChange={e=>setValue(Number(e.target.value))}/></label>)}</div>;
}
