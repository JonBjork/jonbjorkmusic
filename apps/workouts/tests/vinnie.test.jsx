import {fresh,validate,merge,counts,completedDays,emptyRow,recordGroup,read,dateKey} from '../../vinnie/src/tracking';
import {EXERCISES,buildChromatic} from '../../vinnie/src/chromaticData';
import fs from 'fs';
import path from 'path';
test('standalone Vinnie musical data and cover are exact Practice Lab copies',()=>{
 const root=path.resolve(__dirname,'../../..');
 for(const name of ['chromaticData.js','vinnieScaleSequences.json','CurrentRoomShape.jsx','chromatic-workout.css'])expect(fs.readFileSync(path.join(root,'apps/vinnie/src',name))).toEqual(fs.readFileSync(path.join(root,'../practice-lab/src/workouts',name)));
 expect(fs.readFileSync(path.join(root,'vinnie/cover.png'))).toEqual(fs.readFileSync(path.join(root,'../practice-lab/public/workouts/vinnie-moore-picking-cover.png')));
 expect(EXERCISES).toHaveLength(12);expect(EXERCISES.every(e=>buildChromatic(e).notes.length>0)).toBe(true);
});
test('Vinnie backup validates, merges and keeps skipped positions unfinished',()=>{
 const a=fresh(),b=fresh();a.days['2026-09-11']=emptyRow();b.days['2026-09-11']=emptyRow();
 a.days['2026-09-11'][0]=[0,1];b.days['2026-09-11'][0]=[1,5];
 const merged=merge(a,b);expect(merged.days['2026-09-11'][0]).toEqual([0,1,5]);expect(completedDays(merged)).toEqual([]);
 const complete=fresh();complete.days['2026-09-11']=counts.map(n=>Array.from({length:n},(_,i)=>i));expect(completedDays(validate(complete))).toEqual(['2026-09-11']);
 expect(()=>validate({...a,app:'jb-sweeps'})).toThrow();
 expect(()=>validate({...a,days:{'2026-02-30':emptyRow()}})).toThrow();
 const bad=fresh();bad.days['2026-09-11']=emptyRow();bad.days['2026-09-11'][0]=[counts[0]];expect(()=>validate(bad)).toThrow();
});
test('Vinnie saves independently and repeated groups never double count',()=>{
 localStorage.clear();localStorage.setItem('jb-sweeps-v1','untouched');localStorage.setItem('workouts.log','untouched');
 recordGroup(EXERCISES[0].id,0);recordGroup(EXERCISES[0].id,0);recordGroup(EXERCISES[0].id,4);
 expect(read().days[dateKey()][0]).toEqual([0,4]);expect(localStorage.getItem('jb-sweeps-v1')).toBe('untouched');expect(localStorage.getItem('workouts.log')).toBe('untouched');
});

test('paused tab scrolls to the resume position without a playback highlight',()=>{
 const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
 const TabView=require('../../vinnie/src/TabView').default;global.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div'),root=createRoot(host),notes=buildChromatic(EXERCISES[0]).notes;
 act(()=>root.render(<TabView continuous notes={notes} cursor={-1} previewCursor={44} notesPerBeat={4}/>));
 expect(host.firstChild.scrollLeft).toBeGreaterThan(1000);
 const before=host.firstChild.scrollLeft;
 act(()=>root.render(<TabView continuous notes={notes} cursor={-1} previewCursor={88} notesPerBeat={4}/>));
 expect(host.firstChild.scrollLeft).toBeGreaterThan(before);act(()=>root.unmount());
});

jest.mock('../../../packages/workouts/engine/shared/metronome',()=>({createMetronomeEngine:jest.fn(),primeMetronomeAudio:async()=>{},getAudioContext:()=>({currentTime:0})}));
jest.mock('../../../packages/workouts/engine/workouts/guitarSynth',()=>({prepareGuitar:async()=>{},pluck:jest.fn(),stopGuitar:jest.fn(),setInstrumentVolume:jest.fn()}));
jest.mock('../../../packages/workouts/engine/workouts/PieceSetup',()=>({NumberField:()=>null}));
jest.mock('../../../packages/workouts/engine/workouts/Tuning',()=>()=>null);
test('pause resumes the current position or restarts the exercise, both with a count-in',async()=>{
 const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
 const Workout=require('../../vinnie/src/ChromaticWorkout').default;
 const {createMetronomeEngine}=require('../../../packages/workouts/engine/shared/metronome');
 const {pluck}=require('../../../packages/workouts/engine/workouts/guitarSynth');
 const options=[];createMetronomeEngine.mockReturnValue({start:jest.fn(async o=>options.push(o)),stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 localStorage.clear();global.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div'),root=createRoot(host);
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 act(()=>root.render(<Workout/>));
 expect(host.querySelector('.prs-days progress')).toBeNull();
 expect(host.querySelector('.prs-days').textContent).not.toMatch(/positions/);
 act(()=>button('Start workout ▶').click());
 expect(host.textContent).not.toContain('Preview / resume from');
 await act(async()=>button('Start exercise ▶').click());
 act(()=>options[0].onTick(50));act(()=>button('Pause').click());
 await act(async()=>button('Resume from this position ▶').click());
 expect(options[1].countInBeats).toBe(4);
 const notes=buildChromatic(EXERCISES[0]).notes;
 act(()=>options[1].onScheduleTick(0,0));expect(pluck.mock.calls.at(-1)[1]).toBe(notes[44].midi[0]);
 act(()=>button('Pause').click());await act(async()=>button('Restart exercise').click());
 expect(options[2].countInBeats).toBe(4);
 act(()=>options[2].onScheduleTick(0,0));expect(pluck.mock.calls.at(-1)[1]).toBe(notes[0].midi[0]);
 act(()=>button('Pause').click());expect(button('Resume from this position ▶')).toBeDefined();
 act(()=>root.unmount());
});

test('progress cards and continue open the correct exercise with clear completion states',()=>{
 const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
 const Progress=require('../../vinnie/src/ProgressView').default;
 localStorage.clear();const state=fresh();state.days[dateKey()]=emptyRow();state.days[dateKey()][0]=Array.from({length:counts[0]},(_,i)=>i);state.days[dateKey()][1]=[0];
 const open=jest.fn(),host=document.createElement('div'),root=createRoot(host);global.IS_REACT_ACT_ENVIRONMENT=true;
 act(()=>root.render(<Progress state={state} onOpen={open}/>));
 expect(host.querySelectorAll('.vinnie-progress-card')).toHaveLength(12);
 expect(host.querySelectorAll('.vinnie-progress-group')).toHaveLength(4);
 expect(host.querySelector('.vinnie-today').textContent).toContain('1 of 12');
 expect(host.querySelector('.vinnie-next-milestone').textContent).toContain('7 more completed days');
 act(()=>host.querySelector('.vinnie-continue').click());expect(open).toHaveBeenLastCalledWith(1);
 act(()=>host.querySelectorAll('.vinnie-progress-card')[8].click());expect(open).toHaveBeenLastCalledWith(8);
 expect(host.querySelector('.vinnie-progress-card.is-complete')).not.toBeNull();
 expect(host.querySelector('.vinnie-progress-card.is-started')).not.toBeNull();
 act(()=>root.unmount());
});
test('opening from progress resumes at the first unfinished position',()=>{
 const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
 const Workout=require('../../vinnie/src/ChromaticWorkout').default;
 const {createMetronomeEngine}=require('../../../packages/workouts/engine/shared/metronome');
 createMetronomeEngine.mockReturnValue({stop:jest.fn(),setVolume:jest.fn(),setAudibleSubdivision:jest.fn()});
 localStorage.clear();recordGroup(EXERCISES[8].id,0);
 const host=document.createElement('div'),root=createRoot(host);global.IS_REACT_ACT_ENVIRONMENT=true;
 act(()=>root.render(<Workout initialExercise={8}/>));
 expect(host.textContent).toContain('Single string · alternating direction');
 expect(host.textContent).toContain('Resume from this position');
 expect(host.textContent).toContain('Index finger: fret 2');
 act(()=>root.unmount());
});
