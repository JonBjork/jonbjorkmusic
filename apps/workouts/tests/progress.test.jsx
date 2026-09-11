import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
global.IS_REACT_ACT_ENVIRONMENT=true;

import WorkoutProgress from '../../../packages/workouts/engine/workouts/WorkoutProgress';
import {progressSessions,summarize} from '../../../packages/workouts/engine/workouts/progressSummary';
import {importLog,readLog,dayKey} from '../../../packages/workouts/engine/workouts/storage';
beforeEach(()=>localStorage.clear());
test('groups classic days under one workout and rejects invalid history',()=>{
 const result=progressSessions([{workoutId:'room-classic-day-2',seconds:60,startedAt:'2026-09-11T12:00:00'}, {seconds:'bad',startedAt:'invalid'}]);
 expect(result).toHaveLength(1);expect(result[0].id).toBe('room-classic-sequence');expect(result[0].category).toBe('Alternate picking');expect(summarize(result).days).toBe(1);
});
test('backup merging keeps distinct workouts and ignores duplicates and malformed sessions',()=>{
 const base={startedAt:'2026-09-11T12:00:00',seconds:60};
 const backup={sessions:[{...base,workoutId:'picking'},{...base,workoutId:'finger-legato'},{seconds:-1,startedAt:'bad'}]};
 expect(importLog(backup).added).toBe(2);expect(importLog(backup).added).toBe(0);expect(readLog().sessions).toHaveLength(2);
});
test('calendar selects a day and category filters the history',()=>{
 const now=new Date();importLog({sessions:[{workoutId:'finger-legato',startedAt:now.toISOString(),seconds:60},{workoutId:'picking',startedAt:now.toISOString(),seconds:90}]});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 act(()=>root.render(<WorkoutProgress onBack={()=>{}}/>));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 act(()=>button('Legato').click());
 expect(host.textContent).not.toContain('The Ultimate Alternate Picking Workout');
 act(()=>host.querySelector(`[aria-label="${dayKey(now)}, 1 sessions"]`).click());
 expect(button('Show month')).toBeTruthy();expect(host.textContent).toContain('1:00 practiced');
 act(()=>root.unmount());host.remove();
});
