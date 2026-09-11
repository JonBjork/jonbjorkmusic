import React,{useEffect,useRef,useState} from 'react';
import {primeMetronomeAudio,getAudioContext} from '../shared/metronome';
import {prepareGuitar,pluck,stopGuitar} from './guitarSynth';
import './tuning.css';
export const TUNING_STRINGS=[['E',2,40],['A',2,45],['D',3,50],['G',3,55],['B',3,59],['E',4,64]];
export default function Tuning(){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(null),[error,setError]=useState('');
 const dialog=useRef(null),trigger=useRef(null),timer=useRef(null),generation=useRef(0);
 function stop(){generation.current++;clearTimeout(timer.current);stopGuitar();setSelected(null);}
 useEffect(()=>()=>{generation.current++;clearTimeout(timer.current);stopGuitar();},[]);
 useEffect(()=>{if(open)dialog.current.showModal();},[open]);
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 function close(){stop();dialog.current.close();setOpen(false);trigger.current?.focus();}
 async function play(index){stop();if(selected===index)return;const token=generation.current;setError('');try{
  await primeMetronomeAudio();if(token!==generation.current)return;
  const ctx=getAudioContext();await prepareGuitar(ctx,'piano');if(token!==generation.current)return;
  pluck(ctx,TUNING_STRINGS[index][2],ctx.currentTime,3,.5);setSelected(index);
  timer.current=setTimeout(()=>{if(token===generation.current)setSelected(null);},3250);
 }catch{if(token===generation.current)setError('Audio could not start. Tap a string to try again.');}}
 return <><button ref={trigger} className="wk-tuning-trigger" onClick={()=>{setError('');setOpen(true);}}>Tuning</button>{open&&<dialog ref={dialog} className="wk-tuning" aria-labelledby="wk-tuning-title" onCancel={e=>{e.preventDefault();close();}}>
 <div className="wk-tuning-heading"><h2 id="wk-tuning-title">Tuning</h2><button onClick={close} aria-label="Close tuning">✕</button></div>
 <p>Standard tuning · Grand piano · A440 reference</p><p>Tap a string and match your open string to the tone. Tap again to stop.</p>
 <div className="wk-tuning-strings">{TUNING_STRINGS.map(([note,octave,midi],i)=><button key={midi} aria-label={`String ${6-i}: ${note}${octave}`} aria-pressed={selected===i} onClick={()=>play(i)}><small>STRING {6-i}</small><strong>{note}<sub>{octave}</sub></strong><span>{(440*Math.pow(2,(midi-69)/12)).toFixed(2)} Hz</span></button>)}</div>
 <div className="wk-tuning-footer"><span aria-live="polite">{error||(selected===null?'Low E → high E':`Playing ${TUNING_STRINGS[selected][0]}${TUNING_STRINGS[selected][1]}`)}</span><button onClick={stop} disabled={selected===null}>Stop tone</button></div>
 </dialog>}</>;
}
