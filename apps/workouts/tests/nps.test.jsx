import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import NpsWorkout from '../../../packages/workouts/engine/workouts/NpsWorkout';
import {buildNps,NPS_KEYS} from '../../../packages/workouts/engine/workouts/npsData';
import source from '../../../packages/workouts/routines/nps-source.json';
import {createMetronomeEngine} from '../../../packages/workouts/engine/shared/metronome';
jest.mock('../../../packages/workouts/engine/shared/metronome',()=>({createMetronomeEngine:jest.fn(),primeMetronomeAudio:async()=>{},getAudioContext:()=>({currentTime:0})}));
jest.mock('../../../packages/workouts/engine/workouts/guitarSynth',()=>({prepareGuitar:async()=>{},pluck:jest.fn(),stopGuitar:jest.fn(),setInstrumentVolume:jest.fn()}));
jest.mock('../../../packages/workouts/engine/workouts/PieceSetup',()=>({NumberField:()=>null}));
jest.mock('../../../packages/workouts/engine/workouts/Tuning',()=>()=>null);
global.IS_REACT_ACT_ENVIRONMENT=true;
test('all twelve keys fit the fretboard, match the reference score and reverse every pick stroke',()=>{
 expect(NPS_KEYS).toHaveLength(12);
 for(let key=0;key<12;key++){
  const d=buildNps({key}),u=buildNps({key,startStroke:'U'});expect(d.pairs).toHaveLength(10);expect(d.passages).toHaveLength(110);
  d.passages.forEach((p,i)=>{expect(p.notes.at(-1).midi).toEqual(p.notes[0].midi);expect(p.stroke).toBe(p.position%2?'U':'D');
   p.notes.forEach((n,j)=>{expect(n.fret).toBeGreaterThan(0);expect(n.fret).toBeLessThanOrEqual(24);expect(n.stroke).not.toBe(u.passages[i].notes[j].stroke);});
  });
 }
 const reference=buildNps({key:0});source.forEach((notes,i)=>expect(reference.passages[22+i].notes.slice(0,-1).map(n=>[n.string,n.fret])).toEqual(notes));
 expect(buildNps({key:0,frets:22}).pairs).toHaveLength(9);
});
test.each([60,80,120])('two-beat count-in uses the selected tempo (%i BPM) and stops when paused',async(bpm)=>{
 jest.useFakeTimers();localStorage.clear();localStorage.setItem('workouts.nps.settings',JSON.stringify({bpm}));const options=[];
 createMetronomeEngine.mockReturnValue({start:jest.fn(async o=>options.push(o)),stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 act(()=>root.render(<NpsWorkout onBack={()=>{}}/>));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 await act(async()=>button('Start practicing ▶').click());expect(options[0].countInBeats).toBe(4);
 await act(async()=>{options[0].onScheduleTick(37,0);jest.advanceTimersByTime(1);});
 expect(options).toHaveLength(2);expect(options[1]).toMatchObject({bpm,countInBeats:2,countInSubdivide:false});
 expect(host.textContent).toContain('Count in · 2');
 act(()=>options[1].onCountIn(1));expect(host.textContent).toContain('Count in · 1');
 act(()=>button('Pause').click());await act(async()=>jest.advanceTimersByTime(5000));expect(options).toHaveLength(2);
 act(()=>root.unmount());host.remove();jest.useRealTimers();
});
test('all subdivisions drive playback, notation, and the metronome subdivision switch',async()=>{
 localStorage.clear();const options=[];const engine={start:jest.fn(async o=>options.push(o)),stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()};createMetronomeEngine.mockReturnValue(engine);
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);act(()=>root.render(<NpsWorkout onBack={()=>{}}/>));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 for(let value=1;value<=8;value++){
  act(()=>{const select=[...host.querySelectorAll('label')].find(l=>l.textContent.startsWith('Notes per beat')).querySelector('select');select.value=String(value);select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>button('Start practicing ▶').click());expect(options.at(-1).subdivision).toBe(value);
  act(()=>{[...host.querySelectorAll('[role=switch]')].find(b=>b.textContent.startsWith('Subdivisions')).click();});expect(engine.setAudibleSubdivision).toHaveBeenLastCalledWith(value);
  act(()=>{[...host.querySelectorAll('[role=switch]')].find(b=>b.textContent.startsWith('Subdivisions')).click();button('Pause').click();});
 }
 expect(JSON.parse(localStorage.getItem('workouts.nps.settings')).subdivision).toBe(8);
 act(()=>root.unmount());host.remove();
});
test('harmonic and melodic minor use the correct intervals in all keys and fret ranges',()=>{
 const scales={harmonic:[0,2,3,5,7,8,11],melodic:[0,2,3,5,7,9,11]};
 for(const [scale,intervals] of Object.entries(scales))for(let key=0;key<12;key++)for(const frets of [22,24]){
  const data=buildNps({key,scale,frets});expect(data.pairs.length).toBeGreaterThan(0);
  const root=(key+9)%12;
  for(const pair of data.pairs){
   for(const shape of [pair.lower,pair.upper]){
    expect(shape).toHaveLength(6);
    for(const row of shape){expect(row).toHaveLength(3);for(const n of row){expect(intervals).toContain((n.midi[0]-root+120)%12);expect(n.fret).toBeGreaterThan(0);expect(n.fret).toBeLessThanOrEqual(frets);}}
   }
  }
  expect(data.passages).toHaveLength(data.pairs.length*11);
 }
});
test('scale selection stays separate from twelve ordered keys and persists',()=>{
 localStorage.clear();createMetronomeEngine.mockReturnValue({stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');const root=createRoot(host);act(()=>root.render(<NpsWorkout onBack={()=>{}}/>));
 const field=label=>[...host.querySelectorAll('label')].find(l=>l.textContent.startsWith(label)).querySelector('select');
 for(const scale of ['harmonic','melodic']){
  act(()=>{field('Scale').value=scale;field('Scale').dispatchEvent(new Event('change',{bubbles:true}));});
  expect(field('Key').options).toHaveLength(12);expect([...field('Key').options].map(o=>o.value)).toEqual(['0','7','2','9','4','11','6','1','8','3','10','5']);
  expect(field('Key').options[0].textContent).toBe(`A ${scale} minor`);
  expect(JSON.parse(localStorage.getItem('workouts.nps.settings')).scale).toBe(scale);
 }
 act(()=>root.unmount());
});

test('legato matches all thirteen GP sequences, repeats the final scale and supports every scale/key',()=>{
 const {buildLegato}=require('../../../packages/workouts/engine/workouts/legatoData');
 const original=require('../../../packages/workouts/routines/legato-source.json');
 const data=buildLegato();expect(data.passages).toHaveLength(130);
 original.forEach((section,i)=>{
  const raw=section.notes.map(n=>[n.string,n.fret]);
  const expected=i===12?[...raw,...raw]:raw;
  const notes=data.passages[26+i].notes;
  expect(notes.map(n=>[n.string,n.fret])).toEqual([...expected,raw[0]]);
  expect(notes.some(n=>n.legato==='H'||n.legato==='P')).toBe(true);
 });
 const turn=data.passages[33].notes;expect(turn[24].stroke).toBe('D');expect(turn[24].legato).toBeFalsy();expect(turn[24].fret).toBe(turn[23].fret);
 for(const scale of ['natural','harmonic','melodic'])for(let key=0;key<12;key++){
  const d=buildLegato({scale,key});expect(d.passages).toHaveLength(d.pairs.length*13);
  expect(d.passages.every(p=>p.notes.every(n=>n.fret>0&&n.fret<=24))).toBe(true);
 }
});
test('legato offers shared scale controls without a starting-stroke selector',()=>{
 localStorage.clear();createMetronomeEngine.mockReturnValue({stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');const root=createRoot(host);act(()=>root.render(<NpsWorkout legato onBack={()=>{}}/>));
 const labels=[...host.querySelectorAll('label')];
 expect(labels.some(l=>l.textContent.startsWith('Start on'))).toBe(false);
 expect(labels.find(l=>l.textContent.startsWith('Scale')).querySelectorAll('option')).toHaveLength(3);
 expect(labels.find(l=>l.textContent.startsWith('Sequence')).querySelectorAll('option')).toHaveLength(13);
 expect(labels.find(l=>l.textContent.startsWith('Notes per beat')).querySelectorAll('option')).toHaveLength(8);
 expect(JSON.parse(localStorage.getItem('workouts.legato.settings')).bpm).toBe(80);
 act(()=>root.unmount());host.remove();
});


test('every legato note has exactly one articulation and final scales pick each string and shift',()=>{
 const {buildLegato}=require('../../../packages/workouts/engine/workouts/legatoData');
 for(const scale of ['natural','harmonic','melodic']){
  const {passages}=buildLegato({scale});
  for(const p of passages)for(const n of p.notes)expect(Number(Boolean(n.legato))+Number(Boolean(n.stroke))).toBe(1);
  const notes=passages[12].notes;
  expect(notes[0].stroke).toBe('D');
  for(let i=1;i<notes.length;i++){
   const n=notes[i],prev=notes[i-1];
   if(n.string!==prev.string)expect(n.stroke).toBe(n.string<prev.string?'D':'U');
   else if(n.shape!==prev.shape)expect(n.stroke).toBe(n.string===1?'U':'D');
   else expect(n.legato).toBe(n.fret>prev.fret?'H':'P');
  }
  expect(notes[18].stroke).toBe('U');expect(notes[54].stroke).toBe('U');
  expect(notes[36].stroke).toBe('D');expect(notes[72].stroke).toBe('D');
 }
});

test('sweep uses all 80 score bars in 56 one-minute exercises with complete articulation',()=>{
 const {buildSweep}=require('../../../packages/workouts/engine/workouts/sweepData');
 const source=require('../../../packages/workouts/routines/sweep-source.json');
 expect(source.flatMap(s=>s.bars)).toEqual(Array.from({length:80},(_,i)=>i+1));
 for(const bpm of [30,60,80,123.5,200])for(const subdivision of [1,2,3,4,5,6,7,8]){
  const data=buildSweep({bpm,subdivision});expect(data.passages).toHaveLength(56);
  data.passages.forEach((p,k)=>{
   expect(p.notes.reduce((s,n)=>s+n.len*60/bpm/subdivision,0)).toBeCloseTo(60,7);
   expect(p.notes.every(n=>Boolean(n.stroke)!==Boolean(n.legato))).toBe(true);
   expect(p.shapes.every(s=>!s.label.includes('undefined'))).toBe(true);
   expect(p.notes.slice(0,Math.min(p.notes.length,source[k].notes.length)).map(n=>[n.string,n.fret,n.stroke,n.legato])).toEqual(source[k].notes.slice(0,p.notes.length).map(n=>[n.string,n.fret,n.stroke,n.legato]));
  });
 }
});
test('sweep ends at sixty seconds and starts the next exercise with two beats',async()=>{
 jest.useFakeTimers();localStorage.clear();const options=[];
 createMetronomeEngine.mockReturnValue({start:jest.fn(async o=>options.push(o)),stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');const root=createRoot(host);act(()=>root.render(<NpsWorkout sweep onBack={()=>{}}/>));
 expect(host.textContent).toContain('56 one-minute exercises');expect(host.textContent).not.toContain('Start on');
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 await act(async()=>button('Start practicing ▶').click());
 act(()=>{options[0].onScheduleTick(0,0);options[0].onScheduleTick(160,60);});
 await act(async()=>jest.advanceTimersByTime(59999));expect(options).toHaveLength(1);
 await act(async()=>jest.advanceTimersByTime(1));expect(options).toHaveLength(2);expect(options[1].countInBeats).toBe(2);
 act(()=>button('Pause').click());act(()=>root.unmount());jest.useRealTimers();
});

test('sweep transposition preserves every shape and articulation in all twelve keys without false bar lines',()=>{
 const {buildSweep}=require('../../../packages/workouts/engine/workouts/sweepData');
 const base=buildSweep();
 for(let key=0;key<12;key++){
  const data=buildSweep({key});
  data.passages.forEach((p,i)=>p.notes.forEach((n,j)=>{
   const original=base.passages[i].notes[j];
   expect(n.bar).toBeUndefined();expect(n.string).toBe(original.string);
   expect(n.stroke).toBe(original.stroke);expect(n.legato).toBe(original.legato);
   expect((n.midi[0]-original.midi[0]+24)%12).toBe(key);
   expect(n.fret>=1&&n.fret<=24).toBe(true);
   const shift=p.shapes[n.shape].shift;
   expect(n.fret-original.fret).toBe(shift);
  }));
 }
});
test('sweep exercise picker follows the selected section and offers twelve keys',()=>{
 localStorage.clear();createMetronomeEngine.mockReturnValue({stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');const root=createRoot(host);act(()=>root.render(<NpsWorkout sweep onBack={()=>{}}/>));
 const field=name=>[...host.querySelectorAll('label')].find(l=>l.textContent.startsWith(name)).querySelector('select');
 expect(field('Key').options).toHaveLength(12);expect(field('Exercise').options).toHaveLength(8);
 act(()=>{field('Section').value='Paired Am / E loops';field('Section').dispatchEvent(new Event('change',{bubbles:true}));});
 expect(field('Exercise').options).toHaveLength(4);expect(field('Exercise').value).toBe('8');
 act(()=>root.unmount());
});

test('five-string score preserves all notes, shapes and durations in twelve keys',()=>{
 const {buildSweep}=require('../../../packages/workouts/engine/workouts/sweepData');
 const source=require('../../../packages/workouts/routines/sweep-five-source.json');
 expect(source.flatMap(s=>s.bars)).toEqual(Array.from({length:30},(_,i)=>i+1));
 for(let key=0;key<12;key++){
  const data=buildSweep({five:true,key,bpm:80,subdivision:2});
  expect(data.passages).toHaveLength(14);expect(data.passages.reduce((s,p)=>s+p.duration,0)).toBe(3480);
  data.passages.forEach((p,i)=>{
   expect(p.duration).toBe(i<12?240:300);
   expect(p.notes.reduce((s,n)=>s+n.len*60/80/2,0)).toBeCloseTo(p.duration);
   expect(p.shapes.every(s=>!s.label.includes('undefined'))).toBe(true);
   const original=source[i].notes;
   expect(p.notes.every((n,j)=>{
    const o=original[j%original.length];
    return n.string===o.string&&n.fret===o.fret+p.shapes[n.shape].shift&&n.fret>=1&&n.fret<=24&&n.stroke===o.stroke&&n.legato===o.legato&&!n.bar;
   })).toBe(true);
  });
 }
});
test('five-string final exercises run for five minutes with the correct default key',async()=>{
 jest.useFakeTimers();localStorage.clear();const options=[];
 createMetronomeEngine.mockReturnValue({start:jest.fn(async o=>options.push(o)),stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');const root=createRoot(host);act(()=>root.render(<NpsWorkout sweep five onBack={()=>{}}/>));
 expect(host.textContent).toContain('D minor / A major');expect(host.textContent).toContain('58 minutes');
 const section=[...host.querySelectorAll('label')].find(l=>l.textContent.startsWith('Section')).querySelector('select');
 act(()=>{section.value='All shapes · up and back';section.dispatchEvent(new Event('change',{bubbles:true}));});
 const exercise=[...host.querySelectorAll('label')].find(l=>l.textContent.startsWith('Exercise')).querySelector('select');expect(exercise.options).toHaveLength(2);
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 await act(async()=>button('Start practicing ▶').click());
 act(()=>{options[0].onScheduleTick(0,0);options[0].onScheduleTick(800,300);});
 await act(async()=>jest.advanceTimersByTime(299999));expect(options).toHaveLength(1);
 await act(async()=>jest.advanceTimersByTime(1));expect(options).toHaveLength(2);expect(options[1].countInBeats).toBe(2);
 act(()=>button('Pause').click());act(()=>root.unmount());jest.useRealTimers();
});
test('focus selector shows one sequence per position and starts the chosen sequence',async()=>{
 localStorage.clear();const calls=[];
 createMetronomeEngine.mockReturnValue({start:jest.fn(async o=>calls.push(o)),stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 act(()=>root.render(<NpsWorkout onBack={()=>{}}/>));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 act(()=>button('Focus on one sequence').click());
 expect(host.querySelectorAll('.nps-sequences button')).toHaveLength(11);
 act(()=>host.querySelector('[aria-label="Sequence 4"]').click());
 expect(host.textContent).toContain('Exercise #4 · Position 1');
 expect(host.textContent).toContain('0 of 11 completed');
 await act(async()=>button('Start practicing ▶').click());
 expect(calls[0].countInBeats).toBe(4);
 act(()=>button('Pause').click());
 act(()=>root.unmount());host.remove();
});
