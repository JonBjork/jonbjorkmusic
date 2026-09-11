import {assetUrl} from '../shared/assets';
import { pluck as originalPluck, setOriginalVolume } from './originalGuitarSynth';

// Locally bundled multi-samples; each note uses the closest recording, with
// playback rate supplying the small remaining pitch interval. No new clock.
const NOTES = {
  piano: Object.fromEntries(Array.from({length:49},(_,i)=>[String(i+40),i+40])),
  harpsichord: Object.fromEntries(Array.from({length:49},(_,i)=>[String(i+40),i+40])),
  electric: { E2:40,A2:45,C3:48,Ds3:51,Fs3:54,A3:57,C4:60,Ds4:63,Fs4:66,A4:69,C5:72,Ds5:75,Fs5:78,A5:81 },
  nylon: { E2:40,A2:45,Cs3:49,E3:52,A3:57,Cs4:61,E4:64,A4:69,Cs5:73,E5:76,A5:81 },
};
const contexts = new WeakMap();
const voices = new Set();
let selected = 'original';
let masterVolume = 1;
export function setInstrumentVolume(ctx,value) {
  masterVolume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):1;
  setOriginalVolume(masterVolume);
  if(ctx)stateFor(ctx).bus.gain.setTargetAtTime(1.7*masterVolume,ctx.currentTime,0.015);
}
function stateFor(ctx) {
  if (!contexts.has(ctx)) {
    const gain = ctx.createGain(); gain.gain.value = 1.7 * masterVolume;
    const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=6800; filter.Q.value=0.5;
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-6;limiter.knee.value=6;limiter.ratio.value=8;
    limiter.attack.value=.003;limiter.release.value=.08;
    gain.connect(filter).connect(limiter).connect(ctx.destination);
    contexts.set(ctx, {bus:gain, filter, banks:{}, pending:{}});
  }
  return contexts.get(ctx);
}
export async function prepareGuitar(ctx, tone='electric') {
  if (tone==='original') {selected=tone;return;}
  if (!NOTES[tone]) throw new Error('Unknown instrument');
  const state=stateFor(ctx);
  if (!state.banks[tone]) {
    if (!state.pending[tone]) state.pending[tone] = Promise.all(Object.entries(NOTES[tone]).map(async ([file,midi]) => {
      const folder=tone==='electric' ? 'guitar-electric' : tone==='nylon' ? 'guitar-nylon' : tone;
      const response=await fetch(assetUrl(`/audio/${folder}/${file}.mp3`));
      if (!response.ok) throw new Error('Could not load instrument recordings. Please try again.');
      const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
      return {midi,buffer};
    })).then(bank=>{state.banks[tone]=bank;}).finally(()=>{delete state.pending[tone];});
    await state.pending[tone];
  }
  state.filter.frequency.value=tone==='harpsichord' ? 14000 : tone==='piano' ? 11000 : 6800;
  selected=tone;
}
export function stopGuitar() {
  for (const src of voices) { try {src.stop();} catch(e) {} }
  voices.clear();
}
export function pluck(ctx,midi,when,seconds,volume=0.5,options={}) {
  if (!ctx) return;
  if (selected==='original') {const src=originalPluck(ctx,midi,when,seconds,volume,options);if(src){voices.add(src);src.addEventListener('ended',()=>voices.delete(src),{once:true});}return;}
  const state=stateFor(ctx), bank=state.banks[selected];
  if (!bank) return;
  const sample=bank.reduce((best,s)=>Math.abs(s.midi-midi)<Math.abs(best.midi-midi)?s:best);
  const source=ctx.createBufferSource(), gain=ctx.createGain();
  const rate=Math.pow(2,(midi-sample.midi)/12);
  source.buffer=sample.buffer;source.playbackRate.value=rate;
  const start=Math.max(ctx.currentTime,when);
  const release=options.tight?Math.min(.025,Math.max(.003,seconds*.2)):selected==='piano' ? 0.25 : selected==='harpsichord' ? 0.10 : 0.14;
  const level=volume * (selected==='harpsichord' ? 0.7 : 1);
  const duration=Math.min(sample.buffer.duration/rate,Math.max(options.tight ? 0.004 : 0.08,seconds)+release);
  gain.gain.setValueAtTime(0,start);
  gain.gain.linearRampToValueAtTime(level,start+0.003);
  gain.gain.setValueAtTime(level,start+Math.max(0.004,duration-release));
  gain.gain.linearRampToValueAtTime(0,start+duration);
  source.connect(gain).connect(state.bus);
  voices.add(source);
  source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
  source.start(start);source.stop(start+duration+0.01);
}
export function strum(ctx,midis,when,seconds,volume=0.5,options={}) {
  midis.forEach((m,i)=>pluck(ctx,m,when+i*0.012,seconds,volume));
}
