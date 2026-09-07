import assert from 'node:assert/strict';
import {prepareGuitar,pluck,stopGuitar} from '../../student-workouts/guitarSynth.js';
const events=[];
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}});
const node=()=>({connect(next){return next;},disconnect(){},gain:param(),frequency:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});
const ctx={currentTime:0,destination:node(),createGain:node,createBiquadFilter:node,createDynamicsCompressor:node,decodeAudioData:async()=>({duration:2}),createBufferSource(){const n=node();n.playbackRate=param();n.start=when=>events.push(['start',when]);n.stop=when=>events.push(['stop',when]);return n;}};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
for(const tone of ['electric','nylon','piano','harpsichord']){
 await prepareGuitar(ctx,tone);events.length=0;pluck(ctx,40,10,.06,.5,{tight:true});
 const stop=events.find(e=>e[0]==='stop')[1];assert(Math.abs(stop-10.082)<1e-9,`${tone}: short note plus 12 ms release and 10 ms stop margin`);stopGuitar();
}
console.log('PASS: all four instruments use a 60 ms gate plus 12 ms release for planting.');
